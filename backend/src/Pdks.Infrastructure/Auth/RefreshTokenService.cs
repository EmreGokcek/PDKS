using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Auth;

public class LoginSessionOptions
{
    public const string SectionName = "Session";

    /// <summary>"Beni hatırla" seçilmediğinde oturumun en uzun süresi (saat).</summary>
    public int SessionHours { get; set; } = 12;
    /// <summary>"Beni hatırla" seçildiğinde: her kullanımda bu kadar gün uzar.</summary>
    public int RememberDays { get; set; } = 30;
    /// <summary>Aynı anda açık iki sekme aynı anahtarla yenilerse ikincisi bu süre içinde reddedilmez.</summary>
    public int ReuseGraceSeconds { get; set; } = 30;
    /// <summary>Art arda bu kadar hatalı şifreden sonra hesap geçici kilitlenir.</summary>
    public int MaxFailedLogins { get; set; } = 5;
    public int LockoutMinutes { get; set; } = 15;
}

public enum RefreshOutcome { Ok, Grace, Invalid, Reused }

public record IssuedToken(string Raw, DateTimeOffset ExpiresAt, bool Persistent);

public record RefreshResult(RefreshOutcome Outcome, User? User, IssuedToken? NewToken);

/// <summary>Yenileme anahtarlarını üretir, döndürür ve iptal eder. Değişiklikler SaveChanges ile birlikte yazılır.</summary>
public class RefreshTokenService(PdksDbContext db, IOptions<LoginSessionOptions> options, TimeProvider time)
{
    private readonly LoginSessionOptions _o = options.Value;

    public static string Hash(string raw) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));

    /// <summary>Yeni bir anahtar üretir (yeni oturumda yeni aile; yenilemede aynı aile).</summary>
    public IssuedToken Issue(User user, bool persistent, Guid? familyId = null, DateTimeOffset? sessionEnd = null)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        var now = time.GetUtcNow();
        // Kalıcı oturum her kullanımda uzar; tarayıcı oturumu ise ilk girişten itibaren sabit süreyle biter.
        var expires = persistent ? now.AddDays(_o.RememberDays) : sessionEnd ?? now.AddHours(_o.SessionHours);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = Hash(raw),
            FamilyId = familyId ?? Guid.CreateVersion7(),
            ExpiresAt = expires,
            Persistent = persistent
        });
        return new IssuedToken(raw, expires, persistent);
    }

    /// <summary>Gelen anahtarı doğrular ve yenisiyle değiştirir.</summary>
    public async Task<RefreshResult> RotateAsync(string raw, CancellationToken ct = default)
    {
        var now = time.GetUtcNow();
        var hash = Hash(raw);
        var token = await db.RefreshTokens
            .Include(t => t.User).ThenInclude(u => u!.Company)
            .Include(t => t.User).ThenInclude(u => u!.Branch)
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (token?.User is not { } user || !user.IsActive || user.Company is not { IsActive: true })
            return new RefreshResult(RefreshOutcome.Invalid, null, null);

        if (token.RevokedAt is { } revokedAt)
        {
            // İki sekme aynı anda yeniledi: yeni anahtar zaten verildi, yalnızca erişim anahtarı dönülür.
            if (token.RevokedReason == "rotated" && now - revokedAt <= TimeSpan.FromSeconds(_o.ReuseGraceSeconds)
                && token.ExpiresAt > now)
                return new RefreshResult(RefreshOutcome.Grace, user, null);

            // Daha önce kullanılmış bir anahtar tekrar geldi: çalınmış olabilir, tüm aile kapatılır.
            if (token.RevokedReason == "rotated")
            {
                await RevokeAsync(t => t.FamilyId == token.FamilyId, "reuse", ct);
                return new RefreshResult(RefreshOutcome.Reused, null, null);
            }
            return new RefreshResult(RefreshOutcome.Invalid, null, null);
        }

        if (token.ExpiresAt <= now)
            return new RefreshResult(RefreshOutcome.Invalid, null, null);

        token.RevokedAt = now;
        token.RevokedReason = "rotated";
        var next = Issue(user, token.Persistent, token.FamilyId, token.Persistent ? null : token.ExpiresAt);
        return new RefreshResult(RefreshOutcome.Ok, user, next);
    }

    /// <summary>Çıkış: bu anahtarın ailesini kapatır.</summary>
    public async Task RevokeFamilyOfAsync(string raw, string reason, CancellationToken ct = default)
    {
        var hash = Hash(raw);
        var familyId = await db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => (Guid?)t.FamilyId).FirstOrDefaultAsync(ct);
        if (familyId is { } f) await RevokeAsync(t => t.FamilyId == f, reason, ct);
    }

    /// <summary>Kişinin tüm açık oturumlarını kapatır (şifre değişti, sıfırlandı, hesap pasife alındı).</summary>
    public Task RevokeAllForUserAsync(Guid userId, string reason, CancellationToken ct = default) =>
        RevokeAsync(t => t.UserId == userId, reason, ct);

    private async Task RevokeAsync(System.Linq.Expressions.Expression<Func<RefreshToken, bool>> filter, string reason, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        await db.RefreshTokens.Where(filter).Where(t => t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.RevokedAt, (DateTimeOffset?)now)
                .SetProperty(t => t.RevokedReason, reason), ct);
    }
}
