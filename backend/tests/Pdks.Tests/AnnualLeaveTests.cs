using Pdks.Domain.Leave;

namespace Pdks.Tests;

public class AnnualLeaveTests
{
    private static readonly DateOnly Today = new(2026, 10, 28);

    [Fact]
    public void No_annual_leave_before_the_first_year()
    {
        var a = AnnualLeave.Accrual(new DateOnly(2026, 1, 15), new DateOnly(1995, 5, 5), Today);
        Assert.Empty(a.Years);
        Assert.Equal(0, a.TotalEarned);
        Assert.Equal(new DateOnly(2027, 1, 15), a.NextEarnedOn);
        Assert.Equal(14, a.NextDays);
    }

    [Theory]
    [InlineData(1, 14)]
    [InlineData(5, 14)]
    [InlineData(6, 20)]
    [InlineData(14, 20)]
    [InlineData(15, 26)]
    [InlineData(30, 26)]
    public void Days_by_service_year(int year, int days) => Assert.Equal(days, AnnualLeave.DaysFor(year, 35));

    [Theory]
    [InlineData(18, 20)]
    [InlineData(19, 14)]
    [InlineData(49, 14)]
    [InlineData(50, 20)]
    public void Young_and_older_workers_get_at_least_twenty_days(int age, int days) => Assert.Equal(days, AnnualLeave.DaysFor(2, age));

    [Fact]
    public void Accrual_sums_completed_years_with_age_rule()
    {
        // 2019'da işe girdi, 1973 doğumlu: 2023'te 50 yaşına girdiği için o yıldan itibaren 20 gün.
        var a = AnnualLeave.Accrual(new DateOnly(2019, 3, 1), new DateOnly(1973, 1, 10), Today);
        Assert.Equal(new[] { 14, 14, 14, 20, 20, 20, 20 }, a.Years.Select(y => y.Days));
        Assert.Equal(122, a.TotalEarned);
        Assert.Equal(new DateOnly(2027, 3, 1), a.NextEarnedOn);
    }

    [Fact]
    public void Leave_days_skip_holidays_and_weekly_off()
    {
        // 26 Ekim Pzt – 1 Kasım Paz 2026; 29 Ekim tatil; 31 Ekim planda hafta tatili; 1 Kasım planda yok (pazar).
        var holidays = new HashSet<DateOnly> { new(2026, 10, 29) };
        var planned = new HashSet<DateOnly> { new(2026, 10, 26), new(2026, 10, 27), new(2026, 10, 31) };
        var weeklyOff = new HashSet<DateOnly> { new(2026, 10, 31) };
        Assert.Equal(4, AnnualLeave.CountDays(new DateOnly(2026, 10, 26), new DateOnly(2026, 11, 1), holidays, weeklyOff, planned));
    }

    [Fact]
    public void Holiday_calendar_has_fixed_and_religious_days()
    {
        var h = TurkishHolidays.For(2026);
        Assert.Contains(h, x => x.Date == new DateOnly(2026, 10, 29) && !x.IsHalfDay);
        Assert.Contains(h, x => x.Date == new DateOnly(2026, 10, 28) && x.IsHalfDay);
        Assert.Contains(h, x => x.Date == new DateOnly(2026, 3, 20) && x.Name.StartsWith("Ramazan"));
        Assert.Equal(4, h.Count(x => x.Name.StartsWith("Kurban Bayramı") && !x.IsHalfDay));
        Assert.DoesNotContain(TurkishHolidays.For(2030), x => x.Name.StartsWith("Ramazan"));
    }
}
