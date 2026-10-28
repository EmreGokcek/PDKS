using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>
/// Oturum yenileme anahtarı. Tarayıcıda yalnızca HttpOnly çerezde durur; veritabanında özeti (SHA-256) saklanır.
/// Her kullanımda yenisiyle değiştirilir (rotation). İptal edilmiş bir anahtar tekrar gelirse
/// çalınmış sayılır ve aynı ailedeki (aynı girişten türeyen) tüm anahtarlar iptal edilir.
/// Firma filtresine tabi değildir: yenileme isteği henüz kimliği doğrulanmamış gelir.
/// </summary>
public class RefreshToken : Entity
{
    public Guid UserId { get; set; }
    public required string TokenHash { get; set; }
    /// <summary>Aynı girişten türeyen anahtarlar aynı aileyi paylaşır.</summary>
    public Guid FamilyId { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    /// <summary>"Beni hatırla" seçildiyse çerez tarayıcı kapansa da kalır.</summary>
    public bool Persistent { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    /// <summary>rotated, logout, reuse, password_changed, password_reset, deactivated</summary>
    public string? RevokedReason { get; set; }

    public User? User { get; set; }
}
