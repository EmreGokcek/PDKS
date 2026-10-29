using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Auth;

/// <summary>"Şifremi unuttum" anahtarları: üretir, doğrular, tek kullanımlık yapar. Değişiklikler SaveChanges ile yazılır.</summary>
public class PasswordResetService(PdksDbContext db, TimeProvider time)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);
    /// <summary>Aynı hesap için saatte en fazla bu kadar bağlantı gönderilir (posta kutusu doldurulmasın).</summary>
    public const int MaxPerHour = 3;

    /// <summary>Yeni anahtar üretir, hesabın önceki açık anahtarlarını geçersiz kılar. Sınır aşıldıysa null döner.</summary>
    public async Task<string?> CreateAsync(User user, CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var recent = await db.PasswordResetTokens.CountAsync(t => t.UserId == user.Id && t.CreatedAt > now.AddHours(-1), ct);
        if (recent >= MaxPerHour) return null;

        await InvalidateAsync(user.Id, ct);
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = RefreshTokenService.Hash(raw),
            ExpiresAt = now + Lifetime,
            CreatedAt = now
        });
        return raw;
    }

    /// <summary>Geçerli (kullanılmamış, süresi dolmamış) anahtarı ve sahibini bulur.</summary>
    public async Task<PasswordResetToken?> FindValidAsync(string raw, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(raw) || raw.Length > 100) return null;
        var hash = RefreshTokenService.Hash(raw);
        var now = time.GetUtcNow();
        // İstek kimliksiz gelir: firma filtresi devre dışı (yoksa kişi kaydı süzülür ve anahtar bulunamaz).
        return await db.PasswordResetTokens.IgnoreQueryFilters()
            .Include(t => t.User).ThenInclude(u => u!.Company)
            .FirstOrDefaultAsync(t => t.TokenHash == hash && t.UsedAt == null && t.ExpiresAt > now, ct);
    }

    /// <summary>Hesabın kullanılmamış tüm anahtarlarını geçersiz kılar.</summary>
    public async Task InvalidateAsync(Guid userId, CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var open = await db.PasswordResetTokens.Where(t => t.UserId == userId && t.UsedAt == null).ToListAsync(ct);
        foreach (var t in open) t.UsedAt = now;
    }
}
