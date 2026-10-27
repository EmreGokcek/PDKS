using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>
/// Bir şubenin bir haftalık planının yayın kaydı. Personel yalnızca yayınlanmış haftaların vardiyalarını görür.
/// Yayından sonra yapılan değişiklikler personele hemen yansır.
/// </summary>
public class ShiftWeek : TenantEntity
{
    public Guid BranchId { get; set; }
    public DateOnly WeekStart { get; set; }
    public DateTimeOffset PublishedAt { get; set; }
    public Guid PublishedByUserId { get; set; }
}
