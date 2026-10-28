using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Api.Common;
using Pdks.Domain.Attendance;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Security;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Leave;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

public record HolidayDto(Guid Id, DateOnly Date, string Name, bool IsHalfDay);
public record SaveHolidayRequest(DateOnly Date, [Required, MaxLength(100)] string Name, bool IsHalfDay);
public record AdjustmentDto(Guid Id, int Days, string Reason, string? CreatedBy, DateTimeOffset CreatedAt);
public record CreateAdjustmentRequest(Guid UserId, [Range(-365, 365)] int Days, [Required, MinLength(3), MaxLength(300)] string Reason);
public record LeavePreviewDto(int Days, int? Available, int Overlap);
public record CalendarDayDto(DateOnly Date, ShiftKind Kind, bool Pending);
public record CalendarPersonDto(Guid UserId, string Name, List<CalendarDayDto> Days);
public record LeaveCalendarDto(DateOnly From, DateOnly To, List<HolidayDto> Holidays, List<CalendarPersonDto> People);

/// <summary>Resmi tatiller, yıllık izin bakiyeleri ve ekip izin takvimi.</summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
public class LeaveController(
    PdksDbContext db,
    ICurrentUser currentUser,
    HolidayService holidays,
    LeaveService leave,
    AttendanceService attendance,
    AuditLogger audit,
    TimeProvider time) : ControllerBase
{
    private static readonly ShiftKind[] LeaveKinds = [ShiftKind.AnnualLeave, ShiftKind.SickLeave, ShiftKind.ExcusedLeave];

    // ---- Resmi tatiller ----

    [HttpGet("api/holidays")]
    public async Task<List<HolidayDto>> Holidays([FromQuery] int? year, CancellationToken ct)
    {
        var y = year ?? (await TodayAsync(ct)).Year;
        return (await holidays.RangeAsync(new DateOnly(y, 1, 1), new DateOnly(y, 12, 31), ct)).Select(ToDto).ToList();
    }

    [HttpPost("api/holidays"), Authorize(Policy = Perm.LeaveManage)]
    public async Task<ActionResult<HolidayDto>> AddHoliday(SaveHolidayRequest request, CancellationToken ct)
    {
        await holidays.EnsureYearsAsync([request.Date.Year], ct);
        if (await db.PublicHolidays.AnyAsync(h => h.Date == request.Date, ct))
            return this.ApiError(409, "holiday_exists", "Bu tarihte zaten bir tatil var.");
        var h = new PublicHoliday { Date = request.Date, Name = request.Name.Trim(), IsHalfDay = request.IsHalfDay };
        db.PublicHolidays.Add(h);
        audit.Log("holiday.created", nameof(PublicHoliday), h.Id, newValues: new { h.Date, h.Name, h.IsHalfDay });
        await db.SaveChangesAsync(ct);
        return ToDto(h);
    }

    [HttpPut("api/holidays/{id:guid}"), Authorize(Policy = Perm.LeaveManage)]
    public async Task<ActionResult<HolidayDto>> UpdateHoliday(Guid id, SaveHolidayRequest request, CancellationToken ct)
    {
        var h = await db.PublicHolidays.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (h is null) return this.NotFoundError();
        if (request.Date != h.Date && await db.PublicHolidays.AnyAsync(x => x.Date == request.Date, ct))
            return this.ApiError(409, "holiday_exists", "Bu tarihte zaten bir tatil var.");
        var old = new { h.Date, h.Name, h.IsHalfDay };
        h.Date = request.Date;
        h.Name = request.Name.Trim();
        h.IsHalfDay = request.IsHalfDay;
        audit.Log("holiday.updated", nameof(PublicHoliday), h.Id, old, new { h.Date, h.Name, h.IsHalfDay });
        await db.SaveChangesAsync(ct);
        return ToDto(h);
    }

    [HttpDelete("api/holidays/{id:guid}"), Authorize(Policy = Perm.LeaveManage)]
    public async Task<IActionResult> DeleteHoliday(Guid id, CancellationToken ct)
    {
        var h = await db.PublicHolidays.FirstOrDefaultAsync(x => x.Id == id, ct);
        if (h is null) return this.NotFoundError();
        db.PublicHolidays.Remove(h);
        audit.Log("holiday.deleted", nameof(PublicHoliday), h.Id, new { h.Date, h.Name });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ---- Bakiyeler ----

    /// <summary>Kişinin kendi yıllık izin bakiyesi.</summary>
    [HttpGet("api/me/leave-balance"), Authorize(Policy = Perm.AttendanceSelf)]
    public async Task<LeaveBalance> MyBalance(CancellationToken ct) =>
        (await leave.BalancesAsync(db.Users.Where(u => u.Id == currentUser.UserId), await TodayAsync(ct), ct)).Single();

    /// <summary>İzin talebi formu için: düşülecek gün, kullanılabilir bakiye, aynı günlerde izinli ekip arkadaşı sayısı.</summary>
    [HttpGet("api/me/leave-preview"), Authorize(Policy = Perm.AttendanceSelf)]
    public async Task<ActionResult<LeavePreviewDto>> Preview([FromQuery] ShiftKind kind, [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > 60) return this.ApiError(400, "invalid_range", "Tarih aralığı geçersiz.");
        var me = await db.Users.AsNoTracking().FirstAsync(u => u.Id == currentUser.UserId, ct);

        var days = kind == ShiftKind.AnnualLeave
            ? await leave.CountDaysAsync(me.Id, from, to, ct: ct)
            : to.DayNumber - from.DayNumber + 1;
        int? available = kind == ShiftKind.AnnualLeave
            ? (await leave.BalancesAsync(db.Users.Where(u => u.Id == me.Id), await TodayAsync(ct), ct)).Single().Available
            : null;

        // Kimin hangi izinde olduğu (ör. raporlu) gösterilmez; yalnızca aynı günlerde izinli kişi sayısı.
        var overlap = await db.Shifts
            .Where(s => s.UserId != me.Id && s.BranchId == me.BranchId && s.Date >= from && s.Date <= to && LeaveKinds.Contains(s.Kind))
            .Select(s => s.UserId).Distinct().CountAsync(ct);
        return new LeavePreviewDto(days, available, overlap);
    }

    /// <summary>Ekibin izin bakiyeleri (müdür kendi şubesi, İK ve yönetici tüm firma).</summary>
    [HttpGet("api/leave/balances"), Authorize(Policy = Perm.RequestsReview)]
    public async Task<List<LeaveBalance>> Balances(CancellationToken ct) =>
        await leave.BalancesAsync(People().Where(u => u.IsActive), await TodayAsync(ct), ct);

    [HttpGet("api/leave/adjustments"), Authorize(Policy = Perm.RequestsReview)]
    public async Task<ActionResult<List<AdjustmentDto>>> Adjustments([FromQuery] Guid userId, CancellationToken ct)
    {
        if (!await People().AnyAsync(u => u.Id == userId, ct)) return this.NotFoundError("Personel bulunamadı.");
        return await db.LeaveAdjustments.Where(a => a.UserId == userId).OrderByDescending(a => a.CreatedAt)
            .Select(a => new AdjustmentDto(a.Id, a.Days, a.Reason,
                db.Users.Where(u => u.Id == a.CreatedById).Select(u => u.FirstName + " " + u.LastName).FirstOrDefault(), a.CreatedAt))
            .ToListAsync(ct);
    }

    /// <summary>Bakiyeye elle düzeltme (devreden izin, sistem dışı kullanılan izin vb.). Gerekçe zorunlu.</summary>
    [HttpPost("api/leave/adjustments"), Authorize(Policy = Perm.LeaveManage)]
    public async Task<ActionResult<AdjustmentDto>> AddAdjustment(CreateAdjustmentRequest request, CancellationToken ct)
    {
        if (request.Days == 0) return this.ApiError(400, "adjustment_zero", "Gün sayısı sıfır olamaz.");
        if (!await People().AnyAsync(u => u.Id == request.UserId, ct)) return this.NotFoundError("Personel bulunamadı.");
        if (request.UserId == currentUser.UserId) return this.ApiError(403, "cannot_edit_own", "Kendi bakiyeni düzeltemezsin.");

        var a = new LeaveAdjustment { UserId = request.UserId, Days = request.Days, Reason = request.Reason.Trim(), CreatedById = currentUser.UserId!.Value };
        db.LeaveAdjustments.Add(a);
        audit.Log("leave.adjusted", nameof(User), request.UserId, newValues: new { a.Days }, reason: a.Reason);
        await db.SaveChangesAsync(ct);
        return new AdjustmentDto(a.Id, a.Days, a.Reason, null, a.CreatedAt);
    }

    // ---- Ekip izin takvimi ----

    /// <summary>Plandaki izinler ve bekleyen izin talepleri, gün gün.</summary>
    [HttpGet("api/leave/calendar"), Authorize(Policy = Perm.RequestsReview)]
    public async Task<ActionResult<LeaveCalendarDto>> Calendar([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > 62) return this.ApiError(400, "invalid_range", "Tarih aralığı geçersiz.");

        var people = await People().Where(u => u.IsActive).OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new { u.Id, Name = u.FirstName + " " + u.LastName }).ToListAsync(ct);
        var ids = people.Select(p => p.Id).ToList();

        var planned = await db.Shifts.Where(s => ids.Contains(s.UserId) && s.Date >= from && s.Date <= to && LeaveKinds.Contains(s.Kind))
            .Select(s => new { s.UserId, s.Date, s.Kind }).ToListAsync(ct);
        var pending = await db.StaffRequests
            .Where(r => ids.Contains(r.UserId) && r.Status == RequestStatus.Pending && r.Type == RequestType.Leave
                        && r.StartDate <= to && r.EndDate >= from)
            .Select(r => new { r.UserId, Start = r.StartDate!.Value, End = r.EndDate!.Value, Kind = r.LeaveKind!.Value })
            .ToListAsync(ct);
        var holidayList = await holidays.RangeAsync(from, to, ct);

        var result = people.Select(p =>
        {
            var days = planned.Where(s => s.UserId == p.Id).Select(s => new CalendarDayDto(s.Date, s.Kind, false)).ToList();
            foreach (var r in pending.Where(r => r.UserId == p.Id))
                for (var d = r.Start < from ? from : r.Start; d <= (r.End > to ? to : r.End); d = d.AddDays(1))
                    if (days.All(x => x.Date != d)) days.Add(new CalendarDayDto(d, r.Kind, true));
            return new CalendarPersonDto(p.Id, p.Name, days.OrderBy(d => d.Date).ToList());
        }).ToList();

        return new LeaveCalendarDto(from, to, holidayList.Select(ToDto).ToList(), result);
    }

    private IQueryable<User> People()
    {
        var q = db.Users.Where(u => RolePermissions.Workforce.Contains(u.Role));
        return currentUser.Role is { } r && RolePermissions.IsCompanyWide(r) ? q : q.Where(u => u.BranchId == currentUser.BranchId);
    }

    private async Task<DateOnly> TodayAsync(CancellationToken ct) =>
        AttendanceCalculator.LocalDate(time.GetUtcNow(), await attendance.TimeZoneForAsync(currentUser.BranchId, ct));

    private static HolidayDto ToDto(PublicHoliday h) => new(h.Id, h.Date, h.Name, h.IsHalfDay);
}
