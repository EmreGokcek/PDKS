using Pdks.Domain.Scheduling;

namespace Pdks.Tests;

public class ShiftMathTests
{
    private static TimeOnly T(int h, int m = 0) => new(h, m);
    private static readonly DateOnly Mon = new(2026, 10, 26);

    [Theory]
    [InlineData(8, 16, 8)]
    [InlineData(16, 0, 8)]   // 16:00–00:00
    [InlineData(22, 6, 8)]   // gece vardiyası
    [InlineData(9, 18, 9)]
    public void Duration_handles_overnight(int start, int end, int hours) =>
        Assert.Equal(TimeSpan.FromHours(hours), ShiftMath.Duration(T(start), T(end)));

    [Fact]
    public void Night_shift_overlaps_next_morning_shift()
    {
        Assert.True(ShiftMath.Overlaps((Mon, T(22), T(6)), (Mon.AddDays(1), T(5), T(13))));
        Assert.False(ShiftMath.Overlaps((Mon, T(22), T(6)), (Mon.AddDays(1), T(6), T(14))));
        Assert.False(ShiftMath.Overlaps((Mon, T(8), T(16)), (Mon.AddDays(1), T(8), T(16))));
    }

    [Fact]
    public void Validation_rejects_zero_and_too_long()
    {
        Assert.Equal("shift_zero_length", ShiftMath.Validate(T(9), T(9)));
        Assert.Equal("shift_too_long", ShiftMath.Validate(T(6), T(23)));
        Assert.Null(ShiftMath.Validate(T(22), T(6)));
    }

    [Fact]
    public void Net_duration_deducts_break_once()
    {
        Assert.Equal(TimeSpan.FromHours(8), ShiftMath.NetDuration(T(9), T(18), TimeSpan.FromHours(1)));
        Assert.Equal(TimeSpan.FromMinutes(30), ShiftMath.NetDuration(T(9), T(9, 30), TimeSpan.FromHours(1)));
    }
}
