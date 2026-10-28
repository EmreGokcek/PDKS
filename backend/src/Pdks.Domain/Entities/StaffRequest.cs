using Pdks.Domain.Common;
using Pdks.Domain.Enums;

namespace Pdks.Domain.Entities;

/// <summary>
/// Personelin yöneticiye gönderdiği talep: düzeltme ya da izin.
/// Onaylanan düzeltme olay olarak, onaylanan izin vardiya planına izin günü olarak işlenir.
/// </summary>
public class StaffRequest : TenantEntity
{
    public Guid BranchId { get; set; }
    public Guid UserId { get; set; }
    public RequestType Type { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.Pending;

    // Düzeltme
    public AttendanceEventType? EventType { get; set; }
    /// <summary>İstenen olay anı (UTC).</summary>
    public DateTimeOffset? EventAt { get; set; }

    // İzin
    public ShiftKind? LeaveKind { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    /// <summary>Yıllık izinde düşülecek gün (tatil ve hafta tatilleri hariç); talep anında hesaplanır.</summary>
    public int? LeaveDays { get; set; }

    public required string Reason { get; set; }

    public Guid? ReviewedByUserId { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }

    public User? User { get; set; }
}
