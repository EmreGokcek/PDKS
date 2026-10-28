using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
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

/// <summary>Kişinin kendi profili. Ad, e-posta, pozisyon gibi alanları yalnızca admin değiştirir.</summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
public class ProfileController(PdksDbContext db, ICurrentUser currentUser, AuditLogger audit, TimeProvider time) : ControllerBase
{
    public static readonly string[] BloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"];

    [HttpGet("api/me/profile")]
    public async Task<ActionResult<ProfileDto>> Get(CancellationToken ct)
    {
        var user = await Load(currentUser.UserId, ct);
        return user is null ? Unauthorized() : ProfileDto.From(user);
    }

    [HttpPut("api/me/profile")]
    public async Task<ActionResult<ProfileDto>> Update(UpdateProfileRequest request, CancellationToken ct)
    {
        var user = await Load(currentUser.UserId, ct);
        if (user is null) return Unauthorized();

        var blood = Clean(request.BloodType);
        if (blood is not null && !BloodTypes.Contains(blood))
            return this.ApiError(400, "invalid_blood_type", "Geçersiz kan grubu.");
        if (blood is not null && !request.HealthDataConsent && user.HealthDataConsentAt is null)
            return this.ApiError(400, "consent_required", "Kan grubunu kaydetmek için açık rıza onayı gerekiyor.");
        if (request.BirthDate is { } bd && (bd > DateOnly.FromDateTime(DateTime.Today) || bd.Year < 1900))
            return this.ApiError(400, "invalid_birth_date", "Doğum tarihi geçersiz.");

        user.Phone = Clean(request.Phone);
        user.Address = Clean(request.Address);
        user.BirthDate = request.BirthDate;
        if (request.ShareBirthday is { } share) user.ShareBirthday = share;
        user.EmergencyContactName = Clean(request.EmergencyContactName);
        user.EmergencyContactPhone = Clean(request.EmergencyContactPhone);
        user.EmergencyContactRelation = Clean(request.EmergencyContactRelation);

        // Kan grubu silinirse rıza kaydı da kaldırılır; yeniden girilirse yeniden rıza istenir.
        user.BloodType = blood;
        user.HealthDataConsentAt = blood is null ? null : user.HealthDataConsentAt ?? time.GetUtcNow();

        // Kişisel verinin değerleri denetim kaydına yazılmaz; yalnızca güncellendiği bilgisi.
        audit.Log("profile.updated", nameof(User), user.Id);
        await db.SaveChangesAsync(ct);
        return ProfileDto.From(user);
    }

    /// <summary>Yöneticinin bir personelin profilini görmesi (acil durum kişisi, kan grubu vb.).</summary>
    [HttpGet("api/users/{id:guid}/profile"), Authorize(Policy = Perm.StaffView)]
    public async Task<ActionResult<ProfileDto>> Staff(Guid id, CancellationToken ct)
    {
        var user = await Load(id, ct);
        if (user is null || user.Role == UserRole.Kiosk) return this.NotFoundError("Personel bulunamadı.");
        if (currentUser.Role == UserRole.Manager && user.BranchId != currentUser.BranchId)
            return this.NotFoundError("Personel bulunamadı.");
        return ProfileDto.From(user);
    }

    private Task<User?> Load(Guid? id, CancellationToken ct) =>
        db.Users.Include(u => u.Company).Include(u => u.Branch).FirstOrDefaultAsync(u => u.Id == id, ct);

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}

/// <summary>Kişinin uygulama içi bildirimleri.</summary>
[ApiController]
[Route("api/me/notifications")]
[Authorize(Roles = Roles.Staff)]
public class NotificationsController(PdksDbContext db, ICurrentUser currentUser, TimeProvider time) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<NotificationListDto>> List([FromQuery] int take = 30, CancellationToken ct = default)
    {
        var mine = db.Notifications.AsNoTracking().Where(n => n.UserId == currentUser.UserId);
        var unread = await mine.CountAsync(n => n.ReadAt == null, ct);
        var items = await mine.OrderByDescending(n => n.CreatedAt).Take(Math.Clamp(take, 1, 100)).ToListAsync(ct);

        return new NotificationListDto(unread, items.Select(n => new NotificationDto(
            n.Id, n.Type,
            n.Data is null ? null : JsonSerializer.Deserialize<JsonElement>(n.Data),
            n.CreatedAt, n.ReadAt != null)).ToList());
    }

    /// <summary>Verilen bildirimleri (boşsa tümünü) okundu yapar.</summary>
    [HttpPost("read")]
    public async Task<IActionResult> MarkRead(MarkReadRequest request, CancellationToken ct)
    {
        var query = db.Notifications.Where(n => n.UserId == currentUser.UserId && n.ReadAt == null);
        if (request.Ids is { Count: > 0 } ids) query = query.Where(n => ids.Contains(n.Id));
        var now = time.GetUtcNow();
        await query.ExecuteUpdateAsync(s => s.SetProperty(n => n.ReadAt, (DateTimeOffset?)now), ct);
        return NoContent();
    }
}
