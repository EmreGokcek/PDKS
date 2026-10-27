using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>Kim, neyi, ne zaman, neden değiştirdi. Yalnızca eklenir, güncellenmez.</summary>
public class AuditLog : TenantEntity
{
    public Guid? ActorUserId { get; set; }
    public required string Action { get; set; }
    public required string EntityName { get; set; }
    public Guid? EntityId { get; set; }

    /// <summary>JSON olarak eski / yeni değerler.</summary>
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? Reason { get; set; }
}
