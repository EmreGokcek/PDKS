using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace Pdks.Infrastructure.Attendance;

/// <summary>
/// Kiosk ekranındaki dinamik QR kodun içeriği.
///
/// Biçim: {kioskId}.{pencere}.{imza}
/// - pencere: Unix zamanı / 30 sn. Her 30 saniyede bir yeni kod üretilir.
/// - imza: kioskun gizli anahtarıyla HMAC-SHA256 (ilk 16 bayt, base64url).
///
/// Okutma gecikmesine pay bırakmak için bir önceki pencere de kabul edilir;
/// böylece bir kod en fazla ~60 saniye geçerlidir. Ekran fotoğrafını evden okutmak işe yaramaz.
/// </summary>
public class KioskQrTokens(TimeProvider time)
{
    public const int WindowSeconds = 30;

    public record Parsed(Guid KioskId, long Window, string Signature);

    public (string Token, DateTimeOffset ExpiresAt) Create(Guid kioskId, string secret)
    {
        var window = CurrentWindow();
        var payload = Payload(kioskId, window);
        var expiresAt = DateTimeOffset.FromUnixTimeSeconds((window + 1) * WindowSeconds);
        return ($"{payload}.{Sign(payload, secret)}", expiresAt);
    }

    public static Parsed? Parse(string? token)
    {
        var parts = token?.Trim().Split('.');
        if (parts is not { Length: 3 }) return null;
        if (!Guid.TryParseExact(parts[0], "N", out var kioskId)) return null;
        if (!long.TryParse(parts[1], out var window)) return null;
        return new Parsed(kioskId, window, parts[2]);
    }

    public enum Result { Valid, Invalid, Expired }

    public Result Verify(Parsed token, string secret)
    {
        var expected = Sign(Payload(token.KioskId, token.Window), secret);
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(token.Signature)))
            return Result.Invalid;

        var current = CurrentWindow();
        return token.Window == current || token.Window == current - 1 ? Result.Valid : Result.Expired;
    }

    private long CurrentWindow() => time.GetUtcNow().ToUnixTimeSeconds() / WindowSeconds;

    private static string Payload(Guid kioskId, long window) => $"{kioskId:N}.{window}";

    private static string Sign(string payload, string secret)
    {
        var hash = HMACSHA256.HashData(Convert.FromBase64String(secret), Encoding.UTF8.GetBytes(payload));
        return Base64Url.EncodeToString(hash.AsSpan(0, 16));
    }
}
