using Pdks.Domain.Common;
using Pdks.Domain.Enums;

namespace Pdks.Domain.Entities;

/// <summary>Bir ekip arkadaşının doğum günü ya da iş yıl dönümü için gönderilen kutlama. Günde bir kez.</summary>
public class Congratulation : TenantEntity
{
    public Guid FromUserId { get; set; }
    public Guid ToUserId { get; set; }
    public CelebrationKind Kind { get; set; }
    /// <summary>Kutlanan günün (yerel) tarihi.</summary>
    public DateOnly Date { get; set; }
}
