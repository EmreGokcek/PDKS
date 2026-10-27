namespace Pdks.Domain.Common;

/// <summary>Tüm tabloların ortak alanları.</summary>
public abstract class Entity
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAt { get; set; }
}

/// <summary>
/// Bir firmaya (SaaS kiracısına) ait kayıtlar. CompanyId üzerinden
/// her firma yalnızca kendi verisini görür (DbContext'teki global filtre).
/// </summary>
public abstract class TenantEntity : Entity
{
    public Guid CompanyId { get; set; }
}
