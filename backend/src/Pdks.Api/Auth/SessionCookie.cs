using Pdks.Infrastructure.Auth;

namespace Pdks.Api.Auth;

/// <summary>
/// Yenileme anahtarını taşıyan çerez. JavaScript okuyamaz (HttpOnly), yalnızca /api/auth isteklerine gider,
/// başka sitelerden gelen isteklerle gönderilmez (SameSite=Strict).
/// </summary>
public static class SessionCookie
{
    public const string Name = "pdks_rt";
    private const string Path = "/api/auth";

    public static string? Read(HttpRequest request) =>
        request.Cookies.TryGetValue(Name, out var v) && !string.IsNullOrWhiteSpace(v) ? v : null;

    public static void Write(HttpResponse response, IssuedToken token, bool secure) =>
        response.Cookies.Append(Name, token.Raw, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = Path,
            // "Beni hatırla" yoksa oturum çerezi: tarayıcı kapanınca silinir.
            Expires = token.Persistent ? token.ExpiresAt : null,
            IsEssential = true
        });

    public static void Clear(HttpResponse response, bool secure) =>
        response.Cookies.Delete(Name, new CookieOptions { Path = Path, Secure = secure, SameSite = SameSiteMode.Strict, HttpOnly = true });
}
