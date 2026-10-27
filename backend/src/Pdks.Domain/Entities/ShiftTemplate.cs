using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>"Sabah 08:00-16:00" gibi hazır vardiya kalıbı.</summary>
public class ShiftTemplate : TenantEntity
{
    public Guid BranchId { get; set; }
    public required string Name { get; set; }
    public TimeOnly StartTime { get; set; }
    /// <summary>StartTime'dan küçükse vardiya ertesi güne taşar (gece vardiyası).</summary>
    public TimeOnly EndTime { get; set; }
    public string Color { get; set; } = "#3b82f6";
    public bool IsActive { get; set; } = true;
}
