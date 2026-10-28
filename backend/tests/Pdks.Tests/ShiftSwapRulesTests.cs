using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Scheduling;

namespace Pdks.Tests;

public class ShiftSwapRulesTests
{
    private static readonly Guid A = Guid.NewGuid(), B = Guid.NewGuid();
    private static readonly DateOnly D = new(2026, 11, 3);

    private static Shift Work(Guid user, DateOnly date, int start, int end) => new()
    {
        UserId = user, Date = date, Kind = ShiftKind.Work, StartTime = new TimeOnly(start, 0), EndTime = new TimeOnly(end % 24, 0)
    };

    [Fact]
    public void Swaps_content_and_keeps_owners()
    {
        var mine = Work(A, D, 9, 18);
        var theirs = new Shift { UserId = B, Date = D, Kind = ShiftKind.WeeklyOff };
        ShiftSwapRules.Apply(mine, theirs, B);

        Assert.Equal(A, mine.UserId);
        Assert.Equal(ShiftKind.WeeklyOff, mine.Kind);
        Assert.Equal(B, theirs.UserId);
        Assert.Equal(ShiftKind.Work, theirs.Kind);
        Assert.Equal(new TimeOnly(9, 0), theirs.StartTime);
    }

    [Fact]
    public void Shift_moves_to_colleague_without_a_plan_that_day()
    {
        var mine = Work(A, D, 9, 18);
        ShiftSwapRules.Apply(mine, null, B);
        Assert.Equal(B, mine.UserId);
    }

    [Fact]
    public void Leave_days_cannot_be_swapped()
    {
        Assert.True(ShiftSwapRules.IsSwappable(ShiftKind.WeeklyOff));
        Assert.True(ShiftSwapRules.IsSwappable(null));
        Assert.False(ShiftSwapRules.IsSwappable(ShiftKind.SickLeave));
        Assert.False(ShiftSwapRules.IsSwappable(ShiftKind.AnnualLeave));
    }

    [Fact]
    public void Detects_overlap_with_night_shift_of_previous_day()
    {
        var night = Work(B, D.AddDays(-1), 22, 30); // 22:00–06:00
        var morning = Work(B, D, 5, 13);
        Assert.True(ShiftSwapRules.OverlapsNeighbours(morning, [night]));
        Assert.False(ShiftSwapRules.OverlapsNeighbours(Work(B, D, 9, 18), [night]));
    }
}
