using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Pdks.IntegrationTests;

/// <summary>"Şifremi unuttum": e-postadaki tek kullanımlık bağlantıyla yeni şifre.</summary>
[Collection(ApiCollection.Name)]
public class PasswordResetTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();

    private Task<HttpResponseMessage> Forgot(string email) => _c.PostAsJsonAsync("/api/auth/forgot-password", new { email });
    private Task<HttpResponseMessage> Reset(string token, string newPassword) =>
        _c.PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword });

    [Fact]
    public async Task Employee_resets_password_with_emailed_link_once()
    {
        var admin = await _c.Login("admin@pdks.local");
        var email = $"unuttu.{Guid.NewGuid():N}@pdks.local";
        var created = await (await _c.Send(HttpMethod.Post, "/api/users", admin.AccessToken,
            new { firstName = "Unutkan", lastName = "Personel", email, role = "Employee" })).Json<JsonElement>();
        var temp = created.GetProperty("temporaryPassword").GetString()!;
        var oldSession = await _c.Login(email, temp);

        // Olmayan hesapta da aynı yanıt; e-posta gitmez.
        Assert.Equal(HttpStatusCode.NoContent, (await Forgot("yok.boyle.biri@pdks.local")).StatusCode);
        Assert.Empty(api.Emails.To("yok.boyle.biri@pdks.local"));

        Assert.Equal(HttpStatusCode.NoContent, (await Forgot(email.ToUpperInvariant())).StatusCode);
        var mail = Assert.Single(api.Emails.To(email));
        Assert.Contains("Unutkan", mail.TextBody);
        var token = Regex.Match(mail.TextBody, @"/sifre-sifirla\?token=([A-Za-z0-9_\-%]+)").Groups[1].Value;
        token = Uri.UnescapeDataString(token);
        Assert.NotEmpty(token);

        Assert.Equal("weak_password", await (await Reset(token, "kisa")).ErrorCode());
        Assert.Equal(HttpStatusCode.NoContent, (await Reset(token, "YepYeni2026")).StatusCode);

        // Bağlantı ikinci kez kullanılamaz; eski oturum kapandı; yeni şifreyle giriş yapılır ve şifre değiştirme istenmez.
        Assert.Equal("invalid_reset_token", await (await Reset(token, "BaskaSifre99")).ErrorCode());
        Assert.False((await _c.Refresh(oldSession.RefreshCookie)).IsSuccessStatusCode);
        var fresh = await _c.Login(email, "YepYeni2026");
        Assert.False(fresh.User.GetProperty("mustChangePassword").GetBoolean());
        Assert.Equal("invalid_reset_token", await (await Reset("uydurma-anahtar", "YepYeni2026")).ErrorCode());
    }

    [Fact]
    public async Task Reset_link_expires_and_requests_are_limited()
    {
        var admin = await _c.Login("admin@pdks.local");
        var email = $"sinir.{Guid.NewGuid():N}@pdks.local";
        (await _c.Send(HttpMethod.Post, "/api/users", admin.AccessToken,
            new { firstName = "Sınır", lastName = "Deneme", email, role = "Employee" })).EnsureSuccessStatusCode();

        for (var i = 0; i < 5; i++) await Forgot(email);
        Assert.Equal(3, api.Emails.To(email).Count); // saatte en fazla 3

        // Yalnızca son bağlantı geçerli; o da 30 dakika sonra geçersiz.
        var tokens = api.Emails.To(email)
            .Select(m => Uri.UnescapeDataString(Regex.Match(m.TextBody, @"token=([A-Za-z0-9_\-%]+)").Groups[1].Value)).ToList();
        Assert.Equal("invalid_reset_token", await (await Reset(tokens[0], "YepYeni2026")).ErrorCode());
        api.Time.Advance(TimeSpan.FromMinutes(31));
        Assert.Equal("invalid_reset_token", await (await Reset(tokens[^1], "YepYeni2026")).ErrorCode());
    }
}
