using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>SaaS kiracısı: sistemi kullanan firma.</summary>
public class Company : Entity
{
    public required string Name { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Branch> Branches { get; set; } = [];
    public ICollection<User> Users { get; set; } = [];
    public WorkRule? WorkRule { get; set; }
}
