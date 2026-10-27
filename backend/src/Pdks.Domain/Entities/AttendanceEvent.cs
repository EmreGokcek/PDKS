using Pdks.Domain.Common;
using Pdks.Domain.Enums;

namespace Pdks.Domain.Entities;

/// <summary>
/// Tek bir QR okutması (giriş, çıkış, mola başı, mola sonu).
/// Süreler bu olaylardan hesaplanır; kayıtlar silinmez, düzeltmeler AuditLog'a yazılır.
/// </summary>
public class AttendanceEvent : TenantEntity
{
    public Guid BranchId { get; set; }
    public Guid UserId { get; set; }

    public AttendanceEventType Type { get; set; }
    /// <summary>UTC olarak saklanır.</summary>
    public DateTimeOffset OccurredAt { get; set; }

    public AttendanceSource Source { get; set; } = AttendanceSource.QrScan;
    public Guid? KioskId { get; set; }

    /// <summary>Manuel kayıtlarda işlemi yapan yönetici.</summary>
    public Guid? RecordedByUserId { get; set; }
    public string? Note { get; set; }

    public User? User { get; set; }
    public Kiosk? Kiosk { get; set; }
}
