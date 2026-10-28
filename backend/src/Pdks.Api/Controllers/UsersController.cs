using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Domain.Security;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

/// <summary>
/// Personel yönetimi. Listeleme Admin ve Müdüre açık (müdür yalnızca kendi şubesini görür);
/// ekleme, düzenleme, pasife alma ve şifre sıfırlama yalnızca Admin'de.
/// Kiosk hesapları burada listelenmez, ayrı yönetilir.
/// </summary>
[ApiController]
[Route("api/users")]
[Authorize(Policy = Perm.StaffView)]
public class UsersController(
    PdksDbContext db,
    IPasswordHasher<User> hasher,
    ICurrentUser currentUser,
    AuditLogger audit,
    RefreshTokenService refreshTokens,
    AccessScope scope) : ControllerBase
{
    /// <summary>Bu kullanıcının atayabileceği roller (İK yönetici hesabı açamaz).</summary>
    private IReadOnlyCollection<UserRole> Assignable => currentUser.Role is { } r ? RolePermissions.AssignableRoles(r) : [];

    /// <summary>İK, yönetici hesaplarını düzenleyemez, pasife alamaz, şifresini sıfırlayamaz.</summary>
    private bool CanManage(User target) => Assignable.Contains(target.Role);

    [HttpGet]
    public async Task<ActionResult<List<UserListItem>>> List(
        [FromQuery] string? search,
        [FromQuery] UserRole? role,
        [FromQuery] bool? isActive,
        CancellationToken ct)
    {
        // Yönetici herkesi, müdür kendi şubesindeki personel ve müdürleri görür.
        var query = scope.VisibleStaff().AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(u =>
                EF.Functions.ILike(u.FirstName + " " + u.LastName, term) ||
                EF.Functions.ILike(u.Email, term) ||
                (u.EmployeeNumber != null && EF.Functions.ILike(u.EmployeeNumber, term)));
        }

        if (role is not null) query = query.Where(u => u.Role == role);
        if (isActive is not null) query = query.Where(u => u.IsActive == isActive);

        return await query
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new UserListItem(
                u.Id, u.FirstName, u.LastName, u.FirstName + " " + u.LastName, u.Email, u.Phone,
                u.EmployeeNumber, u.Role, u.BranchId, u.Branch != null ? u.Branch.Name : null,
                u.IsActive, u.MustChangePassword, u.LastLoginAt, u.CreatedAt, u.Position, u.HireDate))
            .ToListAsync(ct);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserListItem>> Get(Guid id, CancellationToken ct)
    {
        var user = await FindAsync(id, ct);
        if (user is null || !await scope.VisibleStaff().AnyAsync(u => u.Id == id, ct))
            return this.NotFoundError("Personel bulunamadı.");
        return ToItem(user);
    }

    [HttpPost, Authorize(Policy = Perm.StaffManage)]
    public async Task<ActionResult<UserWithPasswordResponse>> Create(SaveUserRequest request, CancellationToken ct)
    {
        if (await ValidateAsync(request, null, ct) is { } error) return error;

        var tempPassword = PasswordPolicy.GenerateTemporary();
        var user = new User
        {
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Email = NormalizeEmail(request.Email),
            Phone = Clean(request.Phone),
            EmployeeNumber = Clean(request.EmployeeNumber),
            Role = request.Role,
            BranchId = request.BranchId ?? currentUser.BranchId,
            Position = Clean(request.Position),
            HireDate = request.HireDate,
            MustChangePassword = true
        };
        user.PasswordHash = hasher.HashPassword(user, tempPassword);

        db.Users.Add(user);
        audit.Log("user.created", nameof(User), user.Id, newValues: Snapshot(user));
        await db.SaveChangesAsync(ct);

        await db.Entry(user).Reference(u => u.Branch).LoadAsync(ct);
        return CreatedAtAction(nameof(Get), new { id = user.Id },
            new UserWithPasswordResponse(ToItem(user), tempPassword));
    }

    [HttpPut("{id:guid}"), Authorize(Policy = Perm.StaffManage)]
    public async Task<ActionResult<UserListItem>> Update(Guid id, SaveUserRequest request, CancellationToken ct)
    {
        var user = await FindAsync(id, ct);
        if (user is null) return this.NotFoundError("Personel bulunamadı.");
        if (!CanManage(user)) return NotAllowed();
        if (await ValidateAsync(request, user, ct) is { } error) return error;

        var before = Snapshot(user);
        user.FirstName = request.FirstName.Trim();
        user.LastName = request.LastName.Trim();
        user.Email = NormalizeEmail(request.Email);
        user.Phone = Clean(request.Phone);
        user.EmployeeNumber = Clean(request.EmployeeNumber);
        user.Role = request.Role;
        user.BranchId = request.BranchId ?? user.BranchId;
        user.Position = Clean(request.Position);
        user.HireDate = request.HireDate;

        audit.Log("user.updated", nameof(User), user.Id, before, Snapshot(user));
        await db.SaveChangesAsync(ct);
        await db.Entry(user).Reference(u => u.Branch).LoadAsync(ct);
        return ToItem(user);
    }

    /// <summary>Personeli pasife alır: giriş yapamaz, geçmiş kayıtları korunur.</summary>
    [HttpPost("{id:guid}/deactivate"), Authorize(Policy = Perm.StaffManage)]
    public Task<ActionResult<UserListItem>> Deactivate(Guid id, CancellationToken ct) => SetActive(id, false, ct);

    [HttpPost("{id:guid}/activate"), Authorize(Policy = Perm.StaffManage)]
    public Task<ActionResult<UserListItem>> Activate(Guid id, CancellationToken ct) => SetActive(id, true, ct);

    /// <summary>Yeni geçici şifre üretir; personel ilk girişte değiştirmek zorunda kalır.</summary>
    [HttpPost("{id:guid}/reset-password"), Authorize(Policy = Perm.StaffManage)]
    public async Task<ActionResult<UserWithPasswordResponse>> ResetPassword(Guid id, CancellationToken ct)
    {
        var user = await FindAsync(id, ct);
        if (user is null) return this.NotFoundError("Personel bulunamadı.");
        if (!CanManage(user)) return NotAllowed();

        var tempPassword = PasswordPolicy.GenerateTemporary();
        user.PasswordHash = hasher.HashPassword(user, tempPassword);
        user.MustChangePassword = true;
        user.LockoutUntil = null;
        user.FailedLoginCount = 0;
        // Eski şifreyle açılmış oturumlar kapanır.
        await refreshTokens.RevokeAllForUserAsync(user.Id, "password_reset", ct);

        audit.Log("user.password_reset", nameof(User), user.Id);
        await db.SaveChangesAsync(ct);
        return new UserWithPasswordResponse(ToItem(user), tempPassword);
    }

    [HttpGet("/api/branches")]
    public async Task<ActionResult<List<BranchDto>>> Branches(CancellationToken ct) =>
        await db.Branches.AsNoTracking()
            .Where(b => b.IsActive)
            .OrderBy(b => b.Name)
            .Select(b => new BranchDto(b.Id, b.Name))
            .ToListAsync(ct);

    // ---- yardımcılar ----

    private async Task<ActionResult<UserListItem>> SetActive(Guid id, bool active, CancellationToken ct)
    {
        var user = await FindAsync(id, ct);
        if (user is null) return this.NotFoundError("Personel bulunamadı.");

        if (!CanManage(user)) return NotAllowed();
        if (!active && user.Id == currentUser.UserId)
            return this.ApiError(400, "cannot_deactivate_self", "Kendi hesabınızı pasife alamazsınız.");

        if (user.IsActive != active)
        {
            user.IsActive = active;
            if (!active) await refreshTokens.RevokeAllForUserAsync(user.Id, "deactivated", ct);
            audit.Log(active ? "user.activated" : "user.deactivated", nameof(User), user.Id);
            await db.SaveChangesAsync(ct);
        }
        return ToItem(user);
    }

    private async Task<ObjectResult?> ValidateAsync(SaveUserRequest request, User? existing, CancellationToken ct)
    {
        if (!Assignable.Contains(request.Role))
            return this.ApiError(400, "invalid_role", "Bu rolü atama yetkin yok.");

        if (existing is not null && existing.Id == currentUser.UserId && request.Role != existing.Role)
            return this.ApiError(400, "cannot_change_own_role", "Kendi rolünüzü değiştiremezsiniz.");

        // E-posta tüm sistemde benzersiz (giriş e-postayla yapılıyor), bu yüzden firma filtresi devre dışı.
        var email = NormalizeEmail(request.Email);
        var taken = await db.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.Email == email && (existing == null || u.Id != existing.Id), ct);
        if (taken)
            return this.ApiError(409, "email_taken", "Bu e-posta adresi zaten kullanılıyor.");

        if (request.BranchId is { } branchId && !await db.Branches.AnyAsync(b => b.Id == branchId, ct))
            return this.ApiError(400, "invalid_branch", "Şube bulunamadı.");

        return null;
    }

    private ObjectResult NotAllowed() =>
        this.ApiError(403, "cannot_manage_user", "Bu hesabı düzenleme yetkin yok.");

    private Task<User?> FindAsync(Guid id, CancellationToken ct) =>
        db.Users.Include(u => u.Branch).FirstOrDefaultAsync(u => u.Id == id && u.Role != UserRole.Kiosk, ct);

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static object Snapshot(User u) => new
    {
        u.FirstName, u.LastName, u.Email, u.Phone, u.EmployeeNumber, Role = u.Role.ToString(), u.BranchId, u.Position, u.HireDate
    };

    private static UserListItem ToItem(User u) => new(
        u.Id, u.FirstName, u.LastName, u.FullName, u.Email, u.Phone, u.EmployeeNumber, u.Role,
        u.BranchId, u.Branch?.Name, u.IsActive, u.MustChangePassword, u.LastLoginAt, u.CreatedAt, u.Position, u.HireDate);
}
