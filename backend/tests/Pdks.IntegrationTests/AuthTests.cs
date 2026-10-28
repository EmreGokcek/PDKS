using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Pdks.IntegrationTests;

[Collection(ApiCollection.Name)]
public class AuthTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();

    /// <summary>Yönetici hesabıyla yeni bir personel açar; geçici şifresini döner.</summary>
    private async Task<(string Email, string Password)> NewEmployee()
    {
        var admin = await _c.Login("admin@pdks.local");
        var email = $"test.{Guid.NewGuid():N}@pdks.local";
        var res = await _c.Send(HttpMethod.Post, "/api/users", admin.AccessToken,
            new { firstName = "Test", lastName = "Kişi", email, role = "Employee" });
        var body = await res.Json<JsonElement>();
        return (email, body.GetProperty("temporaryPassword").GetString()!);
    }

    [Fact]
    public async Task Login_sets_http_only_refresh_cookie_and_short_access_token()
    {
        var res = await _c.LoginRaw("admin@pdks.local", PdksApiFactory.DemoPassword, remember: true);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var header = HttpTestExtensions.SetCookieHeader(res)!;
        Assert.Contains("httponly", header, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", header, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/auth", header, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("expires=", header, StringComparison.OrdinalIgnoreCase); // beni hatırla → kalıcı

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var expires = body.GetProperty("expiresAt").GetDateTimeOffset();
        Assert.True(expires - DateTimeOffset.UtcNow <= TimeSpan.FromMinutes(16));
    }

    [Fact]
    public async Task Without_remember_me_cookie_is_session_only()
    {
        var res = await _c.LoginRaw("admin@pdks.local", PdksApiFactory.DemoPassword);
        Assert.DoesNotContain("expires=", HttpTestExtensions.SetCookieHeader(res)!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Refresh_rotates_token_and_reuse_of_old_token_closes_the_session()
    {
        var s = await _c.Login("admin@pdks.local");

        var first = await _c.Refresh(s.RefreshCookie);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var rotated = HttpTestExtensions.RefreshCookie(first);
        Assert.NotNull(rotated);
        Assert.NotEqual(s.RefreshCookie, rotated);

        // Aynı anda açık iki sekme: eski anahtar kısa süre içinde hâlâ kabul edilir (yeni çerez verilmez).
        var parallel = await _c.Refresh(s.RefreshCookie);
        Assert.Equal(HttpStatusCode.OK, parallel.StatusCode);
        Assert.Null(HttpTestExtensions.RefreshCookie(parallel));

        // Süre geçtikten sonra eski anahtar gelirse çalınmış sayılır: tüm oturum kapanır.
        api.Time.Advance(TimeSpan.FromMinutes(2));
        var reuse = await _c.Refresh(s.RefreshCookie);
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);
        Assert.Equal("session_revoked", await reuse.ErrorCode());

        var afterReuse = await _c.Refresh(rotated);
        Assert.Equal(HttpStatusCode.Unauthorized, afterReuse.StatusCode);
    }

    [Fact]
    public async Task Refresh_without_cookie_is_rejected()
    {
        var res = await _c.Refresh(null);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("session_expired", await res.ErrorCode());
    }

    [Fact]
    public async Task Logout_revokes_the_refresh_token()
    {
        var s = await _c.Login("mudur@pdks.local");
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        req.Headers.Add("Cookie", $"pdks_rt={s.RefreshCookie}");
        Assert.Equal(HttpStatusCode.NoContent, (await _c.SendAsync(req)).StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _c.Refresh(s.RefreshCookie)).StatusCode);
    }

    [Fact]
    public async Task Session_without_remember_me_ends_after_session_hours()
    {
        var s = await _c.Login("mudur@pdks.local");
        api.Time.Advance(TimeSpan.FromHours(13));
        Assert.Equal(HttpStatusCode.Unauthorized, (await _c.Refresh(s.RefreshCookie)).StatusCode);
    }

    [Fact]
    public async Task Account_is_locked_after_repeated_wrong_passwords_and_unlocks_later()
    {
        var (email, password) = await NewEmployee();

        for (var i = 1; i <= 4; i++)
        {
            var wrong = await _c.LoginRaw(email, "yanlis-sifre-1");
            Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        }
        var fifth = await _c.LoginRaw(email, "yanlis-sifre-1");
        Assert.Equal(HttpStatusCode.TooManyRequests, fifth.StatusCode);
        Assert.Equal("account_locked", await fifth.ErrorCode());

        // Kilitliyken doğru şifre de kabul edilmez.
        var locked = await _c.LoginRaw(email, password);
        Assert.Equal("account_locked", await locked.ErrorCode());

        api.Time.Advance(TimeSpan.FromMinutes(16));
        Assert.Equal(HttpStatusCode.OK, (await _c.LoginRaw(email, password)).StatusCode);
    }

    [Fact]
    public async Task Unknown_email_gives_the_same_error_as_wrong_password()
    {
        var res = await _c.LoginRaw("olmayan.kisi@pdks.local", "herhangi-1");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
        Assert.Equal("invalid_credentials", await res.ErrorCode());
    }

    [Fact]
    public async Task Changing_password_closes_other_sessions()
    {
        var (email, temp) = await NewEmployee();
        var phone = await _c.Login(email, temp);
        var laptop = await _c.Login(email, temp);

        var res = await _c.Send(HttpMethod.Post, "/api/auth/change-password", laptop.AccessToken,
            new { currentPassword = temp, newPassword = "YeniSifre123" }, cookie: laptop.RefreshCookie);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var laptopNew = HttpTestExtensions.RefreshCookie(res);

        Assert.Equal(HttpStatusCode.Unauthorized, (await _c.Refresh(phone.RefreshCookie)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _c.Refresh(laptopNew)).StatusCode);
    }

    [Fact]
    public async Task Temporary_password_blocks_other_endpoints_until_changed()
    {
        var (email, temp) = await NewEmployee();
        var s = await _c.Login(email, temp);
        var res = await _c.Send(HttpMethod.Get, "/api/me/attendance", s.AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        Assert.Equal("password_change_required", await res.ErrorCode());
    }

    [Fact]
    public async Task Privacy_notice_must_be_accepted_with_current_version()
    {
        var (email, temp) = await NewEmployee();
        var s = await _c.Login(email, temp);
        Assert.False(s.User.GetProperty("privacyNoticeAccepted").GetBoolean());

        var changed = await _c.Send(HttpMethod.Post, "/api/auth/change-password", s.AccessToken,
            new { currentPassword = temp, newPassword = "YeniSifre123" });
        var token = (await changed.Json<JsonElement>()).GetProperty("accessToken").GetString()!;

        var outdated = await _c.Send(HttpMethod.Post, "/api/auth/privacy-notice", token, new { version = "2000-01" });
        Assert.Equal("privacy_notice_outdated", await outdated.ErrorCode());

        var ok = await (await _c.Send(HttpMethod.Post, "/api/auth/privacy-notice", token, new { version = "2026-10" })).Json<JsonElement>();
        Assert.True(ok.GetProperty("privacyNoticeAccepted").GetBoolean());
    }

    [Fact]
    public async Task Resetting_password_closes_the_users_sessions()
    {
        var (email, temp) = await NewEmployee();
        var s = await _c.Login(email, temp);
        var admin = await _c.Login("admin@pdks.local");
        var userId = s.User.GetProperty("id").GetString();

        var reset = await _c.Send(HttpMethod.Post, $"/api/users/{userId}/reset-password", admin.AccessToken);
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _c.Refresh(s.RefreshCookie)).StatusCode);
    }
}
