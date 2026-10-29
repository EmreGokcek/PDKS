using Pdks.Domain.Attendance;
using Pdks.Domain.Enums;
using static Pdks.Domain.Enums.AttendanceEventType;

namespace Pdks.Tests;

public class DailyReportTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
    private static readonly DateOnly Day = new(2026, 10, 28);
    private static readonly DayPlan NineToSix = new(ShiftKind.Work, new TimeOnly(9, 0), new TimeOnly(18, 0), null);

    private static DateTimeOffset At(int hour, int minute = 0, int day = 28) =>
        new(2026, 10, day, hour, minute, 0, TimeSpan.FromHours(3));

    private static DayRecord Run(DayPlan? plan, DateTimeOffset now, params (AttendanceEventType Type, DateTimeOffset At)[] events)
    {
        var plans = new Dictionary<DateOnly, DayPlan>();
        if (plan is not null) plans[Day] = plan;
        return DailyReport.Build(events.Select(e => new EventPoint(e.Type, e.At)), plans, Day, Day, now, Istanbul,
            toleranceMinutes: 5, defaultBreakMinutes: 60)[0];
    }

    [Fact]
    public void Late_arrival_early_leave_and_break_overrun()
    {
        var r = Run(NineToSix, At(20), (CheckIn, At(9, 12)), (BreakStart, At(12)), (BreakEnd, At(13, 10)), (CheckOut, At(17, 30)));
        Assert.Equal(DayStatus.Present, r.Status);
        Assert.Equal(12, r.LateMinutes);
        Assert.Equal(30, r.EarlyLeaveMinutes);
        Assert.Equal(TimeSpan.FromMinutes(10), r.BreakOverrun);
    }

    [Fact]
    public void Arrival_within_tolerance_is_not_late()
    {
        var r = Run(NineToSix, At(10), (CheckIn, At(9, 4)));
        Assert.Equal(0, r.LateMinutes);
        Assert.Equal(DayStatus.InProgress, r.Status);
        Assert.Null(r.LastOut);
    }

    [Theory]
    [InlineData(8, 50, DayStatus.Upcoming)]
    [InlineData(9, 10, DayStatus.NotArrived)]
    [InlineData(19, 0, DayStatus.Absent)]
    public void Without_check_in_status_follows_the_clock(int hour, int minute, DayStatus expected) =>
        Assert.Equal(expected, Run(NineToSix, At(hour, minute)).Status);

    [Fact]
    public void Leave_off_and_unplanned_days()
    {
        Assert.Equal(DayStatus.OnLeave, Run(new DayPlan(ShiftKind.AnnualLeave, default, default, null), At(12)).Status);
        Assert.Equal(DayStatus.Off, Run(null, At(12)).Status);
        Assert.Equal(DayStatus.Unplanned, Run(null, At(13), (CheckIn, At(9)), (CheckOut, At(12))).Status);
    }

    [Fact]
    public void Shift_specific_break_is_used_for_overrun()
    {
        var r = Run(NineToSix with { BreakMinutes = 30 }, At(20), (CheckIn, At(9)), (BreakStart, At(12)), (BreakEnd, At(13, 10)), (CheckOut, At(18)));
        Assert.Equal(TimeSpan.FromMinutes(40), r.BreakOverrun);
    }

    [Fact]
    public void Night_shift_is_measured_across_midnight()
    {
        var night = new DayPlan(ShiftKind.Work, new TimeOnly(22, 0), new TimeOnly(6, 0), null);
        var r = Run(night, At(8, 0, 29), (CheckIn, At(22, 20)), (CheckOut, At(6, 0, 29)));
        Assert.Equal(20, r.LateMinutes);
        Assert.Equal(0, r.EarlyLeaveMinutes);
        Assert.Equal(TimeSpan.FromMinutes(460), r.Worked);
    }

    private static IReadOnlyList<DayRecord> RunRange(Dictionary<DateOnly, DayPlan> plans, DateTimeOffset now, params (AttendanceEventType Type, DateTimeOffset At)[] events) =>
        DailyReport.Build(events.Select(e => new EventPoint(e.Type, e.At)), plans, Day, Day.AddDays(1), now, Istanbul,
            toleranceMinutes: 5, defaultBreakMinutes: 60);

    [Fact]
    public void Early_check_in_for_midnight_shift_counts_for_the_shift_day()
    {
        // 29'u 00:00–08:00 vardiyası; 28'i hafta tatili. 23:55'te giriş, 08:00'de çıkış.
        var plans = new Dictionary<DateOnly, DayPlan>
        {
            [Day] = new(ShiftKind.WeeklyOff, default, default, null),
            [Day.AddDays(1)] = new(ShiftKind.Work, new TimeOnly(0, 0), new TimeOnly(8, 0), 0),
        };
        var days = RunRange(plans, At(9, 0, 29), (CheckIn, At(23, 55)), (CheckOut, At(8, 0, 29)));

        Assert.Equal(DayStatus.OnLeave, days[0].Status); // hafta tatili boş kalır, "planlanmadan çalıştı" olmaz
        Assert.Equal(TimeSpan.Zero, days[0].Worked);
        Assert.Equal(DayStatus.Present, days[1].Status);
        Assert.Equal(0, days[1].LateMinutes);
        Assert.Equal(TimeSpan.FromMinutes(485), days[1].Worked);
    }

    [Fact]
    public void Late_evening_work_on_own_shift_stays_on_that_day()
    {
        // 28'i 16:00–00:00, 29'u 00:00–08:00 (art arda). 15:55 girişi 28'ine aittir.
        var plans = new Dictionary<DateOnly, DayPlan>
        {
            [Day] = new(ShiftKind.Work, new TimeOnly(16, 0), new TimeOnly(0, 0), 0),
            [Day.AddDays(1)] = new(ShiftKind.Work, new TimeOnly(0, 0), new TimeOnly(8, 0), 0),
        };
        var days = RunRange(plans, At(23, 59), (CheckIn, At(15, 55)), (CheckOut, At(23, 58)));
        Assert.Equal(DayStatus.Present, days[0].Status);
        Assert.Equal(TimeSpan.Zero, days[1].Worked);
    }

    [Fact]
    public void Check_in_long_before_next_day_shift_is_not_moved()
    {
        // 29'u 06:00 vardiyası; 28'i 20:00 girişi (10 saat önce) taşınmaz.
        var plans = new Dictionary<DateOnly, DayPlan> { [Day.AddDays(1)] = new(ShiftKind.Work, new TimeOnly(6, 0), new TimeOnly(14, 0), 0) };
        var days = RunRange(plans, At(23), (CheckIn, At(20)), (CheckOut, At(22)));
        Assert.Equal(DayStatus.Unplanned, days[0].Status);
    }
}
