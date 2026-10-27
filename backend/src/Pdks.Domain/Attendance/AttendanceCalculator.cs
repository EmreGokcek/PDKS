using Pdks.Domain.Enums;

namespace Pdks.Domain.Attendance;

public enum AttendanceState
{
    /// <summary>İçeride değil.</summary>
    Out = 0,
    Working = 1,
    OnBreak = 2
}

public readonly record struct EventPoint(AttendanceEventType Type, DateTimeOffset At);

public record CalculatorRules(int WeeklyWorkMinutes, int DailyBreakMinutes, DayOfWeek WeekStartsOn);

/// <summary>Bir giriş-çıkış aralığı. Molalar çalışma süresinden düşülür.</summary>
public record WorkSession(
    DateOnly Date,
    DateTimeOffset Start,
    DateTimeOffset? End,
    TimeSpan Worked,
    TimeSpan Break,
    bool IsOpen,
    bool IsUnclosed);

public record DayTotal(DateOnly Date, TimeSpan Worked, TimeSpan Break);

public record AttendanceSummary(
    AttendanceState State,
    DateTimeOffset? SessionStartedAt,
    DateTimeOffset? BreakStartedAt,
    DateOnly Today,
    TimeSpan TodayWorked,
    TimeSpan TodayBreak,
    TimeSpan BreakAllowance,
    TimeSpan BreakRemaining,
    TimeSpan BreakOverrun,
    bool BreakUsedToday,
    DateOnly WeekStart,
    IReadOnlyList<DayTotal> WeekDays,
    TimeSpan WeekWorked,
    TimeSpan WeeklyTarget,
    TimeSpan Overtime,
    bool HasUnclosedSession);

/// <summary>
/// QR okutma olaylarından çalışma, mola ve fazla mesai sürelerini hesaplar.
/// Veritabanından bağımsızdır; aynı girdi her zaman aynı sonucu verir (testlenebilir).
///
/// Kurallar:
/// - Bir oturum (giriş → çıkış) başladığı günün yerel tarihine yazılır (gece vardiyası dahil).
/// - Molalar çalışma süresinden düşülür. Molada çıkış yapılırsa mola çıkış anında biter.
/// - Hâlâ açık oturum "şimdi"ye kadar sayılır.
/// - MaxOpenSession'dan uzun süredir açık oturum "kapatılmamış" kabul edilir: süresi sayılmaz,
///   kişi dışarıda görünür ve yönetici düzeltmesi beklenir.
/// - Haftalık net çalışmanın WeeklyWorkMinutes'ı aşan kısmı fazla mesaidir.
/// </summary>
public static class AttendanceCalculator
{
    public static readonly TimeSpan MaxOpenSession = TimeSpan.FromHours(16);

    public static DateOnly WeekStartOf(DateOnly date, DayOfWeek weekStartsOn) =>
        date.AddDays(-(((int)date.DayOfWeek - (int)weekStartsOn + 7) % 7));

    public static DateOnly LocalDate(DateTimeOffset at, TimeZoneInfo tz) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(at, tz).DateTime);

    public static IReadOnlyList<WorkSession> BuildSessions(
        IEnumerable<EventPoint> events, DateTimeOffset now, TimeZoneInfo tz)
    {
        var sessions = new List<WorkSession>();
        DateTimeOffset? start = null;
        DateTimeOffset? breakStart = null;
        var breaks = TimeSpan.Zero;

        void Close(DateTimeOffset end, bool open)
        {
            var s = start!.Value;
            if (breakStart is { } b) breaks += end - b;

            var unclosed = open && now - s > MaxOpenSession;
            var total = end - s;
            sessions.Add(new WorkSession(
                LocalDate(s, tz), s, open ? null : end,
                unclosed ? TimeSpan.Zero : Max(total - breaks, TimeSpan.Zero),
                unclosed ? TimeSpan.Zero : breaks,
                IsOpen: open && !unclosed,
                IsUnclosed: unclosed));

            start = null;
            breakStart = null;
            breaks = TimeSpan.Zero;
        }

        foreach (var e in events.OrderBy(e => e.At))
        {
            switch (e.Type)
            {
                case AttendanceEventType.CheckIn:
                    // Çıkış yapılmadan yeni giriş: önceki oturum kapatılmamış sayılır.
                    if (start is not null)
                    {
                        sessions.Add(new WorkSession(LocalDate(start.Value, tz), start.Value, null,
                            TimeSpan.Zero, TimeSpan.Zero, IsOpen: false, IsUnclosed: true));
                        breakStart = null;
                        breaks = TimeSpan.Zero;
                    }
                    start = e.At;
                    break;

                case AttendanceEventType.BreakStart when start is not null && breakStart is null:
                    breakStart = e.At;
                    break;

                case AttendanceEventType.BreakEnd when breakStart is not null:
                    breaks += e.At - breakStart.Value;
                    breakStart = null;
                    break;

                case AttendanceEventType.CheckOut when start is not null:
                    Close(e.At, open: false);
                    break;
            }
        }

        if (start is not null) Close(now, open: true);
        return sessions;
    }

    public static AttendanceSummary Summarize(
        IEnumerable<EventPoint> events, DateTimeOffset now, TimeZoneInfo tz, CalculatorRules rules)
    {
        var ordered = events.OrderBy(e => e.At).ToList();
        var sessions = BuildSessions(ordered, now, tz);
        var today = LocalDate(now, tz);
        var weekStart = WeekStartOf(today, rules.WeekStartsOn);

        var open = sessions.LastOrDefault(s => s.IsOpen);
        DateTimeOffset? breakStartedAt = null;
        if (open is not null)
        {
            var last = ordered.LastOrDefault(e => e.At >= open.Start);
            if (last.Type == AttendanceEventType.BreakStart) breakStartedAt = last.At;
        }

        var state = open is null ? AttendanceState.Out
            : breakStartedAt is null ? AttendanceState.Working
            : AttendanceState.OnBreak;

        var todaySessions = sessions.Where(s => s.Date == today).ToList();
        var todayBreak = Sum(todaySessions.Select(s => s.Break));
        var allowance = TimeSpan.FromMinutes(rules.DailyBreakMinutes);
        var breakUsed = state == AttendanceState.OnBreak
            || ordered.Any(e => e.Type == AttendanceEventType.BreakStart && LocalDate(e.At, tz) == today);

        var weekDays = Enumerable.Range(0, 7)
            .Select(i => weekStart.AddDays(i))
            .Select(d =>
            {
                var daySessions = sessions.Where(s => s.Date == d).ToList();
                return new DayTotal(d, Sum(daySessions.Select(s => s.Worked)), Sum(daySessions.Select(s => s.Break)));
            })
            .ToList();

        var weekWorked = Sum(weekDays.Select(d => d.Worked));
        var target = TimeSpan.FromMinutes(rules.WeeklyWorkMinutes);

        return new AttendanceSummary(
            state,
            open?.Start,
            breakStartedAt,
            today,
            Sum(todaySessions.Select(s => s.Worked)),
            todayBreak,
            allowance,
            Max(allowance - todayBreak, TimeSpan.Zero),
            Max(todayBreak - allowance, TimeSpan.Zero),
            breakUsed,
            weekStart,
            weekDays,
            weekWorked,
            target,
            Max(weekWorked - target, TimeSpan.Zero),
            sessions.Any(s => s.IsUnclosed && s.Date >= weekStart));
    }

    private static TimeSpan Sum(IEnumerable<TimeSpan> values) =>
        values.Aggregate(TimeSpan.Zero, (a, b) => a + b);

    private static TimeSpan Max(TimeSpan a, TimeSpan b) => a > b ? a : b;
}

/// <summary>Personelin seçtiği işlemin mevcut duruma göre geçerli olup olmadığı.</summary>
public static class AttendanceRules
{
    /// <returns>Hata kodu; işlem geçerliyse null.</returns>
    public static string? Validate(AttendanceEventType action, AttendanceSummary summary) => action switch
    {
        AttendanceEventType.CheckIn when summary.State != AttendanceState.Out => "already_checked_in",
        AttendanceEventType.BreakStart when summary.State == AttendanceState.Out => "not_checked_in",
        AttendanceEventType.BreakStart when summary.State == AttendanceState.OnBreak => "already_on_break",
        AttendanceEventType.BreakStart when summary.BreakUsedToday => "break_already_used",
        AttendanceEventType.BreakEnd when summary.State != AttendanceState.OnBreak => "not_on_break",
        AttendanceEventType.CheckOut when summary.State == AttendanceState.Out => "not_checked_in",
        _ => null
    };

    /// <summary>
    /// Elle düzeltme sonrası olay sırasının anlamlı olup olmadığını kontrol eder.
    /// Hoşgörülü: çıkışsız yeni giriş (kapatılmamış oturum) kabul edilir; yönetici sonradan düzeltebilir.
    /// Reddedilenler: girişsiz mola / çıkış, molasız mola bitişi, aynı anda iki kayıt.
    /// </summary>
    /// <returns>Hata kodu; geçerliyse null.</returns>
    public static string? ValidateSequence(IEnumerable<EventPoint> events)
    {
        var state = AttendanceState.Out;
        DateTimeOffset? previous = null;

        foreach (var e in events.OrderBy(e => e.At))
        {
            if (previous == e.At) return "duplicate_time";
            previous = e.At;

            switch (e.Type)
            {
                case AttendanceEventType.CheckIn:
                    state = AttendanceState.Working;
                    break;
                case AttendanceEventType.BreakStart:
                    if (state != AttendanceState.Working) return "invalid_sequence";
                    state = AttendanceState.OnBreak;
                    break;
                case AttendanceEventType.BreakEnd:
                    if (state != AttendanceState.OnBreak) return "invalid_sequence";
                    state = AttendanceState.Working;
                    break;
                case AttendanceEventType.CheckOut:
                    if (state == AttendanceState.Out) return "invalid_sequence";
                    state = AttendanceState.Out;
                    break;
            }
        }
        return null;
    }
}
