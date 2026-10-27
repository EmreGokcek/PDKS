using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Reports;

namespace Pdks.Api.Controllers;

/// <summary>
/// Müdür panosu ve ekip süre raporları. Müdür yalnızca kendi şubesini, admin herkesi görür.
/// Kapsam: Personel ve Müdür rolleri.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.AdminOrManager)]
public class DashboardController(
    PdksDbContext db,
    ICurrentUser currentUser,
    AttendanceService attendance,
    AttendanceReports reports,
    TimeProvider time) : ControllerBase
{
    private const int MaxRangeDays = 62;

    /// <summary>Bugün kim içeride, kim molada, kim gelmedi, kim geç kaldı.</summary>
    [HttpGet("api/dashboard/live")]
    public async Task<ActionResult<LiveDashboardDto>> Live(CancellationToken ct)
    {
        var tz = await attendance.TimeZoneForAsync(currentUser.BranchId, ct);
        var today = AttendanceReports.Today(time.GetUtcNow(), tz);

        var users = await StaffScope().Where(u => u.IsActive).OrderBy(u => u.FirstName).ThenBy(u => u.LastName).ToListAsync(ct);
        var ctx = await reports.BuildAsync(users, today, today, ct);

        return new LiveDashboardDto(today, ctx.Now, ctx.Rules.LateToleranceMinutes, ctx.People
            .Select(p => new LivePersonDto(p.User.Id, p.User.FullName, p.User.Role, p.State, p.SessionStartedAt, p.BreakStartedAt,
                DayRecordDto.From(p.Days[0])))
            .ToList());
    }

    /// <summary>Seçilen aralıkta kişi başına çalışma, fazla mesai, geç kalma, devamsızlık özetleri.</summary>
    [HttpGet("api/reports/attendance")]
    public async Task<ActionResult<TeamReportDto>> Team([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > MaxRangeDays)
            return this.ApiError(400, "invalid_range", "Tarih aralığı geçersiz.");

        var users = await StaffScope()
            .Where(u => u.IsActive || db.AttendanceEvents.Any(e => e.UserId == u.Id))
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .ToListAsync(ct);
        var ctx = await reports.BuildAsync(users, from, to, ct);

        return new TeamReportDto(from, to, ctx.Rules.WeeklyWorkMinutes, ctx.Rules.WeekStartsOn,
            ctx.People.Select(p => ReportPersonDto.From(p, ctx)).ToList());
    }

    /// <summary>Bir kişinin gün gün devam kaydı.</summary>
    [HttpGet("api/reports/attendance/{userId:guid}")]
    public async Task<ActionResult<PersonReportDto>> Person(Guid userId, [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > MaxRangeDays)
            return this.ApiError(400, "invalid_range", "Tarih aralığı geçersiz.");

        var user = await StaffScope().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return this.NotFoundError("Personel bulunamadı.");

        var ctx = await reports.BuildAsync([user], from, to, ct);
        var person = ctx.People[0];
        return new PersonReportDto(ReportPersonDto.From(person, ctx), person.Days.Select(DayRecordDto.From).ToList());
    }

    private IQueryable<User> StaffScope()
    {
        var query = db.Users.Where(u => u.Role == UserRole.Employee || u.Role == UserRole.Manager);
        return currentUser.Role == UserRole.Manager ? query.Where(u => u.BranchId == currentUser.BranchId) : query;
    }
}
