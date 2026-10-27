namespace Pdks.Domain.Enums;

public enum AttendanceEventType
{
    CheckIn = 1,
    CheckOut = 2,
    BreakStart = 3,
    BreakEnd = 4
}

public enum AttendanceSource
{
    /// <summary>Kiosk QR okutması.</summary>
    QrScan = 1,
    /// <summary>Yönetici tarafından elle girilen / düzeltilen kayıt.</summary>
    Manual = 2
}
