using Pdks.Domain.Attendance;
using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>Gönderilmiş anlık uyarı. Aynı kişi, gün ve tür için ikinci uyarıyı önler.</summary>
public class AttendanceAlert : TenantEntity
{
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public AlertKind Kind { get; set; }
}
