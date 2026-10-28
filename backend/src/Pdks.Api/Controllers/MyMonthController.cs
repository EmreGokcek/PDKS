using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Attendance;
using Pdks.Domain.Reports;
using Pdks.Infrastructure.Attendance;
using Pdks.Domain.Security;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Leave;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Reports;

namespace Pdks.Api.Controllers;

public record MyMonthDto(int Year, int Month, int WeeklyWorkMinutes, TimesheetRowDto Row, LeaveBalance Leave);

/// <summary>
/// "Benim ayım": personelin kendi aylık puantajı (yöneticinin gördüğüyle aynı hesap), bordro öncesi kontrol için.
/// Gelecek günler gösterilmez (yayınlanmamış plan sızmasın; ileri vardiyalar Vardiyalarım'da).
/// </summary>
[ApiController]
[Authorize(Policy = Perm.AttendanceSelf)]
public class MyMonthController(
    PdksDbContext db,
    ICurrentUser currentUser,
    MonthlyTimesheetService timesheets,
    LeaveService leave,
    AttendanceService attendance,
    TimeProvider time) : ControllerBase
{
    [HttpGet("api/me/month")]
    public async Task<ActionResult<MyMonthDto>> Get([FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        if (year is < 2000 or > 2100 || month is < 1 or > 12) return this.ApiError(400, "invalid_range", "Ay ya da yıl geçersiz.");
        var me = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);

        var sheet = await timesheets.BuildAsync([me], year, month, ct);
        var row = TimesheetDto.Create(sheet).Rows.Single();
        var cells = row.Cells.Select(c => c.Code is TimesheetCode.Planned ? c with { Code = TimesheetCode.None } : c).ToList();

        var today = AttendanceCalculator.LocalDate(time.GetUtcNow(), await attendance.TimeZoneForAsync(me.BranchId, ct));
        var balance = (await leave.BalancesAsync(db.Users.Where(u => u.Id == me.Id), today, ct)).Single();
        return new MyMonthDto(year, month, sheet.WeeklyWorkMinutes, row with { Cells = cells }, balance);
    }
}
