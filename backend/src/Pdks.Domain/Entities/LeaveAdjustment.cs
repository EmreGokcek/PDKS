using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>
/// Yıllık izin bakiyesine elle yapılan düzeltme: sistemden önceki dönemden devreden izin (+),
/// sistem dışında kullandırılan izin (−) gibi. Yalnızca İK / yönetici ekler; gerekçe zorunludur.
/// </summary>
public class LeaveAdjustment : TenantEntity
{
    public Guid UserId { get; set; }
    public int Days { get; set; }
    public required string Reason { get; set; }
    public Guid CreatedById { get; set; }
}
