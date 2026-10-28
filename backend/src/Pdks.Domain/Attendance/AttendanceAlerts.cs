using Pdks.Domain.Enums;

namespace Pdks.Domain.Attendance;

public enum AlertKind
{
    /// <summary>Vardiyası başladı, belirlenen süre geçti, hâlâ giriş yok.</summary>
    NotArrived = 1,
    /// <summary>Molada ve mola hakkını aştı.</summary>
    BreakOverrun = 2
}

/// <summary>
/// Müdüre anlık uyarı gönderme kuralları. Her kişi için günde her türden en fazla bir uyarı gider
/// (tekrarı veritabanındaki AttendanceAlert kaydı önler).
/// </summary>
public static class AttendanceAlerts
{
    /// <summary>
    /// Gelmedi uyarısı: planlı çalışma günü, giriş yok ve vardiya başlangıcından
    /// en az <paramref name="alertMinutes"/> (tolerans daha uzunsa tolerans) dakika geçti. 0 = kapalı.
    /// </summary>
    public static bool NotArrivedDue(DayRecord day, DateTimeOffset now, TimeZoneInfo tz, int toleranceMinutes, int alertMinutes)
    {
        if (alertMinutes <= 0 || day.Status != DayStatus.NotArrived || day.Plan is not { Kind: ShiftKind.Work } plan)
            return false;
        var (start, _) = DailyReport.ShiftBounds(day.Date, plan, tz);
        return now >= start + TimeSpan.FromMinutes(Math.Max(toleranceMinutes, alertMinutes));
    }

    /// <summary>Mola aşımı uyarısı: şu an molada ve günün mola toplamı hakkı en az bir dakika aştı.</summary>
    public static bool BreakOverrunDue(AttendanceState state, DayRecord day, bool enabled) =>
        enabled && state == AttendanceState.OnBreak && day.BreakOverrun >= TimeSpan.FromMinutes(1);
}
