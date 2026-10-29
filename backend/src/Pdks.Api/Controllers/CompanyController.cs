using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Security;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Companies;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

/// <summary>
/// Firma ayarları: firma adı, şubeler ve giriş kioskları. Yalnızca yönetici (company.manage).
/// Kiosk, rolü Kiosk olan bir hesapla açılan tablettir; hesabın şifresi yalnızca oluşturma ve sıfırlamada bir kez gösterilir.
/// </summary>
[ApiController]
[Route("api/company")]
[Authorize(Policy = Perm.CompanyManage)]
public class CompanyController(
    PdksDbContext db,
    ICurrentUser currentUser,
    IPasswordHasher<User> hasher,
    RefreshTokenService refreshTokens,
    AuditLogger audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CompanySettingsDto>> Get(CancellationToken ct)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == currentUser.CompanyId, ct);
        if (company is null) return this.NotFoundError("Firma bulunamadı.");

        var staffCounts = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.Role != UserRole.Kiosk && u.BranchId != null)
            .GroupBy(u => u.BranchId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var kiosks = await KioskQuery().ToListAsync(ct);

        var branches = await db.Branches.AsNoTracking().OrderByDescending(b => b.IsActive).ThenBy(b => b.CreatedAt).ToListAsync(ct);
        return new CompanySettingsDto(
            company.Id,
            company.Name,
            branches.Select(b => new BranchSettingsDto(b.Id, b.Name, b.TimeZone, b.IsActive,
                staffCounts.GetValueOrDefault(b.Id), kiosks.Count(k => k.BranchId == b.Id && k.IsActive))).ToList(),
            kiosks);
    }

    [HttpPut]
    public async Task<IActionResult> Update(UpdateCompanyRequest request, CancellationToken ct)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == currentUser.CompanyId, ct);
        if (company is null) return this.NotFoundError("Firma bulunamadı.");

        var before = new { company.Name };
        company.Name = request.Name.Trim();
        audit.Log("company.updated", nameof(Company), company.Id, before, new { company.Name });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("branches")]
    public async Task<ActionResult<BranchSettingsDto>> CreateBranch(SaveBranchRequest request, CancellationToken ct)
    {
        if (ValidTimeZone(request.TimeZone) is not { } tz) return InvalidTimeZone();

        var branch = new Branch { Name = request.Name.Trim(), TimeZone = tz };
        db.Branches.Add(branch);
        audit.Log("branch.created", nameof(Branch), branch.Id, newValues: new { branch.Name, branch.TimeZone });
        await db.SaveChangesAsync(ct);
        return new BranchSettingsDto(branch.Id, branch.Name, branch.TimeZone, branch.IsActive, 0, 0);
    }

    [HttpPut("branches/{id:guid}")]
    public async Task<ActionResult<BranchSettingsDto>> UpdateBranch(Guid id, SaveBranchRequest request, CancellationToken ct)
    {
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (branch is null) return this.NotFoundError("Şube bulunamadı.");
        if (ValidTimeZone(request.TimeZone ?? branch.TimeZone) is not { } tz) return InvalidTimeZone();

        var staff = await db.Users.CountAsync(u => u.BranchId == id && u.IsActive && u.Role != UserRole.Kiosk, ct);
        if (branch.IsActive && !request.IsActive)
        {
            // Çalışanı olan şube kapatılamaz: önce personel başka şubeye alınmalı ya da pasife alınmalı.
            if (staff > 0)
                return this.ApiError(409, "branch_has_staff", "Bu şubede aktif personel var. Önce personeli başka şubeye taşıyın.")
                    .WithExtension("count", staff);
            if (!await db.Branches.AnyAsync(b => b.Id != id && b.IsActive, ct))
                return this.ApiError(409, "last_branch", "Firmanın en az bir açık şubesi olmalı.");
        }

        var before = new { branch.Name, branch.TimeZone, branch.IsActive };
        branch.Name = request.Name.Trim();
        branch.TimeZone = tz;
        branch.IsActive = request.IsActive;
        // Kapanan şubenin kioskları da kapanır (QR üretemez, oturumları kapanır).
        if (!branch.IsActive)
        {
            var kiosks = await db.Kiosks.Where(k => k.BranchId == id && k.IsActive).ToListAsync(ct);
            foreach (var k in kiosks) await SetKioskActiveAsync(k, false, ct);
        }

        audit.Log("branch.updated", nameof(Branch), branch.Id, before, new { branch.Name, branch.TimeZone, branch.IsActive });
        await db.SaveChangesAsync(ct);
        var kioskCount = await db.Kiosks.CountAsync(k => k.BranchId == id && k.IsActive, ct);
        return new BranchSettingsDto(branch.Id, branch.Name, branch.TimeZone, branch.IsActive, staff, kioskCount);
    }

    [HttpPost("kiosks")]
    public async Task<ActionResult<KioskWithPasswordDto>> CreateKiosk(SaveKioskRequest request, CancellationToken ct)
    {
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == request.BranchId && b.IsActive, ct);
        if (branch is null) return this.ApiError(400, "invalid_branch", "Şube bulunamadı.");

        string email;
        do email = CompanySetup.NewKioskEmail();
        while (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email, ct));

        var password = PasswordPolicy.GenerateTemporary();
        var device = new User
        {
            BranchId = branch.Id,
            FirstName = request.Name.Trim(),
            LastName = "Kiosku",
            Email = email,
            Role = UserRole.Kiosk
        };
        device.PasswordHash = hasher.HashPassword(device, password);
        var kiosk = new Kiosk
        {
            BranchId = branch.Id,
            Name = request.Name.Trim(),
            Secret = CompanySetup.NewKioskSecret(),
            DeviceUserId = device.Id
        };

        db.Users.Add(device);
        db.Kiosks.Add(kiosk);
        audit.Log("kiosk.created", nameof(Kiosk), kiosk.Id, newValues: new { kiosk.Name, Branch = branch.Name, Email = email });
        await db.SaveChangesAsync(ct);

        return new KioskWithPasswordDto(await KioskQuery(kiosk.Id).FirstAsync(ct), password);
    }

    [HttpPut("kiosks/{id:guid}")]
    public async Task<ActionResult<KioskDto>> UpdateKiosk(Guid id, SaveKioskRequest request, CancellationToken ct)
    {
        var kiosk = await db.Kiosks.FirstOrDefaultAsync(k => k.Id == id, ct);
        if (kiosk is null) return this.NotFoundError("Kiosk bulunamadı.");
        if (!await db.Branches.AnyAsync(b => b.Id == request.BranchId && b.IsActive, ct))
            return this.ApiError(400, "invalid_branch", "Şube bulunamadı.");

        var device = await db.Users.FirstOrDefaultAsync(u => u.Id == kiosk.DeviceUserId, ct);
        var before = new { kiosk.Name, kiosk.BranchId };
        kiosk.Name = request.Name.Trim();
        kiosk.BranchId = request.BranchId;
        if (device is not null)
        {
            device.FirstName = kiosk.Name;
            device.BranchId = kiosk.BranchId;
        }
        audit.Log("kiosk.updated", nameof(Kiosk), kiosk.Id, before, new { kiosk.Name, kiosk.BranchId });
        await db.SaveChangesAsync(ct);
        return await KioskQuery(id).FirstAsync(ct);
    }

    /// <summary>Kiosk hesabına yeni şifre verir; tablet yeniden giriş yapmalıdır.</summary>
    [HttpPost("kiosks/{id:guid}/reset-password")]
    public async Task<ActionResult<KioskWithPasswordDto>> ResetKioskPassword(Guid id, CancellationToken ct)
    {
        var kiosk = await db.Kiosks.FirstOrDefaultAsync(k => k.Id == id, ct);
        var device = kiosk is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Id == kiosk.DeviceUserId, ct);
        if (kiosk is null || device is null) return this.NotFoundError("Kiosk bulunamadı.");

        var password = PasswordPolicy.GenerateTemporary();
        device.PasswordHash = hasher.HashPassword(device, password);
        device.LockoutUntil = null;
        device.FailedLoginCount = 0;
        await refreshTokens.RevokeAllForUserAsync(device.Id, "password_reset", ct);
        audit.Log("kiosk.password_reset", nameof(Kiosk), kiosk.Id);
        await db.SaveChangesAsync(ct);
        return new KioskWithPasswordDto(await KioskQuery(id).FirstAsync(ct), password);
    }

    [HttpPost("kiosks/{id:guid}/deactivate")]
    public Task<ActionResult<KioskDto>> DeactivateKiosk(Guid id, CancellationToken ct) => ToggleKioskAsync(id, false, ct);

    [HttpPost("kiosks/{id:guid}/activate")]
    public Task<ActionResult<KioskDto>> ActivateKiosk(Guid id, CancellationToken ct) => ToggleKioskAsync(id, true, ct);

    private async Task<ActionResult<KioskDto>> ToggleKioskAsync(Guid id, bool active, CancellationToken ct)
    {
        var kiosk = await db.Kiosks.Include(k => k.Branch).FirstOrDefaultAsync(k => k.Id == id, ct);
        if (kiosk is null) return this.NotFoundError("Kiosk bulunamadı.");
        if (active && kiosk.Branch is { IsActive: false })
            return this.ApiError(409, "branch_inactive", "Kioskun şubesi kapalı. Önce şubeyi açın.");

        if (kiosk.IsActive != active)
        {
            await SetKioskActiveAsync(kiosk, active, ct);
            audit.Log(active ? "kiosk.activated" : "kiosk.deactivated", nameof(Kiosk), kiosk.Id);
            await db.SaveChangesAsync(ct);
        }
        return await KioskQuery(id).FirstAsync(ct);
    }

    /// <summary>Kiosku ve hesabını birlikte açar / kapatır; kapanınca tabletteki oturum da kapanır.</summary>
    private async Task SetKioskActiveAsync(Kiosk kiosk, bool active, CancellationToken ct)
    {
        kiosk.IsActive = active;
        var device = await db.Users.FirstOrDefaultAsync(u => u.Id == kiosk.DeviceUserId, ct);
        if (device is null) return;
        device.IsActive = active;
        if (!active) await refreshTokens.RevokeAllForUserAsync(device.Id, "kiosk_deactivated", ct);
    }

    /// <summary>Kiosklar (ya da tek kiosk). Süzme, DTO'ya çevirmeden önce yapılır (EF kurucu parametresini sorguya çeviremez).</summary>
    private IQueryable<KioskDto> KioskQuery(Guid? id = null) =>
        from k in db.Kiosks.AsNoTracking()
        join u in db.Users on k.DeviceUserId equals u.Id
        where id == null || k.Id == id
        orderby k.IsActive descending, k.CreatedAt
        select new KioskDto(k.Id, k.Name, k.BranchId, k.Branch != null ? k.Branch.Name : null, u.Email, k.IsActive, u.LastLoginAt, k.LastSeenAt);

    private static string? ValidTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return AttendanceService.DefaultTimeZone;
        return TimeZoneInfo.TryFindSystemTimeZoneById(id.Trim(), out _) ? id.Trim() : null;
    }

    private ObjectResult InvalidTimeZone() => this.ApiError(400, "invalid_timezone", "Saat dilimi geçersiz.");
}
