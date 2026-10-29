using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>
/// "Şifremi unuttum" bağlantısındaki tek kullanımlık anahtar. Veritabanında yalnızca özeti (SHA-256) durur.
/// Firma filtresine tabi değildir: istek henüz kimliği doğrulanmamış gelir.
/// </summary>
public class PasswordResetToken : Entity
{
    public Guid UserId { get; set; }
    public required string TokenHash { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    /// <summary>Kullanıldı ya da yenisi istendiği için geçersiz kılındı.</summary>
    public DateTimeOffset? UsedAt { get; set; }

    public User? User { get; set; }
}
