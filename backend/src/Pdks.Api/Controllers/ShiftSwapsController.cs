using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Common;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Scheduling;
using Pdks.Domain.Security;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Scheduling;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

public record SwapShiftDto(ShiftKind Kind, TimeOnly StartTime, TimeOnly EndTime, string? TemplateName);

public record ShiftSwapDto(
    Guid Id,
    DateOnly Date,
    SwapStatus Status,
    Guid RequesterId,
    string RequesterName,
    SwapShiftDto? RequesterShift,
    Guid TargetUserId,
    string TargetName,
    /// <summary>Arkadaşın o günkü planı; boşsa o gün planı yok.</summary>
    SwapShiftDto? TargetShift,
    string? Note,
    string? ReviewedBy,
    string? ReviewNote,
    DateTimeOffset CreatedAt);

public record SwapCandidateDto(Guid UserId, string Name, SwapShiftDto? Shift, bool Available, string? Reason);

public record CreateSwapRequest(Guid ShiftId, Guid TargetUserId, [MaxLength(300)] string? Note);

public record SwapDecisionRequest([MaxLength(300)] string? Note);

/// <summary>
/// Vardiya takası. Personel kendi (yayınlanmış, ileri tarihli) çalışma vardiyasını aynı gün için bir ekip arkadaşıyla değişir:
/// arkadaşı kabul eder, vardiya planlayabilen (müdür / yönetici) onaylar, plan değişir.
/// </summary>
[ApiController]
public class ShiftSwapsController(
    PdksDbContext db,
    ICurrentUser currentUser,
    AttendanceService attendance,
    ShiftPublication publication,
    Notifier notifier,
    AuditLogger audit,
    TimeProvider time) : ControllerBase
{
    [HttpGet("api/me/swaps"), Authorize(Policy = Perm.AttendanceSelf)]
    public async Task<List<ShiftSwapDto>> Mine(CancellationToken ct)
    {
        var me = currentUser.UserId;
        return await ToDtos(db.ShiftSwaps.Where(s => s.RequesterId == me || s.TargetUserId == me)
            .OrderByDescending(s => s.CreatedAt).Take(30), ct);
    }

    /// <summary>Bu vardiya için takas yapılabilecek ekip arkadaşları ve o günkü planları.</summary>
    [HttpGet("api/me/swaps/candidates"), Authorize(Policy = Perm.AttendanceSelf)]
    public async Task<ActionResult<List<SwapCandidateDto>>> Candidates([FromQuery] Guid shiftId, CancellationToken ct)
    {
        var shift = await db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shiftId && s.UserId == currentUser.UserId, ct);
        if (await ValidateOwnShiftAsync(shift, ct) is { } error) return error;

        var colleagues = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.Id != currentUser.UserId && u.BranchId == shift!.BranchId && RolePermissions.Workforce.Contains(u.Role))
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new { u.Id, Name = u.FirstName + " " + u.LastName })
            .ToListAsync(ct);
        var ids = colleagues.Select(c => c.Id).ToList();
        var day = shift!.Date;
        var plans = await db.Shifts.AsNoTracking().Include(s => s.ShiftTemplate)
            .Where(s => ids.Contains(s.UserId) && s.Date >= day.AddDays(-1) && s.Date <= day.AddDays(1))
            .ToListAsync(ct);
        var open = await db.ShiftSwaps.Where(s => s.RequesterShiftId == shiftId && (s.Status == SwapStatus.PendingPeer || s.Status == SwapStatus.PendingManager))
            .Select(s => s.TargetUserId).ToListAsync(ct);

        return colleagues.Select(c =>
        {
            var theirs = plans.FirstOrDefault(p => p.UserId == c.Id && p.Date == day);
            string? reason = null;
            if (!ShiftSwapRules.IsSwappable(theirs?.Kind)) reason = "on_leave";
            else if (theirs is { Kind: ShiftKind.Work } && theirs.StartTime == shift.StartTime && theirs.EndTime == shift.EndTime) reason = "same_shift";
            else if (open.Contains(c.Id)) reason = "already_requested";
            else
            {
                // Takas sonrası arkadaşın alacağı vardiya kendi önceki / sonraki günüyle çakışmasın.
                var after = new Shift { Date = day, Kind = ShiftKind.Work, StartTime = shift.StartTime, EndTime = shift.EndTime };
                if (ShiftSwapRules.OverlapsNeighbours(after, plans.Where(p => p.UserId == c.Id))) reason = "overlap";
            }
            return new SwapCandidateDto(c.Id, c.Name, theirs is null ? null : ToShift(theirs), reason is null, reason);
        }).ToList();
    }

    [HttpPost("api/me/swaps"), Authorize(Policy = Perm.AttendanceSelf)]
    public async Task<ActionResult<ShiftSwapDto>> Create(CreateSwapRequest request, CancellationToken ct)
    {
        var shift = await db.Shifts.FirstOrDefaultAsync(s => s.Id == request.ShiftId && s.UserId == currentUser.UserId, ct);
        if (await ValidateOwnShiftAsync(shift, ct) is { } error) return error;

        var candidates = (await Candidates(request.ShiftId, ct)).Value!;
        var target = candidates.FirstOrDefault(c => c.UserId == request.TargetUserId);
        if (target is null) return this.NotFoundError("Ekip arkadaşı bulunamadı.");
        if (!target.Available)
            return this.ApiError(409, $"swap_{target.Reason}", "Bu ekip arkadaşıyla bu gün takas yapılamaz.");

        var theirs = await db.Shifts.FirstOrDefaultAsync(s => s.UserId == target.UserId && s.Date == shift!.Date, ct);
        var swap = new ShiftSwap
        {
            BranchId = shift!.BranchId,
            Date = shift.Date,
            RequesterId = currentUser.UserId!.Value,
            RequesterShiftId = shift.Id,
            TargetUserId = target.UserId,
            TargetShiftId = theirs?.Id,
            Note = Clean(request.Note)
        };
        db.ShiftSwaps.Add(swap);
        var me = await db.Users.Where(u => u.Id == currentUser.UserId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(ct);
        notifier.Notify(target.UserId, NotificationType.SwapRequested, new { swapId = swap.Id, name = me, date = swap.Date });
        audit.Log("swap.requested", nameof(ShiftSwap), swap.Id, newValues: new { swap.Date, Target = target.Name });
        await db.SaveChangesAsync(ct);
        return (await ToDtos(db.ShiftSwaps.Where(s => s.Id == swap.Id), ct)).Single();
    }

    [HttpPost("api/me/swaps/{id:guid}/accept"), Authorize(Policy = Perm.AttendanceSelf)]
    public Task<ActionResult<ShiftSwapDto>> Accept(Guid id, CancellationToken ct) => PeerRespond(id, true, ct);

    [HttpPost("api/me/swaps/{id:guid}/decline"), Authorize(Policy = Perm.AttendanceSelf)]
    public Task<ActionResult<ShiftSwapDto>> Decline(Guid id, CancellationToken ct) => PeerRespond(id, false, ct);

    [HttpPost("api/me/swaps/{id:guid}/cancel"), Authorize(Policy = Perm.AttendanceSelf)]
    public async Task<ActionResult<ShiftSwapDto>> Cancel(Guid id, CancellationToken ct)
    {
        var swap = await db.ShiftSwaps.FirstOrDefaultAsync(s => s.Id == id && s.RequesterId == currentUser.UserId, ct);
        if (swap is null) return this.NotFoundError();
        if (swap.Status is not (SwapStatus.PendingPeer or SwapStatus.PendingManager))
            return this.ApiError(409, "swap_not_pending", "Bu takas artık beklemede değil.");
        swap.Status = SwapStatus.Cancelled;
        notifier.Notify(swap.TargetUserId, NotificationType.SwapUpdated, new { swapId = swap.Id, status = "Cancelled", date = swap.Date });
        audit.Log("swap.cancelled", nameof(ShiftSwap), swap.Id);
        await db.SaveChangesAsync(ct);
        return (await ToDtos(db.ShiftSwaps.Where(s => s.Id == id), ct)).Single();
    }

    private async Task<ActionResult<ShiftSwapDto>> PeerRespond(Guid id, bool accept, CancellationToken ct)
    {
        var swap = await db.ShiftSwaps.FirstOrDefaultAsync(s => s.Id == id && s.TargetUserId == currentUser.UserId, ct);
        if (swap is null) return this.NotFoundError();
        if (swap.Status != SwapStatus.PendingPeer) return this.ApiError(409, "swap_not_pending", "Bu takas artık beklemede değil.");

        if (accept && await StaleReasonAsync(swap, ct) is { } stale)
        {
            swap.Status = SwapStatus.Expired;
            await db.SaveChangesAsync(ct);
            return this.ApiError(409, stale, "Plan değiştiği için bu takas artık uygulanamaz.");
        }

        swap.Status = accept ? SwapStatus.PendingManager : SwapStatus.Declined;
        swap.PeerRespondedAt = time.GetUtcNow();
        var me = await db.Users.Where(u => u.Id == currentUser.UserId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(ct);
        notifier.Notify(swap.RequesterId, NotificationType.SwapUpdated, new { swapId = swap.Id, status = swap.Status.ToString(), name = me, date = swap.Date });
        if (accept)
            notifier.Notify(await ApproversAsync(swap.BranchId, ct), NotificationType.SwapNeedsApproval, new { swapId = swap.Id, date = swap.Date });
        audit.Log(accept ? "swap.accepted" : "swap.declined", nameof(ShiftSwap), swap.Id);
        await db.SaveChangesAsync(ct);
        return (await ToDtos(db.ShiftSwaps.Where(s => s.Id == id), ct)).Single();
    }

    /// <summary>Onay bekleyen (ve son kararlaşan) takaslar. Müdür kendi şubesini görür.</summary>
    [HttpGet("api/swaps"), Authorize(Policy = Perm.ShiftsPlan)]
    public async Task<List<ShiftSwapDto>> Team([FromQuery] bool pendingOnly = true, CancellationToken ct = default)
    {
        var q = Scope();
        q = pendingOnly ? q.Where(s => s.Status == SwapStatus.PendingManager) : q.Where(s => s.Status != SwapStatus.PendingPeer);
        return await ToDtos(q.OrderByDescending(s => s.Status == SwapStatus.PendingManager).ThenBy(s => s.Date).Take(50), ct);
    }

    [HttpPost("api/swaps/{id:guid}/approve"), Authorize(Policy = Perm.ShiftsPlan)]
    public async Task<ActionResult<ShiftSwapDto>> Approve(Guid id, SwapDecisionRequest request, CancellationToken ct)
    {
        var swap = await Scope().FirstOrDefaultAsync(s => s.Id == id, ct);
        if (swap is null) return this.NotFoundError();
        if (swap.Status != SwapStatus.PendingManager) return this.ApiError(409, "swap_not_pending", "Bu takas onay beklemiyor.");
        if (swap.RequesterId == currentUser.UserId || swap.TargetUserId == currentUser.UserId)
            return this.ApiError(403, "cannot_review_own", "Kendi takasını onaylayamazsın.");

        if (await StaleReasonAsync(swap, ct) is { } stale)
        {
            swap.Status = SwapStatus.Expired;
            await db.SaveChangesAsync(ct);
            return this.ApiError(409, stale, "Plan değiştiği için bu takas artık uygulanamaz.");
        }

        var mine = await db.Shifts.FirstAsync(s => s.Id == swap.RequesterShiftId, ct);
        var theirs = swap.TargetShiftId is { } tid ? await db.Shifts.FirstAsync(s => s.Id == tid, ct) : null;
        ShiftSwapRules.Apply(mine, theirs, swap.TargetUserId);

        swap.Status = SwapStatus.Approved;
        swap.ReviewedById = currentUser.UserId;
        swap.ReviewedAt = time.GetUtcNow();
        swap.ReviewNote = Clean(request.Note);
        foreach (var user in new[] { swap.RequesterId, swap.TargetUserId })
        {
            notifier.Notify(user, NotificationType.SwapUpdated, new { swapId = swap.Id, status = "Approved", date = swap.Date, note = swap.ReviewNote });
            notifier.Notify(user, NotificationType.ShiftChanged, new { dates = new[] { swap.Date } });
        }
        audit.Log("swap.approved", nameof(ShiftSwap), swap.Id, newValues: new { swap.Date }, reason: swap.ReviewNote);
        await db.SaveChangesAsync(ct);
        return (await ToDtos(db.ShiftSwaps.Where(s => s.Id == id), ct)).Single();
    }

    [HttpPost("api/swaps/{id:guid}/reject"), Authorize(Policy = Perm.ShiftsPlan)]
    public async Task<ActionResult<ShiftSwapDto>> Reject(Guid id, SwapDecisionRequest request, CancellationToken ct)
    {
        var swap = await Scope().FirstOrDefaultAsync(s => s.Id == id, ct);
        if (swap is null) return this.NotFoundError();
        if (swap.Status != SwapStatus.PendingManager) return this.ApiError(409, "swap_not_pending", "Bu takas onay beklemiyor.");

        swap.Status = SwapStatus.Rejected;
        swap.ReviewedById = currentUser.UserId;
        swap.ReviewedAt = time.GetUtcNow();
        swap.ReviewNote = Clean(request.Note);
        foreach (var user in new[] { swap.RequesterId, swap.TargetUserId })
            notifier.Notify(user, NotificationType.SwapUpdated, new { swapId = swap.Id, status = "Rejected", date = swap.Date, note = swap.ReviewNote });
        audit.Log("swap.rejected", nameof(ShiftSwap), swap.Id, reason: swap.ReviewNote);
        await db.SaveChangesAsync(ct);
        return (await ToDtos(db.ShiftSwaps.Where(s => s.Id == id), ct)).Single();
    }

    private IQueryable<ShiftSwap> Scope() =>
        currentUser.Role is { } r && RolePermissions.IsCompanyWide(r) ? db.ShiftSwaps : db.ShiftSwaps.Where(s => s.BranchId == currentUser.BranchId);

    /// <summary>Takas yalnızca kendi, yayınlanmış haftadaki, başlamamış çalışma vardiyası için istenebilir.</summary>
    private async Task<ObjectResult?> ValidateOwnShiftAsync(Shift? shift, CancellationToken ct)
    {
        if (shift is null) return this.NotFoundError("Vardiya bulunamadı.");
        if (shift.Kind != ShiftKind.Work) return this.ApiError(400, "swap_not_work", "Yalnızca çalışma vardiyası takas edilebilir.");
        if (await StartedAsync(shift, ct)) return this.ApiError(400, "swap_past", "Başlamış ya da geçmiş vardiya takas edilemez.");
        if ((await publication.VisibleAsync([shift], ct)).Count == 0)
            return this.ApiError(400, "swap_unpublished", "Henüz yayınlanmamış haftada takas istenemez.");
        return null;
    }

    private async Task<bool> StartedAsync(Shift shift, CancellationToken ct)
    {
        var tz = await attendance.TimeZoneForAsync(shift.BranchId, ct);
        return AttendanceService.ToUtc(shift.Date, shift.StartTime, tz) <= time.GetUtcNow();
    }

    /// <summary>İstekten bu yana plan değiştiyse ya da vardiya başladıysa takas uygulanamaz.</summary>
    private async Task<string?> StaleReasonAsync(ShiftSwap swap, CancellationToken ct)
    {
        var mine = await db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == swap.RequesterShiftId, ct);
        if (mine is null || mine.UserId != swap.RequesterId || mine.Kind != ShiftKind.Work || mine.Date != swap.Date) return "swap_plan_changed";
        if (await StartedAsync(mine, ct)) return "swap_past";

        var theirs = await db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == swap.TargetUserId && s.Date == swap.Date, ct);
        if (theirs?.Id != swap.TargetShiftId || !ShiftSwapRules.IsSwappable(theirs?.Kind)) return "swap_plan_changed";

        // Takas sonrası iki kişinin de önceki / sonraki günüyle çakışma olmasın.
        var neighbours = await db.Shifts.AsNoTracking()
            .Where(s => (s.UserId == swap.RequesterId || s.UserId == swap.TargetUserId) && s.Date >= swap.Date.AddDays(-1) && s.Date <= swap.Date.AddDays(1) && s.Date != swap.Date)
            .ToListAsync(ct);
        var targetAfter = new Shift { Date = swap.Date, Kind = ShiftKind.Work, StartTime = mine.StartTime, EndTime = mine.EndTime };
        var requesterAfter = theirs is { Kind: ShiftKind.Work } ? new Shift { Date = swap.Date, Kind = ShiftKind.Work, StartTime = theirs.StartTime, EndTime = theirs.EndTime } : null;
        if (ShiftSwapRules.OverlapsNeighbours(targetAfter, neighbours.Where(n => n.UserId == swap.TargetUserId)) ||
            ShiftSwapRules.OverlapsNeighbours(requesterAfter, neighbours.Where(n => n.UserId == swap.RequesterId)))
            return "swap_overlap";
        return null;
    }

    private Task<List<Guid>> ApproversAsync(Guid branchId, CancellationToken ct) =>
        db.Users.Where(u => u.IsActive && (u.Role == UserRole.Admin || (u.Role == UserRole.Manager && u.BranchId == branchId)))
            .Select(u => u.Id).ToListAsync(ct);

    private async Task<List<ShiftSwapDto>> ToDtos(IQueryable<ShiftSwap> query, CancellationToken ct)
    {
        var swaps = await query.AsNoTracking().Include(s => s.Requester).Include(s => s.TargetUser).ToListAsync(ct);
        var shiftIds = swaps.Select(s => s.RequesterShiftId).Concat(swaps.Select(s => s.TargetShiftId).OfType<Guid>()).ToList();
        var shifts = await db.Shifts.AsNoTracking().Include(s => s.ShiftTemplate).Where(s => shiftIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var reviewerIds = swaps.Select(s => s.ReviewedById).OfType<Guid>().Distinct().ToList();
        var reviewers = await db.Users.Where(u => reviewerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, ct);

        // Her zaman takas ÖNCESİ hâl gösterilir: isteyenin verdiği vardiya ve arkadaşının o günkü planı.
        // Onaylanınca iki kaydın içeriği yer değiştirdiği için (bkz. ShiftSwapRules.Apply) kayıtlar ters okunur.
        return swaps.Select(s =>
        {
            var mine = shifts.GetValueOrDefault(s.RequesterShiftId);
            var theirs = s.TargetShiftId is { } t ? shifts.GetValueOrDefault(t) : null;
            var swapped = s.Status == SwapStatus.Approved && theirs is not null;
            var given = swapped ? theirs : mine;
            var had = swapped ? mine : theirs;
            return new ShiftSwapDto(s.Id, s.Date, s.Status, s.RequesterId, s.Requester!.FullName, given is null ? null : ToShift(given),
                s.TargetUserId, s.TargetUser!.FullName, had is null ? null : ToShift(had), s.Note,
                s.ReviewedById is { } r ? reviewers.GetValueOrDefault(r) : null, s.ReviewNote, s.CreatedAt);
        }).ToList();
    }

    private static SwapShiftDto ToShift(Shift s) => new(s.Kind, s.StartTime, s.EndTime, s.ShiftTemplate?.Name);

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}
