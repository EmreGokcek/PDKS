using Pdks.Domain.Common;
using Pdks.Domain.Enums;

namespace Pdks.Domain.Entities;

/// <summary>
/// Uygulama içi bildirim. Metin saklanmaz: tür + parametreler (JSON) saklanır,
/// arayüz seçili dilde metni oluşturur.
/// </summary>
public class Notification : TenantEntity
{
    public Guid UserId { get; set; }
    public NotificationType Type { get; set; }
    /// <summary>Metindeki değişkenler (ör. tarih, kişi adı) JSON olarak.</summary>
    public string? Data { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
}
