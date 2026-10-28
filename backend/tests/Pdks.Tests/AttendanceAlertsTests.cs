using Pdks.Domain.Attendance;
using Pdks.Domain.Enums;
using static Pdks.Domain.Enums.AttendanceEventType;

namespace Pdks.Tests;

public class AttendanceAlertsTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
    private static readonly DateOnly Day = new(2026, 10, 28);
    private static readonly DayPlan NineToSix = new(ShiftKind.Work, new TimeOnly(9, 0), new TimeOnly(18, 0), 60);

    private static DateTimeOffset At(int hour, int minute = 0) => new(2026, 10, 28, hour, minute, 0, TimeSpan.FromHours(3));

    private static DayRecord Day_(DayPlan? plan, DateTimeOffset now, params (AttendanceEventType Type, DateTimeOffset At)[] events)
    {
        var plans = new Dictionary<DateOnly, DayPlan>();
        if (plan is not null) plans[Day] = plan;
        return DailyReport.Build(events.Select(e => new EventPoint(e.Type, e.At)), plans, Day, Day, now, Istanbul, 5, 60)[0];
    }

    [Theory]
    [InlineData(9, 10, false)] // tolerans geçti ama uyarı süresi (15 dk) dolmadı
    [InlineData(9, 15, true)]
    [InlineData(17, 0, true)]
    public void Not_arrived_alert_waits_for_the_configured_minutes(int hour, int minute, bool expected)
    {
        var now = At(hour, minute);
        Assert.Equal(expected, AttendanceAlerts.NotArrivedDue(Day_(NineToSix, now), now, Istanbul, 5, 15));
    }

    [Fact]
    public void No_not_arrived_alert_when_off_checked_in_or_disabled()
    {
        var now = At(10);
        Assert.False(AttendanceAlerts.NotArrivedDue(Day_(null, now), now, Istanbul, 5, 15));
        Assert.False(AttendanceAlerts.NotArrivedDue(Day_(new DayPlan(ShiftKind.AnnualLeave, default, default, null), now), now, Istanbul, 5, 15));
        Assert.False(AttendanceAlerts.NotArrivedDue(Day_(NineToSix, now, (CheckIn, At(9, 40))), now, Istanbul, 5, 15));
        Assert.False(AttendanceAlerts.NotArrivedDue(Day_(NineToSix, now), now, Istanbul, 5, 0));
        // Tolerans uyarı süresinden uzunsa tolerans beklenir.
        Assert.False(AttendanceAlerts.NotArrivedDue(Day_(NineToSix, At(9, 20)), At(9, 20), Istanbul, 30, 15));
    }

    [Fact]
    public void Break_overrun_alert_fires_while_still_on_break()
    {
        var now = At(13, 5);
        var day = Day_(NineToSix, now, (CheckIn, At(9)), (BreakStart, At(12)));
        Assert.True(day.BreakOverrun >= TimeSpan.FromMinutes(1));
        Assert.True(AttendanceAlerts.BreakOverrunDue(AttendanceState.OnBreak, day, enabled: true));
        Assert.False(AttendanceAlerts.BreakOverrunDue(AttendanceState.OnBreak, day, enabled: false));
        Assert.False(AttendanceAlerts.BreakOverrunDue(AttendanceState.Working, day, enabled: true));

        var withinAllowance = Day_(NineToSix, At(12, 30), (CheckIn, At(9)), (BreakStart, At(12)));
        Assert.False(AttendanceAlerts.BreakOverrunDue(AttendanceState.OnBreak, withinAllowance, enabled: true));
    }
}
