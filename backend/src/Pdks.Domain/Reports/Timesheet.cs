using Pdks.Domain.Attendance;
using Pdks.Domain.Enums;
using Pdks.Domain.Scheduling;

namespace Pdks.Domain.Reports;

/// <summary>Puantajda bir günün kodu.</summary>
public enum TimesheetCode
{
    /// <summary>Henüz bilgi yok (bugün sürüyor ya da plan yok, gelecek gün).</summary>
    None,
    /// <summary>Çalıştı; saat Hours alanında.</summary>
    Work,
    /// <summary>Gelecekte planlı çalışma.</summary>
    Planned,
    WeeklyOff,
    AnnualLeave,
    SickLeave,
    ExcusedLeave,
    /// <summary>Planı vardı, gelmedi.</summary>
    Absent,
    /// <summary>Planı yok, çalışmadı.</summary>
    Off
}

public record TimesheetCell(
    DateOnly Date,
    TimesheetCode Code,
    double Hours,
    bool Late,
    bool EarlyLeave,
    bool BreakOverrun,
    bool Unclosed,
    bool Unplanned);

public record TimesheetTotals(
    int WorkedDays,
    double WorkedHours,
    double PlannedHours,
    double OvertimeHours,
    int LateCount,
    int LateMinutes,
    int EarlyLeaveCount,
    int AbsentDays,
    int WeeklyOffDays,
    int AnnualLeaveDays,
    int SickLeaveDays,
    int ExcusedLeaveDays,
    double BreakOverrunHours,
    int UnclosedCount);

public record TimesheetRow(
    Guid UserId,
    string Name,
    string? EmployeeNumber,
    string? Position,
    IReadOnlyList<TimesheetCell> Cells,
    IReadOnlyList<DayRecord> Days,
    TimesheetTotals Totals);

public record Timesheet(
    string CompanyName,
    string? BranchName,
    int Year,
    int Month,
    DateOnly From,
    DateOnly To,
    int WeeklyWorkMinutes,
    DayOfWeek WeekStartsOn,
    TimeZoneInfo TimeZone,
    IReadOnlyList<TimesheetRow> Rows);

/// <summary>
/// Gün gün devam kayıtlarından aylık puantaj satırı üretir.
///
/// Fazla mesai haftalık hesaplanır (haftalık net çalışma − haftalık normal süre).
/// Ay sınırına denk gelen haftalarda haftanın fazla mesaisi, haftanın son gününün düştüğü aya yazılır;
/// bu yüzden hesap için ay aralığı, ayı kapsayan tam haftalara genişletilir (bkz. Range).
/// </summary>
public static class TimesheetBuilder
{
    /// <summary>Ayın günleri ve fazla mesai için gereken genişletilmiş (tam hafta) aralık.</summary>
    public static (DateOnly MonthStart, DateOnly MonthEnd, DateOnly From, DateOnly To) Range(int year, int month, DayOfWeek weekStartsOn)
    {
        var first = new DateOnly(year, month, 1);
        var last = first.AddMonths(1).AddDays(-1);
        var from = AttendanceCalculator.WeekStartOf(first, weekStartsOn);
        var to = AttendanceCalculator.WeekStartOf(last, weekStartsOn).AddDays(6);
        return (first, last, from, to);
    }

    public static TimesheetRow BuildRow(
        Guid userId, string name, string? employeeNumber, string? position,
        IReadOnlyList<DayRecord> days, int year, int month, DateOnly today,
        int weeklyWorkMinutes, DayOfWeek weekStartsOn, int defaultBreakMinutes)
    {
        var (first, last, _, _) = Range(year, month, weekStartsOn);
        var monthDays = days.Where(d => d.Date >= first && d.Date <= last).OrderBy(d => d.Date).ToList();
        var cells = monthDays.Select(d => Cell(d, today)).ToList();

        var weekly = TimeSpan.FromMinutes(weeklyWorkMinutes);
        var overtime = days
            .GroupBy(d => AttendanceCalculator.WeekStartOf(d.Date, weekStartsOn))
            .Where(g => g.Key.AddDays(6) >= first && g.Key.AddDays(6) <= last)
            .Select(g => g.Aggregate(TimeSpan.Zero, (a, d) => a + d.Worked))
            .Aggregate(TimeSpan.Zero, (a, w) => a + (w > weekly ? w - weekly : TimeSpan.Zero));

        var planned = monthDays
            .Where(d => d.Plan is { Kind: ShiftKind.Work })
            .Aggregate(TimeSpan.Zero, (a, d) => a + ShiftMath.NetDuration(d.Plan!.Start, d.Plan.End,
                TimeSpan.FromMinutes(d.Plan.BreakMinutes ?? defaultBreakMinutes)));

        var totals = new TimesheetTotals(
            WorkedDays: cells.Count(c => c.Code == TimesheetCode.Work),
            WorkedHours: monthDays.Sum(d => d.Worked.TotalHours),
            PlannedHours: planned.TotalHours,
            OvertimeHours: overtime.TotalHours,
            LateCount: monthDays.Count(d => d.LateMinutes > 0),
            LateMinutes: monthDays.Sum(d => d.LateMinutes),
            EarlyLeaveCount: monthDays.Count(d => d.EarlyLeaveMinutes > 0),
            AbsentDays: cells.Count(c => c.Code == TimesheetCode.Absent),
            WeeklyOffDays: cells.Count(c => c.Code == TimesheetCode.WeeklyOff),
            AnnualLeaveDays: cells.Count(c => c.Code == TimesheetCode.AnnualLeave),
            SickLeaveDays: cells.Count(c => c.Code == TimesheetCode.SickLeave),
            ExcusedLeaveDays: cells.Count(c => c.Code == TimesheetCode.ExcusedLeave),
            BreakOverrunHours: monthDays.Sum(d => d.BreakOverrun.TotalHours),
            UnclosedCount: monthDays.Count(d => d.HasUnclosedSession));

        return new TimesheetRow(userId, name, employeeNumber, position, cells, monthDays, totals);
    }

    public static TimesheetCell Cell(DayRecord d, DateOnly today)
    {
        var leave = d.Plan?.Kind switch
        {
            ShiftKind.WeeklyOff => TimesheetCode.WeeklyOff,
            ShiftKind.AnnualLeave => TimesheetCode.AnnualLeave,
            ShiftKind.SickLeave => TimesheetCode.SickLeave,
            ShiftKind.ExcusedLeave => TimesheetCode.ExcusedLeave,
            _ => (TimesheetCode?)null
        };

        var code = d.Date > today
            ? leave ?? (d.Plan is { Kind: ShiftKind.Work } ? TimesheetCode.Planned : TimesheetCode.None)
            : d.Status switch
            {
                DayStatus.Present or DayStatus.InProgress or DayStatus.Unplanned => TimesheetCode.Work,
                DayStatus.OnLeave => leave ?? TimesheetCode.Off,
                DayStatus.Absent => TimesheetCode.Absent,
                DayStatus.Upcoming => TimesheetCode.Planned,
                DayStatus.NotArrived => TimesheetCode.None,
                _ => TimesheetCode.Off
            };

        return new TimesheetCell(
            d.Date, code, code == TimesheetCode.Work ? d.Worked.TotalHours : 0,
            d.LateMinutes > 0, d.EarlyLeaveMinutes > 0, d.BreakOverrun > TimeSpan.Zero, d.HasUnclosedSession,
            d.Status == DayStatus.Unplanned || (code == TimesheetCode.Work && leave is not null));
    }

    /// <summary>Puantaj kodunun Türkçe kısaltması (Excel ve baskıda kullanılır).</summary>
    public static string ShortCode(TimesheetCode code) => code switch
    {
        TimesheetCode.WeeklyOff => "HT",
        TimesheetCode.AnnualLeave => "Yİ",
        TimesheetCode.SickLeave => "R",
        TimesheetCode.ExcusedLeave => "Mİ",
        TimesheetCode.Absent => "D",
        TimesheetCode.Off => "–",
        _ => ""
    };
}
