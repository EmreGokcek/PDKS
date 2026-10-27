using Pdks.Domain.Attendance;
using Pdks.Domain.Enums;
using static Pdks.Domain.Enums.AttendanceEventType;

namespace Pdks.Tests;

public class AttendanceCalculatorTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
    private static readonly CalculatorRules Rules = new(WeeklyWorkMinutes: 45 * 60, DailyBreakMinutes: 60, WeekStartsOn: DayOfWeek.Monday);

    /// <summary>İstanbul saatiyle 2026 Ekim'de bir an. 26 Ekim Pazartesi.</summary>
    private static DateTimeOffset At(int day, int hour, int minute = 0) =>
        new(2026, 10, day, hour, minute, 0, TimeSpan.FromHours(3));

    private static EventPoint E(AttendanceEventType type, DateTimeOffset at) => new(type, at);

    private static AttendanceSummary Run(DateTimeOffset now, params EventPoint[] events) =>
        AttendanceCalculator.Summarize(events, now, Istanbul, Rules);

    [Fact]
    public void Full_day_deducts_break_from_work()
    {
        var s = Run(At(27, 20), E(CheckIn, At(27, 9)), E(BreakStart, At(27, 12)), E(BreakEnd, At(27, 13)), E(CheckOut, At(27, 18)));

        Assert.Equal(AttendanceState.Out, s.State);
        Assert.Equal(TimeSpan.FromHours(8), s.TodayWorked);
        Assert.Equal(TimeSpan.FromHours(1), s.TodayBreak);
        Assert.Equal(TimeSpan.Zero, s.BreakOverrun);
        Assert.True(s.BreakUsedToday);
    }

    [Fact]
    public void Open_break_counts_live_and_reports_overrun()
    {
        var s = Run(At(27, 13, 10), E(CheckIn, At(27, 9)), E(BreakStart, At(27, 12)));

        Assert.Equal(AttendanceState.OnBreak, s.State);
        Assert.Equal(At(27, 12), s.BreakStartedAt);
        Assert.Equal(TimeSpan.FromHours(3), s.TodayWorked);
        Assert.Equal(TimeSpan.Zero, s.BreakRemaining);
        Assert.Equal(TimeSpan.FromMinutes(10), s.BreakOverrun);
    }

    [Fact]
    public void Checking_out_during_break_ends_the_break()
    {
        var s = Run(At(27, 20), E(CheckIn, At(27, 9)), E(BreakStart, At(27, 12)), E(CheckOut, At(27, 12, 30)));

        Assert.Equal(TimeSpan.FromHours(3), s.TodayWorked);
        Assert.Equal(TimeSpan.FromMinutes(30), s.TodayBreak);
    }

    [Fact]
    public void Weekly_work_beyond_target_is_overtime()
    {
        var s = AttendanceCalculator.Summarize(
            [E(CheckIn, At(26, 8)), E(CheckOut, At(26, 20)), E(CheckIn, At(27, 8)), E(CheckOut, At(27, 20))],
            At(27, 21), Istanbul, Rules with { WeeklyWorkMinutes = 20 * 60 });

        Assert.Equal(new DateOnly(2026, 10, 26), s.WeekStart);
        Assert.Equal(TimeSpan.FromHours(24), s.WeekWorked);
        Assert.Equal(TimeSpan.FromHours(4), s.Overtime);
    }

    [Fact]
    public void Session_open_too_long_is_unclosed_and_not_counted()
    {
        var s = Run(At(27, 10), E(CheckIn, At(26, 9)));

        Assert.Equal(AttendanceState.Out, s.State);
        Assert.True(s.HasUnclosedSession);
        Assert.Equal(TimeSpan.Zero, s.WeekWorked);
    }

    [Fact]
    public void Night_shift_belongs_to_the_day_it_started()
    {
        var s = Run(At(27, 10), E(CheckIn, At(26, 22)), E(CheckOut, At(27, 6)));

        Assert.Equal(TimeSpan.Zero, s.TodayWorked);
        Assert.Equal(TimeSpan.FromHours(8), s.WeekDays[0].Worked);
    }

    [Fact]
    public void Check_in_without_check_out_marks_previous_session_unclosed()
    {
        var s = Run(At(27, 10), E(CheckIn, At(27, 8)), E(CheckIn, At(27, 9)));

        Assert.Equal(AttendanceState.Working, s.State);
        Assert.Equal(TimeSpan.FromHours(1), s.TodayWorked);
        Assert.True(s.HasUnclosedSession);
    }

    [Theory]
    [InlineData(DayOfWeek.Monday, 26)]
    [InlineData(DayOfWeek.Sunday, 25)]
    [InlineData(DayOfWeek.Saturday, 24)]
    public void Week_start_respects_setting(DayOfWeek startsOn, int expectedDay) =>
        Assert.Equal(new DateOnly(2026, 10, expectedDay), AttendanceCalculator.WeekStartOf(new DateOnly(2026, 10, 27), startsOn));
}

public class AttendanceRulesTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
    private static readonly CalculatorRules Rules = new(45 * 60, 60, DayOfWeek.Monday);
    private static DateTimeOffset At(int hour, int minute = 0) => new(2026, 10, 27, hour, minute, 0, TimeSpan.FromHours(3));

    private static AttendanceSummary State(params (AttendanceEventType Type, DateTimeOffset At)[] events) =>
        AttendanceCalculator.Summarize(events.Select(e => new EventPoint(e.Type, e.At)), At(14), Istanbul, Rules);

    [Fact]
    public void Out_can_only_check_in()
    {
        var s = State();
        Assert.Null(AttendanceRules.Validate(CheckIn, s));
        Assert.Equal("not_checked_in", AttendanceRules.Validate(BreakStart, s));
        Assert.Equal("not_on_break", AttendanceRules.Validate(BreakEnd, s));
        Assert.Equal("not_checked_in", AttendanceRules.Validate(CheckOut, s));
    }

    [Fact]
    public void Break_can_be_taken_only_once_a_day()
    {
        var s = State((CheckIn, At(9)), (BreakStart, At(12)), (BreakEnd, At(12, 20)));
        Assert.Equal("break_already_used", AttendanceRules.Validate(BreakStart, s));
        Assert.Equal("already_checked_in", AttendanceRules.Validate(CheckIn, s));
        Assert.Null(AttendanceRules.Validate(CheckOut, s));
    }

    [Fact]
    public void On_break_can_end_break_or_check_out()
    {
        var s = State((CheckIn, At(9)), (BreakStart, At(13, 30)));
        Assert.Null(AttendanceRules.Validate(BreakEnd, s));
        Assert.Null(AttendanceRules.Validate(CheckOut, s));
        Assert.Equal("already_on_break", AttendanceRules.Validate(BreakStart, s));
    }
}
