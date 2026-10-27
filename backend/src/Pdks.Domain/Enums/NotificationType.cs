namespace Pdks.Domain.Enums;

public enum NotificationType
{
    /// <summary>Haftalık plan yayınlandı.</summary>
    ShiftWeekPublished = 1,
    /// <summary>Yayındaki bir haftada vardiya değişti.</summary>
    ShiftChanged = 2,
    /// <summary>Yöneticiye: yeni talep.</summary>
    RequestCreated = 3,
    RequestApproved = 4,
    RequestRejected = 5,
    /// <summary>Yönetici kişinin kaydını düzeltti.</summary>
    RecordCorrected = 6
}
