using Pdks.Domain.Common;
using Pdks.Domain.Enums;

namespace Pdks.Domain.Entities;

/// <summary>
/// Aynı gün için vardiya takası: isteyen kendi çalışma vardiyasını bir ekip arkadaşına verir,
/// karşılığında onun o günkü planını (vardiyası, hafta tatili ya da boş günü) alır.
/// Akış: isteyen gönderir → arkadaşı kabul eder → müdür onaylar → plan değişir.
/// </summary>
public class ShiftSwap : TenantEntity
{
    public Guid BranchId { get; set; }
    public DateOnly Date { get; set; }

    public Guid RequesterId { get; set; }
    public Guid RequesterShiftId { get; set; }
    public Guid TargetUserId { get; set; }
    /// <summary>Arkadaşının o günkü planı; o gün planı yoksa boş (vardiyayı devralır).</summary>
    public Guid? TargetShiftId { get; set; }

    public SwapStatus Status { get; set; } = SwapStatus.PendingPeer;
    public string? Note { get; set; }
    public DateTimeOffset? PeerRespondedAt { get; set; }

    public Guid? ReviewedById { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }

    public User? Requester { get; set; }
    public User? TargetUser { get; set; }
}
