using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>
/// İşyeri girişindeki tablet. Gizli anahtarıyla 30 saniyede bir değişen QR üretir.
/// Kiosk ekranı, rolü Kiosk olan bir kullanıcı hesabıyla açılır.
/// </summary>
public class Kiosk : TenantEntity
{
    public Guid BranchId { get; set; }
    public required string Name { get; set; }

    /// <summary>Dinamik QR imzalamak için kullanılan gizli anahtar.</summary>
    public required string Secret { get; set; }

    /// <summary>Kiosk ekranını açan hesap (Role = Kiosk).</summary>
    public Guid DeviceUserId { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastSeenAt { get; set; }

    public Branch? Branch { get; set; }
}
