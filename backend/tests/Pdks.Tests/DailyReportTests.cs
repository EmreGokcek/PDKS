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
}
