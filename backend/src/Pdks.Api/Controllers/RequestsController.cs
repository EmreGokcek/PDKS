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

/// <summary>Personelin kendi talepleri: düzeltme ve izin.</summary>
[ApiController]
[Route("api/me/requests")]
[Authorize(Roles = Roles.Admin + "," + Roles.Manager + "," + Roles.Employee)]
public class MyRequestsController(
    PdksDbContext db,
    ICurrentUser currentUser,
    AttendanceService attendance,
    AuditLogger audit,
    TimeProvider time) : ControllerBase
{
    private static readonly ShiftKind[] RequestableLeaves = [ShiftKind.AnnualLeave, ShiftKind.SickLeave, ShiftKind.ExcusedLeave];

    [HttpGet]
    public async Task<ActionResult<List<RequestDto>>> List(CancellationToken ct) =>
        await RequestQueries.ToDtos(db, db.StaffRequests.Where(r => r.UserId == currentUser.UserId), ct);

    [HttpPost]
    public async Task<ActionResult<RequestDto>> Create(CreateRequestDto request, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == currentUser.UserId, ct);
        if (user is null) return Unauthorized();
        if (user.BranchId is null) return this.ApiError(400, "invalid_branch", "Şubeniz tanımlı değil.");

        var entity = new StaffRequest
        {
            UserId = user.Id,
            BranchId = user.BranchId.Value,
            Type = request.Type,
            Reason = request.Reason.Trim()
        };

        if (request.Type == RequestType.Correction)
        {
            if (request.EventType is null || request.Date is null || request.Time is null)
                return this.ApiError(400, "request_fields_required", "Kayıt türü, tarih ve saat seçilmeli.");

            var tz = await attendance.TimeZoneForAsync(user.BranchId, ct);
            var at = AttendanceService.ToUtc(request.Date.Value, request.Time.Value, tz);
            var now = time.GetUtcNow();
            if (at > now) return this.ApiError(400, "future_time", "İleri bir saat için kayıt girilemez.");
            if (now - at > TimeSpan.FromDays(31)) return this.ApiError(400, "too_old", "En fazla 31 gün öncesi için düzeltme istenebilir.");

            entity.EventType = request.EventType;
            entity.EventAt = at;
        }
        else
        {
            if (request.LeaveKind is not { } kind || !RequestableLeaves.Contains(kind) || request.StartDate is null || request.EndDate is null)
                return this.ApiError(400, "request_fields_required", "İzin türü ve tarihler seçilmeli.");
            if (request.EndDate < request.StartDate || request.EndDate.Value.DayNumber - request.StartDate.Value.DayNumber > 60)
                return this.ApiError(400, "invalid_range", "Tarih aralığı geçersiz.");

            entity.LeaveKind = kind;
            entity.StartDate = request.StartDate;
            entity.EndDate = request.EndDate;
        }

        db.StaffRequests.Add(entity);
        audit.Log("request.created", nameof(StaffRequest), entity.Id, newValues: new { Type = entity.Type.ToString() });
        await db.SaveChangesAsync(ct);
        return (await RequestQueries.ToDtos(db, db.StaffRequests.Where(r => r.Id == entity.Id), ct)).Single();
    }

    /// <summary>Bekleyen talebi geri çeker.</summary>
    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<RequestDto>> Cancel(Guid id, CancellationToken ct)
    {
        var entity = await db.StaffRequests.FirstOrDefaultAsync(r => r.Id == id && r.UserId == currentUser.UserId, ct);
        if (entity is null) return this.NotFoundError();
        if (entity.Status != RequestStatus.Pending) return this.ApiError(409, "request_not_pending", "Bu talep artık beklemede değil.");

        entity.Status = RequestStatus.Cancelled;
        audit.Log("request.cancelled", nameof(StaffRequest), entity.Id);
        await db.SaveChangesAsync(ct);
        return (await RequestQueries.ToDtos(db, db.StaffRequests.Where(r => r.Id == entity.Id), ct)).Single();
    }
}

/// <summary>Yöneticinin talepleri görmesi ve karara bağlaması. Müdür kendi şubesini görür, kendi talebini onaylayamaz.</summary>
[ApiController]
[Route("api/requests")]
[Authorize(Roles = Roles.AdminOrManager)]
public class RequestsController(
    PdksDbContext db,
    ICurrentUser currentUser,
    AttendanceService attendance,
    AuditLogger audit,
    TimeProvider time) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<RequestDto>>> List([FromQuery] RequestStatus? status, CancellationToken ct)
    {
        var query = Scope();
        if (status is not null) query = query.Where(r => r.Status == status);
        return await RequestQueries.ToDtos(db, query, ct, take: 200);
    }

    [HttpGet("pending-count")]
    public async Task<ActionResult<int>> PendingCount(CancellationToken ct) =>
        await Scope().CountAsync(r => r.Status == RequestStatus.Pending && r.UserId != currentUser.UserId, ct);

    [HttpPost("{id:guid}/approve")]
    public async Task<ActionResult<RequestDto>> Approve(Guid id, ReviewRequestDto review, CancellationToken ct)
    {
        var (entity, problem) = await LoadForReviewAsync(id, ct);
        if (problem is not null) return problem;

        var user = await db.Users.FirstAsync(u => u.Id == entity!.UserId, ct);

        if (entity!.Type == RequestType.Correction)
        {
            var at = entity.EventAt!.Value;
            var type = entity.EventType!.Value;
            if (await attendance.ValidateChangeAsync(user.Id, at, null, new EventPoint(type, at), ct) is { } error)
                return this.ApiError(409, error, "Bu düzeltme mevcut kayıtlarla uyuşmuyor; kayıtları elle düzeltmen gerekebilir.");

            db.AttendanceEvents.Add(new AttendanceEvent
            {
                UserId = user.Id,
                BranchId = entity.BranchId,
                Type = type,
                OccurredAt = at,
                Source = AttendanceSource.Manual,
                RecordedByUserId = currentUser.UserId,
                Note = $"Talep: {entity.Reason}"
            });
        }
        else
        {
            // İzin günleri plana yazılır; o günlerdeki vardiyaların yerini alır.
            var start = entity.StartDate!.Value;
            var end = entity.EndDate!.Value;
            var existing = await db.Shifts
                .Where(s => s.UserId == user.Id && s.Date >= start && s.Date <= end)
                .ToDictionaryAsync(s => s.Date, ct);
            for (var d = start; d <= end; d = d.AddDays(1))
            {
                if (!existing.TryGetValue(d, out var shift))
                {
                    shift = new Shift { UserId = user.Id, BranchId = entity.BranchId, Date = d, CreatedByUserId = currentUser.UserId!.Value };
                    db.Shifts.Add(shift);
                }
                shift.Kind = entity.LeaveKind!.Value;
                shift.StartTime = default;
                shift.EndTime = default;
                shift.BreakMinutes = null;
                shift.ShiftTemplateId = null;
                shift.Note = entity.Reason;
            }
        }

        Decide(entity, RequestStatus.Approved, review.Note);
        await db.SaveChangesAsync(ct);
        return (await RequestQueries.ToDtos(db, db.StaffRequests.Where(r => r.Id == entity.Id), ct)).Single();
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<RequestDto>> Reject(Guid id, ReviewRequestDto review, CancellationToken ct)
    {
        var (entity, problem) = await LoadForReviewAsync(id, ct);
        if (problem is not null) return problem;

        Decide(entity!, RequestStatus.Rejected, review.Note);
        await db.SaveChangesAsync(ct);
        return (await RequestQueries.ToDtos(db, db.StaffRequests.Where(r => r.Id == entity!.Id), ct)).Single();
    }

    private void Decide(StaffRequest entity, RequestStatus status, string? note)
    {
        entity.Status = status;
        entity.ReviewedByUserId = currentUser.UserId;
        entity.ReviewedAt = time.GetUtcNow();
        entity.ReviewNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        audit.Log(status == RequestStatus.Approved ? "request.approved" : "request.rejected", nameof(StaffRequest), entity.Id,
            newValues: new { Type = entity.Type.ToString(), entity.UserId }, reason: entity.ReviewNote);
    }

    private async Task<(StaffRequest?, ObjectResult?)> LoadForReviewAsync(Guid id, CancellationToken ct)
    {
        var entity = await Scope().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (entity is null) return (null, this.NotFoundError());
        if (entity.UserId == currentUser.UserId)
            return (null, this.ApiError(403, "cannot_review_own", "Kendi talebini onaylayamazsın."));
        if (entity.Status != RequestStatus.Pending)
            return (null, this.ApiError(409, "request_not_pending", "Bu talep artık beklemede değil."));
        return (entity, null);
    }

    private IQueryable<StaffRequest> Scope() =>
        currentUser.Role == UserRole.Manager
            ? db.StaffRequests.Where(r => r.BranchId == currentUser.BranchId)
            : db.StaffRequests;
}

internal static class RequestQueries
{
    public static async Task<List<RequestDto>> ToDtos(PdksDbContext db, IQueryable<StaffRequest> query, CancellationToken ct, int take = 100)
    {
        var rows = await query.AsNoTracking()
            .OrderByDescending(r => r.Status == RequestStatus.Pending).ThenByDescending(r => r.CreatedAt)
            .Take(take)
            .Select(r => new
            {
                Request = r,
                UserName = r.User!.FirstName + " " + r.User.LastName,
                Reviewer = db.Users.Where(u => u.Id == r.ReviewedByUserId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefault()
            })
            .ToListAsync(ct);

        return rows.Select(x =>
        {
            var r = x.Request;
            int? days = r.StartDate is { } s && r.EndDate is { } e ? e.DayNumber - s.DayNumber + 1 : null;
            return new RequestDto(r.Id, r.UserId, x.UserName, r.Type, r.Status, r.EventType, r.EventAt, r.LeaveKind,
                r.StartDate, r.EndDate, days, r.Reason, r.CreatedAt, x.Reviewer, r.ReviewedAt, r.ReviewNote);
        }).ToList();
    }
}
