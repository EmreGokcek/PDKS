using Pdks.Domain.Enums;

namespace Pdks.Domain.Attendance;

/// <summary>Bir günün planı (vardiya ya da izin). Saatler yerel saattir.</summary>
public record DayPlan(ShiftKind Kind, TimeOnly Start, TimeOnly End, int? BreakMinutes, string? Name = null, string? Color = null);

public enum DayStatus
{
    /// <summary>Plan yok, çalışma da yok.</summary>
    Off,
    /// <summary>İzinli gün.</summary>
    OnLeave,
    /// <summary>Vardiyası henüz başlamadı (tolerans dahil).</summary>
    Upcoming,
    /// <summary>Vardiyası başladı, tolerans geçti, hâlâ giriş yok.</summary>
    NotArrived,
    /// <summary>Şu an içeride.</summary>
    InProgress,
    /// <summary>Gelip çıkış yaptı.</summary>
    Present,
    /// <summary>Vardiyası bitti, hiç gelmedi.</summary>
    Absent,
    /// <summary>Planı olmadığı halde çalıştı.</summary>
    Unplanned
}

public record DayRecord(
    DateOnly Date,
    DayPlan? Plan,
    DayStatus Status,
    DateTimeOffset? FirstIn,
    DateTimeOffset? LastOut,
    TimeSpan Worked,
    TimeSpan Break,
    TimeSpan BreakAllowance,
    TimeSpan BreakOverrun,
    int LateMinutes,
    int EarlyLeaveMinutes,
    bool HasUnclosedSession);

/// <summary>
/// Olaylar ve planlardan gün gün devam kaydı üretir: geç kalma, erken çıkma, devamsızlık, mola aşımı.
///
/// Kurallar:
/// - Geç kalma: ilk giriş, vardiya başlangıcından tolerans dakikasından fazla sonraysa; dakika olarak başlangıçtan itibaren sayılır.
/// - Erken çıkma: son çıkış vardiya bitişinden tolerans dakikasından fazla önceyse.
/// - Mola hakkı: o günün vardiyasındaki mola süresi, yoksa varsayılan günlük mola.
/// - Oturumlar başladıkları güne yazılır (gece vardiyası dahil); bkz. AttendanceCalculator.
///   İstisna: ertesi günün gece yarısı vardiyasına erken okutulan giriş o vardiyanın gününe yazılır (AttributedDate).
/// </summary>
public static class DailyReport
{
    public static IReadOnlyList<DayRecord> Build(
        IEnumerable<EventPoint> events,
        IReadOnlyDictionary<DateOnly, DayPlan> plans,
        DateOnly from,
        DateOnly to,
        DateTimeOffset now,
        TimeZoneInfo tz,
        int toleranceMinutes,
        int defaultBreakMinutes)
    {
        var sessions = AttendanceCalculator.BuildSessions(events, now, tz)
            .Select(x => x with { Date = AttributedDate(x, plans, tz) })
            .ToList();
        var tolerance = TimeSpan.FromMinutes(toleranceMinutes);
        var records = new List<DayRecord>();

        for (var d = from; d <= to; d = d.AddDays(1))
        {
            plans.TryGetValue(d, out var plan);
            var daySessions = sessions.Where(s => s.Date == d).ToList();
            var counted = daySessions.Where(s => !s.IsUnclosed).ToList();

            var worked = counted.Aggregate(TimeSpan.Zero, (a, s) => a + s.Worked);
            var brk = counted.Aggregate(TimeSpan.Zero, (a, s) => a + s.Break);
            var firstIn = daySessions.Count > 0 ? daySessions.Min(s => s.Start) : (DateTimeOffset?)null;
            var anyOpen = counted.Any(s => s.IsOpen);
            var lastOut = !anyOpen && counted.Count > 0 ? counted.Max(s => s.End) : null;

            var isWork = plan is { Kind: ShiftKind.Work };
            var allowance = TimeSpan.FromMinutes(isWork ? plan!.BreakMinutes ?? defaultBreakMinutes : defaultBreakMinutes);
            var overrun = brk > allowance ? brk - allowance : TimeSpan.Zero;

            int late = 0, early = 0;
            DayStatus status;

            if (isWork)
            {
                var (shiftStart, shiftEnd) = ShiftBounds(d, plan!, tz);
                if (firstIn is { } fi && fi - shiftStart > tolerance)
                    late = (int)Math.Floor((fi - shiftStart).TotalMinutes);
                if (lastOut is { } lo && shiftEnd - lo > tolerance)
                    early = (int)Math.Floor((shiftEnd - lo).TotalMinutes);

                status = daySessions.Count > 0
                    ? (anyOpen ? DayStatus.InProgress : DayStatus.Present)
                    : now < shiftStart + tolerance ? DayStatus.Upcoming
                    : now < shiftEnd ? DayStatus.NotArrived
                    : DayStatus.Absent;
            }
            else if (plan is not null)
            {
                status = daySessions.Count > 0 ? (anyOpen ? DayStatus.InProgress : DayStatus.Present) : DayStatus.OnLeave;
            }
            else
            {
                status = daySessions.Count > 0 ? (anyOpen ? DayStatus.InProgress : DayStatus.Unplanned) : DayStatus.Off;
            }

            records.Add(new DayRecord(d, plan, status, firstIn, lastOut, worked, brk, allowance, overrun, late, early,
                daySessions.Any(s => s.IsUnclosed)));
        }

        return records;
    }

    /// <summary>Vardiyadan bu kadar önce okutulan giriş o vardiyaya sayılır (gece yarısı vardiyası için).</summary>
    public static readonly TimeSpan EarlyArrivalWindow = TimeSpan.FromHours(3);

    /// <summary>
    /// Oturumun yazılacağı gün. Normalde oturumun başladığı gündür; ancak ertesi gün gece yarısı (ya da çok erken)
    /// başlayan bir çalışma vardiyasından en fazla <see cref="EarlyArrivalWindow"/> önce okutulduysa ve o günün kendi
    /// vardiyasına ait değilse ertesi güne yazılır. Örn. 00:00 vardiyası için 23:55'te okutulan giriş.
    /// </summary>
    public static DateOnly AttributedDate(WorkSession session, IReadOnlyDictionary<DateOnly, DayPlan> plans, TimeZoneInfo tz)
    {
        var day = session.Date;
        var next = day.AddDays(1);
        if (!plans.TryGetValue(next, out var nextPlan) || nextPlan.Kind != ShiftKind.Work) return day;

        var (nextStart, _) = ShiftBounds(next, nextPlan, tz);
        if (session.Start >= nextStart || nextStart - session.Start > EarlyArrivalWindow) return day;

        // O günün kendi vardiyası içindeyse (ya da ona erken gelinmişse) o güne aittir.
        if (plans.TryGetValue(day, out var plan) && plan.Kind == ShiftKind.Work)
        {
            var (start, end) = ShiftBounds(day, plan, tz);
            if (session.Start >= start - EarlyArrivalWindow && session.Start < end) return day;
        }
        return next;
    }

    /// <summary>Vardiyanın başlangıç ve bitiş anı (gece vardiyası ertesi güne taşar).</summary>
    public static (DateTimeOffset Start, DateTimeOffset End) ShiftBounds(DateOnly date, DayPlan plan, TimeZoneInfo tz)
    {
        var (start, end) = Scheduling.ShiftMath.Interval(date, plan.Start, plan.End);
        return (ToInstant(start, tz), ToInstant(end, tz));
    }

    private static DateTimeOffset ToInstant(DateTime local, TimeZoneInfo tz) =>
        new(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), tz.GetUtcOffset(DateTime.SpecifyKind(local, DateTimeKind.Unspecified)));
}
