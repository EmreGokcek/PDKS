namespace Pdks.Domain.Enums;

public enum SwapStatus
{
    /// <summary>Ekip arkadaşının yanıtı bekleniyor.</summary>
    PendingPeer = 1,
    /// <summary>Arkadaşı kabul etti, müdür onayı bekleniyor.</summary>
    PendingManager = 2,
    Approved = 3,
    /// <summary>Müdür reddetti.</summary>
    Rejected = 4,
    /// <summary>Ekip arkadaşı kabul etmedi.</summary>
    Declined = 5,
    /// <summary>İsteyen geri çekti.</summary>
    Cancelled = 6,
    /// <summary>Plan değiştiği ya da tarih geçtiği için artık uygulanamaz.</summary>
    Expired = 7
}
