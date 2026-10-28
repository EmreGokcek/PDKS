namespace Pdks.Domain.Leave;

public record HolidayInfo(DateOnly Date, string Name, bool IsHalfDay);

/// <summary>
/// Türkiye'deki ulusal bayram ve genel tatiller (2429 sayılı Kanun).
/// Sabit tarihli olanlar her yıl hesaplanır; dini bayramlar ay takvimine göre değiştiği için
/// bilinen yıllar tabloda tutulur. Tabloda olmayan yıllar için firma tatilleri elle ekleyebilir.
/// Arife günleri yarım gündür (öğleden sonra tatil).
/// </summary>
public static class TurkishHolidays
{
    private static readonly Dictionary<int, (DateOnly Ramazan, DateOnly Kurban)> Religious = new()
    {
        // Bayramın ilk günü (arife bir gün öncesi). Kaynak: Diyanet takvimi.
        [2025] = (new DateOnly(2025, 3, 30), new DateOnly(2025, 6, 6)),
        [2026] = (new DateOnly(2026, 3, 20), new DateOnly(2026, 5, 27)),
        [2027] = (new DateOnly(2027, 3, 9), new DateOnly(2027, 5, 16)),
    };

    public static bool HasReligiousDates(int year) => Religious.ContainsKey(year);

    public static IReadOnlyList<HolidayInfo> For(int year)
    {
        var list = new List<HolidayInfo>
        {
            new(new DateOnly(year, 1, 1), "Yılbaşı", false),
            new(new DateOnly(year, 4, 23), "Ulusal Egemenlik ve Çocuk Bayramı", false),
            new(new DateOnly(year, 5, 1), "Emek ve Dayanışma Günü", false),
            new(new DateOnly(year, 5, 19), "Atatürk'ü Anma, Gençlik ve Spor Bayramı", false),
            new(new DateOnly(year, 7, 15), "Demokrasi ve Millî Birlik Günü", false),
            new(new DateOnly(year, 8, 30), "Zafer Bayramı", false),
            new(new DateOnly(year, 10, 28), "Cumhuriyet Bayramı arifesi", true),
            new(new DateOnly(year, 10, 29), "Cumhuriyet Bayramı", false),
        };

        if (Religious.TryGetValue(year, out var r))
        {
            list.Add(new(r.Ramazan.AddDays(-1), "Ramazan Bayramı arifesi", true));
            for (var i = 0; i < 3; i++) list.Add(new(r.Ramazan.AddDays(i), $"Ramazan Bayramı {i + 1}. gün", false));
            list.Add(new(r.Kurban.AddDays(-1), "Kurban Bayramı arifesi", true));
            for (var i = 0; i < 4; i++) list.Add(new(r.Kurban.AddDays(i), $"Kurban Bayramı {i + 1}. gün", false));
        }

        // Aynı güne denk gelen (ör. arife ile başka bir tatil) tam gün olan kalır.
        return list
            .GroupBy(h => h.Date)
            .Select(g => g.OrderBy(h => h.IsHalfDay).First())
            .OrderBy(h => h.Date)
            .ToList();
    }
}
