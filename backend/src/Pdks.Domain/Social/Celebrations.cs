using Pdks.Domain.Enums;

namespace Pdks.Domain.Social;

/// <summary>Kutlama hesabı için kişi bilgisi.</summary>
public record CelebrationPerson(Guid UserId, string Name, DateOnly? BirthDate, DateOnly? HireDate, bool ShareBirthday);

/// <summary>
/// Bir kişinin yaklaşan ya da bugünkü kutlaması.
/// Years yalnızca iş yıl dönümünde doludur; doğum gününde yaş hesaplanmaz ve gösterilmez.
/// </summary>
public record Celebration(Guid UserId, string Name, CelebrationKind Kind, DateOnly Date, int DaysUntil, int? Years);

public static class Celebrations
{
    /// <summary>
    /// Bugünden itibaren <paramref name="daysAhead"/> gün içindeki doğum günleri ve iş yıl dönümleri (bugün dahil).
    /// 29 Şubat doğumlular artık yıl olmayan yıllarda 28 Şubat'ta kutlanır.
    /// İşe girişin ilk günü (0. yıl) yıl dönümü sayılmaz.
    /// </summary>
    public static List<Celebration> Upcoming(IEnumerable<CelebrationPerson> people, DateOnly today, int daysAhead)
    {
        var result = new List<Celebration>();
        foreach (var p in people)
        {
            if (p.ShareBirthday && p.BirthDate is { } birth && Next(birth, today) is var b && Within(b, today, daysAhead))
                result.Add(new Celebration(p.UserId, p.Name, CelebrationKind.Birthday, b, b.DayNumber - today.DayNumber, null));

            if (p.HireDate is { } hire && Next(hire, today) is var h && Within(h, today, daysAhead))
            {
                var years = h.Year - hire.Year;
                if (years >= 1)
                    result.Add(new Celebration(p.UserId, p.Name, CelebrationKind.WorkAnniversary, h, h.DayNumber - today.DayNumber, years));
            }
        }

        return result
            .OrderBy(c => c.DaysUntil)
            .ThenBy(c => c.Kind)
            .ThenBy(c => c.Name, StringComparer.Create(new System.Globalization.CultureInfo("tr-TR"), false))
            .ToList();
    }

    /// <summary>Verilen tarihin bugün ya da sonraki ilk yıllık tekrarı.</summary>
    public static DateOnly Next(DateOnly date, DateOnly today)
    {
        var thisYear = OnYear(date, today.Year);
        return thisYear >= today ? thisYear : OnYear(date, today.Year + 1);
    }

    /// <summary>Bugün bu kişinin bu türden bir kutlaması var mı?</summary>
    public static bool IsToday(CelebrationPerson person, CelebrationKind kind, DateOnly today) =>
        Upcoming([person], today, 0).Any(c => c.Kind == kind);

    private static DateOnly OnYear(DateOnly date, int year) =>
        date.Month == 2 && date.Day == 29 && !DateTime.IsLeapYear(year)
            ? new DateOnly(year, 2, 28)
            : new DateOnly(year, date.Month, date.Day);

    private static bool Within(DateOnly date, DateOnly today, int daysAhead) =>
        date >= today && date.DayNumber - today.DayNumber <= daysAhead;
}
