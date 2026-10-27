namespace Pdks.Domain.Scheduling;

/// <summary>Vardiya saatleriyle ilgili saf hesaplar. Yerel saatle çalışır (saat dilimi dönüşümü yok).</summary>
public static class ShiftMath
{
    public static readonly TimeSpan MaxLength = TimeSpan.FromHours(16);

    /// <summary>Bitiş başlangıçtan küçük ya da eşitse vardiya ertesi güne taşar (ör. 22:00–06:00).</summary>
    public static bool IsOvernight(TimeOnly start, TimeOnly end) => end <= start;

    public static TimeSpan Duration(TimeOnly start, TimeOnly end) =>
        IsOvernight(start, end) ? TimeSpan.FromDays(1) - (start - end) : end - start;

    public static (DateTime Start, DateTime End) Interval(DateOnly date, TimeOnly start, TimeOnly end)
    {
        var from = date.ToDateTime(start);
        return (from, from + Duration(start, end));
    }

    public static bool Overlaps(
        (DateOnly Date, TimeOnly Start, TimeOnly End) a,
        (DateOnly Date, TimeOnly Start, TimeOnly End) b)
    {
        var (aStart, aEnd) = Interval(a.Date, a.Start, a.End);
        var (bStart, bEnd) = Interval(b.Date, b.Start, b.End);
        return aStart < bEnd && bStart < aEnd;
    }

    /// <returns>Hata kodu; geçerliyse null.</returns>
    public static string? Validate(TimeOnly start, TimeOnly end) =>
        start == end ? "shift_zero_length"
        : Duration(start, end) > MaxLength ? "shift_too_long"
        : null;

    /// <summary>Planlanan net süre: vardiya süresinden günlük mola hakkı düşülür.</summary>
    public static TimeSpan NetDuration(TimeOnly start, TimeOnly end, TimeSpan dailyBreak)
    {
        var gross = Duration(start, end);
        return gross > dailyBreak ? gross - dailyBreak : gross;
    }
}
