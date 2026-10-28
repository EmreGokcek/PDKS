using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Attendance;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

/// <summary>
/// Yöneticinin giriş-çıkış kayıtlarını elle düzeltmesi. Her işlem gerekçe ister ve denetim kaydına yazılır.
/// Elle eklenen kayıtlar Source = Manual olarak işaretlenir.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.AdminOrManager)]
public class CorrectionsController(
    PdksDbContext db,
    ICurrentUser currentUser,
    AttendanceService attendance,
    AuditLogger audit,
    Notifier notifier,
    TimeProvider time,
    AccessScope scope) : ControllerBase
{
    /// <summary>Bir günün kayıtları (gece vardiyası çıkışları için ertesi gün öğlene kadar).</summary>
    [HttpGet("api/staff/{userId:guid}/attendance")]
    public async Task<ActionResult<List<EventDetailDto>>> Day(Guid userId, [FromQuery] DateOnly date, CancellationToken ct)
    {
        // Görme yetkisi yeterli; düzeltme ayrıca denetleme yetkisi ister.
        var user = await scope.VisibleStaff().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return this.NotFoundError("Personel bulunamadı.");

        var tz = await attendance.TimeZoneForAsync(user.BranchId, ct);
        var from = AttendanceService.ToUtc(date, TimeOnly.MinValue, tz);
        var to = AttendanceService.ToUtc(date.AddDays(1), new TimeOnly(12, 0), tz);

        var events = await db.AttendanceEvents.AsNoTracking()
            .Where(e => e.UserId == userId && e.OccurredAt >= from && e.OccurredAt < to)
            .OrderBy(e => e.OccurredAt)
            .ToListAsync(ct);
        var recorderIds = events.Where(e => e.RecordedByUserId != null).Select(e => e.RecordedByUserId!.Value).Distinct().ToList();
        var names = await db.Users.Where(u => recorderIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, ct);

        return events.Select(e => EventDetailDto.Create(e,
            e.RecordedByUserId is { } r && names.TryGetValue(r, out var n) ? n : null, tz)).ToList();
    }

    [HttpPost("api/staff/{userId:guid}/attendance")]
    public async Task<ActionResult<EventDetailDto>> Add(Guid userId, ManualEventRequest request, CancellationToken ct)
    {
        var user = await scope.VisibleStaff().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return this.NotFoundError("Personel bulunamadı.");
        if (userId == currentUser.UserId) return OwnRecords();
        if (!await CanEditAsync(userId, ct)) return NotYourStaff();

        var tz = await attendance.TimeZoneForAsync(user.BranchId, ct);
        var at = AttendanceService.ToUtc(request.Date, request.Time, tz);
        if (at > time.GetUtcNow()) return this.ApiError(400, "future_time", "İleri bir saat için kayıt girilemez.");

        if (await attendance.ValidateChangeAsync(userId, at, null, new EventPoint(request.Type, at), ct) is { } error)
            return SequenceError(error);

        var evt = new AttendanceEvent
        {
            UserId = userId,
            BranchId = user.BranchId ?? currentUser.BranchId ?? Guid.Empty,
            Type = request.Type,
            OccurredAt = at,
            Source = AttendanceSource.Manual,
            RecordedByUserId = currentUser.UserId,
            Note = request.Reason.Trim()
        };
        if (evt.BranchId == Guid.Empty) return this.ApiError(400, "invalid_branch", "Personelin şubesi tanımlı değil.");

        db.AttendanceEvents.Add(evt);
        notifier.Notify(userId, NotificationType.RecordCorrected, new { action = "added", type = request.Type.ToString(), at });
        audit.Log("attendance.added", nameof(AttendanceEvent), evt.Id,
            newValues: new { UserId = userId, Type = request.Type.ToString(), OccurredAt = at }, reason: request.Reason);
        await db.SaveChangesAsync(ct);
        return EventDetailDto.Create(evt, null, tz);
    }

    [HttpPut("api/attendance/events/{id:guid}")]
    public async Task<ActionResult<EventDetailDto>> Change(Guid id, ChangeEventRequest request, CancellationToken ct)
    {
        var evt = await FindAsync(id, ct);
        if (evt is null) return this.NotFoundError();
        if (evt.UserId == currentUser.UserId) return OwnRecords();
        if (!await CanEditAsync(evt.UserId, ct)) return NotYourStaff();

        var tz = await attendance.TimeZoneForAsync(evt.BranchId, ct);
        var at = AttendanceService.ToUtc(request.Date, request.Time, tz);
        if (at > time.GetUtcNow()) return this.ApiError(400, "future_time", "İleri bir saat için kayıt girilemez.");

        if (await attendance.ValidateChangeAsync(evt.UserId, at, evt.Id, new EventPoint(evt.Type, at), ct) is { } error)
            return SequenceError(error);

        var before = evt.OccurredAt;
        evt.OccurredAt = at;
        evt.Source = AttendanceSource.Manual;
        evt.RecordedByUserId = currentUser.UserId;
        evt.Note = request.Reason.Trim();

        notifier.Notify(evt.UserId, NotificationType.RecordCorrected, new { action = "changed", type = evt.Type.ToString(), at });
        audit.Log("attendance.changed", nameof(AttendanceEvent), evt.Id,
            oldValues: new { OccurredAt = before }, newValues: new { OccurredAt = at }, reason: request.Reason);
        await db.SaveChangesAsync(ct);
        return EventDetailDto.Create(evt, null, tz);
    }

    /// <summary>Kaydı siler. Eski değer gerekçesiyle birlikte denetim kaydında saklanır.</summary>
    [HttpPost("api/attendance/events/{id:guid}/delete")]
    public async Task<IActionResult> Delete(Guid id, DeleteEventRequest request, CancellationToken ct)
    {
        var evt = await FindAsync(id, ct);
        if (evt is null) return this.NotFoundError();
        if (evt.UserId == currentUser.UserId) return OwnRecords();
        if (!await CanEditAsync(evt.UserId, ct)) return NotYourStaff();

        if (await attendance.ValidateChangeAsync(evt.UserId, evt.OccurredAt, evt.Id, null, ct) is { } error)
            return SequenceError(error);

        db.AttendanceEvents.Remove(evt);
        notifier.Notify(evt.UserId, NotificationType.RecordCorrected, new { action = "deleted", type = evt.Type.ToString(), at = evt.OccurredAt });
        audit.Log("attendance.deleted", nameof(AttendanceEvent), evt.Id,
            oldValues: new { evt.UserId, Type = evt.Type.ToString(), evt.OccurredAt, Source = evt.Source.ToString() }, reason: request.Reason);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Kimse kendi kaydını düzeltemez; talep göndermelidir.</summary>
    private ObjectResult OwnRecords() =>
        this.ApiError(403, "cannot_edit_own", "Kendi kayıtlarını düzeltemezsin; talep gönder.");

    private ObjectResult SequenceError(string code) => code == "duplicate_time"
        ? this.ApiError(409, code, "Aynı anda iki kayıt olamaz.")
        : this.ApiError(409, code, "Bu değişiklikle kayıtların sırası anlamsız hale geliyor (ör. girişsiz çıkış).");

    private async Task<AttendanceEvent?> FindAsync(Guid id, CancellationToken ct)
    {
        var staffIds = StaffScope().Select(u => u.Id);
        return await db.AttendanceEvents.FirstOrDefaultAsync(e => e.Id == id && staffIds.Contains(e.UserId), ct);
    }

    /// <summary>Kayıtlarını görebildiği kişiler.</summary>
    private IQueryable<User> StaffScope() => scope.VisibleStaff();

    /// <summary>Düzeltebildiği kişiler (müdür: şubesindeki personel; yönetici: kendisi dışında herkes).</summary>
    private Task<bool> CanEditAsync(Guid userId, CancellationToken ct) => scope.SupervisedStaff().AnyAsync(u => u.Id == userId, ct);

    private ObjectResult NotYourStaff() =>
        this.ApiError(403, "not_your_staff", "Bu kişinin kayıtlarını yalnızca yönetici düzeltebilir.");
}
