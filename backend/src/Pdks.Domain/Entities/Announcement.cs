using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>
/// Yönetici ya da müdürün yayınladığı duyuru. BranchId boşsa tüm firmaya,
/// doluysa yalnızca o şubeye görünür.
/// </summary>
public class Announcement : TenantEntity
{
    public Guid? BranchId { get; set; }
    public required string Title { get; set; }
    public string? Body { get; set; }
    /// <summary>Sabitlenen duyurular listenin başında kalır.</summary>
    public bool IsPinned { get; set; }
    /// <summary>Girişteki kiosk ekranında da gösterilsin mi (ziyaretçiler de görebilir).</summary>
    public bool ShowOnKiosk { get; set; } = true;
    /// <summary>Bu tarihten sonra (bu gün dahil değil) yayından kalkar. Boşsa süresiz.</summary>
    public DateOnly? ExpiresOn { get; set; }
    public Guid CreatedById { get; set; }
    public User? CreatedBy { get; set; }
}
