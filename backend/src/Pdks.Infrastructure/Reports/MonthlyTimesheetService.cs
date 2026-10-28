using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Entities;
using Pdks.Domain.Reports;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Reports;

/// <summary>Seçilen kişiler için aylık puantajı hazırlar.</summary>
public class MonthlyTimesheetService(PdksDbContext db, AttendanceReports reports)
{
    public async Task<Timesheet> BuildAsync(IReadOnlyList<User> users, int year, int month, CancellationToken ct = default)
    {
        var rules = await db.WorkRules.AsNoTracking().FirstOrDefaultAsync(ct) ?? new WorkRule();
        var (first, last, from, to) = TimesheetBuilder.Range(year, month, rules.WeekStartsOn);

        var ctx = await reports.BuildAsync(users, from, to, ct);
        var today = AttendanceReports.Today(ctx.Now, ctx.Tz);

        var company = await db.Companies.Select(c => c.Name).FirstOrDefaultAsync(ct) ?? string.Empty;
        var branchId = users.Select(u => u.BranchId).FirstOrDefault(b => b != null);
        var branch = branchId is null ? null : await db.Branches.Where(b => b.Id == branchId).Select(b => b.Name).FirstOrDefaultAsync(ct);

        var rows = ctx.People.Select(p => TimesheetBuilder.BuildRow(
            p.User.Id, p.User.FullName, p.User.EmployeeNumber, p.User.Position, p.Days, year, month, today,
            rules.WeeklyWorkMinutes, rules.WeekStartsOn, rules.DailyBreakMinutes)).ToList();

        return new Timesheet(company, branch, year, month, first, last, rules.WeeklyWorkMinutes, rules.WeekStartsOn, ctx.Tz, rows);
    }
}
