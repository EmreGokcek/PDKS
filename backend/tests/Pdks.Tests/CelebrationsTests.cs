using Pdks.Domain.Enums;
using Pdks.Domain.Social;

namespace Pdks.Tests;

public class CelebrationsTests
{
    private static readonly DateOnly Today = new(2026, 10, 28);

    private static CelebrationPerson P(string name, DateOnly? birth = null, DateOnly? hire = null, bool share = true) =>
        new(Guid.NewGuid(), name, birth, hire, share);

    [Fact]
    public void Birthday_today_is_listed_without_age()
    {
        var list = Celebrations.Upcoming([P("Ayşe", birth: new DateOnly(1990, 10, 28))], Today, 7);
        var c = Assert.Single(list);
        Assert.Equal(CelebrationKind.Birthday, c.Kind);
        Assert.Equal(0, c.DaysUntil);
        Assert.Null(c.Years);
    }

    [Fact]
    public void Hidden_birthday_is_not_listed()
    {
        Assert.Empty(Celebrations.Upcoming([P("Can", birth: new DateOnly(1990, 10, 28), share: false)], Today, 7));
    }

    [Fact]
    public void Work_anniversary_counts_years_and_skips_first_day()
    {
        var list = Celebrations.Upcoming(
            [P("Mehmet", hire: new DateOnly(2023, 10, 30)), P("Yeni", hire: Today)], Today, 7);
        var c = Assert.Single(list);
        Assert.Equal(CelebrationKind.WorkAnniversary, c.Kind);
        Assert.Equal(3, c.Years);
        Assert.Equal(2, c.DaysUntil);
    }

    [Fact]
    public void Wraps_to_next_year_and_respects_window()
    {
        var dec = new DateOnly(2026, 12, 30);
        var list = Celebrations.Upcoming([P("Elif", birth: new DateOnly(1995, 1, 2))], dec, 7);
        Assert.Equal(new DateOnly(2027, 1, 2), Assert.Single(list).Date);
        Assert.Empty(Celebrations.Upcoming([P("Elif", birth: new DateOnly(1995, 1, 2))], Today, 7));
    }

    [Fact]
    public void Leap_day_birthday_falls_on_feb_28_in_common_years()
    {
        Assert.Equal(new DateOnly(2027, 2, 28), Celebrations.Next(new DateOnly(2000, 2, 29), new DateOnly(2027, 2, 1)));
        Assert.Equal(new DateOnly(2028, 2, 29), Celebrations.Next(new DateOnly(2000, 2, 29), new DateOnly(2028, 2, 1)));
    }

    [Fact]
    public void Sorted_by_date_then_kind()
    {
        var list = Celebrations.Upcoming(
            [P("Zeynep", birth: new DateOnly(1990, 11, 1)), P("Burak", hire: new DateOnly(2020, 10, 28)), P("Ali", birth: new DateOnly(1980, 10, 28))],
            Today, 7);
        Assert.Equal(new[] { "Ali", "Burak", "Zeynep" }, list.Select(c => c.Name));
    }
}
