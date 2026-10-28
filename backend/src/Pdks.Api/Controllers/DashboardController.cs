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
    MonthlyTimesheetService timesheets,
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

    /// <summary>Aylık puantaj: kişi × gün kodları ve aylık toplamlar.</summary>
    [HttpGet("api/reports/monthly")]
    public async Task<ActionResult<TimesheetDto>> Monthly([FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        var sheet = await BuildTimesheetAsync(year, month, ct);
        return sheet is null ? InvalidMonth() : TimesheetDto.From(sheet);
    }

    /// <summary>Aylık puantajın Excel dosyası (Puantaj, Detay, Açıklamalar sayfaları).</summary>
    [HttpGet("api/reports/monthly/export")]
    public async Task<IActionResult> MonthlyExport([FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        var sheet = await BuildTimesheetAsync(year, month, ct);
        if (sheet is null) return InvalidMonth();

        var stream = new MemoryStream();
        TimesheetExcel.Write(sheet, stream);
        stream.Position = 0;
        return File(stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", TimesheetExcel.FileName(sheet));
    }

    private async Task<Pdks.Domain.Reports.Timesheet?> BuildTimesheetAsync(int year, int month, CancellationToken ct)
    {
        if (year is < 2000 or > 2100 || month is < 1 or > 12) return null;

        var first = new DateOnly(year, month, 1);
        var fromUtc = new DateTimeOffset(first.AddDays(-7).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var toUtc = new DateTimeOffset(first.AddMonths(1).AddDays(7).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);

        // Aktif personel + bu ayda kaydı olan pasif personel (ayrılanların son ayı da puantaja girsin)
        var users = await StaffScope()
            .Where(u => u.IsActive || db.AttendanceEvents.Any(e => e.UserId == u.Id && e.OccurredAt >= fromUtc && e.OccurredAt < toUtc))
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .ToListAsync(ct);

        return await timesheets.BuildAsync(users, year, month, ct);
    }

    private ObjectResult InvalidMonth() => this.ApiError(400, "invalid_range", "Ay ya da yıl geçersiz.");

    private IQueryable<User> StaffScope()
    {
        var query = db.Users.Where(u => u.Role == UserRole.Employee || u.Role == UserRole.Manager);
        return currentUser.Role == UserRole.Manager ? query.Where(u => u.BranchId == currentUser.BranchId) : query;
    }
}
