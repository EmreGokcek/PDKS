namespace Pdks.Domain.Leave;

/// <summary>Bir hizmet yılı dolunca kazanılan yıllık izin.</summary>
public record LeaveAccrualYear(int ServiceYear, DateOnly EarnedOn, int Days);

public record LeaveAccrual(
    /// <summary>Şimdiye kadar dolan hizmet yılları ve her biri için kazanılan gün.</summary>
    IReadOnlyList<LeaveAccrualYear> Years,
    int TotalEarned,
    /// <summary>Bir sonraki hizmet yılının dolacağı tarih ve kazanılacak gün.</summary>
    DateOnly NextEarnedOn,
    int NextDays);

/// <summary>
/// 4857 sayılı İş Kanunu md. 53 ve 55'e göre yıllık ücretli izin.
/// - Deneme süresi dahil en az bir yıl çalışmış olmak gerekir; ilk yılı dolmayanın yıllık izin hakkı yoktur.
/// - 1-5 yıl (5 dahil): 14 gün, 5'ten fazla 15'ten az: 20 gün, 15 yıl ve fazlası: 26 gün.
/// - 18 yaş ve altı ile 50 yaş ve üstü çalışanlara 20 günden az verilemez.
/// - İzin süresine hafta tatili ve resmi tatiller sayılmaz.
/// </summary>
public static class AnnualLeave
{
    public static int DaysFor(int serviceYear, int? ageAtAnniversary)
    {
        if (serviceYear < 1) return 0;
        var days = serviceYear <= 5 ? 14 : serviceYear < 15 ? 20 : 26;
        if (ageAtAnniversary is { } age && (age <= 18 || age >= 50)) days = Math.Max(days, 20);
        return days;
    }

    public static LeaveAccrual Accrual(DateOnly hireDate, DateOnly? birthDate, DateOnly asOf)
    {
        var years = new List<LeaveAccrualYear>();
        var n = 1;
        for (; Anniversary(hireDate, n) <= asOf; n++)
        {
            var on = Anniversary(hireDate, n);
            years.Add(new LeaveAccrualYear(n, on, DaysFor(n, AgeOn(birthDate, on))));
        }
        var next = Anniversary(hireDate, n);
        return new LeaveAccrual(years, years.Sum(y => y.Days), next, DaysFor(n, AgeOn(birthDate, next)));
    }

    /// <summary>
    /// Bir izin aralığında düşülecek gün sayısı: resmi tatiller ve hafta tatilleri sayılmaz.
    /// Hafta tatili planda belliyse plana göre; planı olmayan günlerde pazar hafta tatili sayılır.
    /// Yarım gün (arife) tatiller tam iş günü sayılır.
    /// </summary>
    public static int CountDays(DateOnly start, DateOnly end, IReadOnlySet<DateOnly> fullDayHolidays,
        IReadOnlySet<DateOnly> plannedWeeklyOff, IReadOnlySet<DateOnly> plannedDays)
    {
        var count = 0;
        for (var d = start; d <= end; d = d.AddDays(1))
        {
            if (fullDayHolidays.Contains(d)) continue;
            if (plannedDays.Contains(d) ? plannedWeeklyOff.Contains(d) : d.DayOfWeek == DayOfWeek.Sunday) continue;
            count++;
        }
        return count;
    }

    private static DateOnly Anniversary(DateOnly hire, int years) =>
        hire.Month == 2 && hire.Day == 29 && !DateTime.IsLeapYear(hire.Year + years)
            ? new DateOnly(hire.Year + years, 2, 28)
            : new DateOnly(hire.Year + years, hire.Month, hire.Day);

    private static int? AgeOn(DateOnly? birth, DateOnly on)
    {
        if (birth is not { } b) return null;
        var age = on.Year - b.Year;
        if (on < new DateOnly(on.Year, b.Month, b.Month == 2 && b.Day == 29 && !DateTime.IsLeapYear(on.Year) ? 28 : b.Day)) age--;
        return age;
    }
}
