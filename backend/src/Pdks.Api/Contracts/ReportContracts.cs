using Pdks.Domain.Attendance;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Reports;

namespace Pdks.Api.Contracts;

public record DayPlanDto(ShiftKind Kind, TimeOnly StartTime, TimeOnly EndTime, int? BreakMinutes, string? Name, string? Color);

public record DayRecordDto(
    DateOnly Date,
    DayStatus Status,
    DayPlanDto? Plan,
    DateTimeOffset? FirstIn,
    DateTimeOffset? LastOut,
    int WorkedSeconds,
    int BreakSeconds,
    int BreakAllowanceSeconds,
    int BreakOverrunSeconds,
    int LateMinutes,
    int EarlyLeaveMinutes,
    bool HasUnclosedSession)
{
    public static DayRecordDto From(DayRecord d) => new(
        d.Date, d.Status,
        d.Plan is null ? null : new DayPlanDto(d.Plan.Kind, d.Plan.Start, d.Plan.End, d.Plan.BreakMinutes, d.Plan.Name, d.Plan.Color),
        d.FirstIn, d.LastOut,
        Sec(d.Worked), Sec(d.Break), Sec(d.BreakAllowance), Sec(d.BreakOverrun),
        d.LateMinutes, d.EarlyLeaveMinutes, d.HasUnclosedSession);

    private static int Sec(TimeSpan t) => (int)Math.Round(t.TotalSeconds);
}

public record LivePersonDto(
    Guid UserId,
    string Name,
    UserRole Role,
    AttendanceState State,
    DateTimeOffset? SessionStartedAt,
    DateTimeOffset? BreakStartedAt,
    DayRecordDto Today);

public record LiveDashboardDto(DateOnly Date, DateTimeOffset ServerNow, int ToleranceMinutes, List<LivePersonDto> People);

public record ReportPersonDto(
    Guid UserId,
    string Name,
    UserRole Role,
    bool IsActive,
    int WorkedSeconds,
    int PlannedSeconds,
    int OvertimeSeconds,
    int BreakOverrunSeconds,
    int LateCount,
    int LateMinutes,
    int EarlyLeaveCount,
    int AbsentCount,
    int LeaveCount,
    int PresentDays,
    int UnplannedDays,
    int UnclosedCount)
{
    public static ReportPersonDto From(PersonDays p, ReportContext ctx)
    {
        var days = p.Days;
        return new ReportPersonDto(
            p.User.Id, p.User.FullName, p.User.Role, p.User.IsActive,
            (int)days.Sum(d => d.Worked.TotalSeconds),
            (int)AttendanceReports.PlannedNet(days, ctx.Rules.DailyBreakMinutes).TotalSeconds,
            (int)AttendanceReports.Overtime(days, ctx.Rules).TotalSeconds,
            (int)days.Sum(d => d.BreakOverrun.TotalSeconds),
            days.Count(d => d.LateMinutes > 0),
            days.Sum(d => d.LateMinutes),
            days.Count(d => d.EarlyLeaveMinutes > 0),
            days.Count(d => d.Status == DayStatus.Absent),
            days.Count(d => d.Status == DayStatus.OnLeave),
            days.Count(d => d.Status is DayStatus.Present or DayStatus.InProgress),
            days.Count(d => d.Status == DayStatus.Unplanned),
            days.Count(d => d.HasUnclosedSession));
    }
}

public record TeamReportDto(DateOnly From, DateOnly To, int WeeklyWorkMinutes, DayOfWeek WeekStartsOn, List<ReportPersonDto> People);

public record PersonReportDto(ReportPersonDto Summary, List<DayRecordDto> Days);
