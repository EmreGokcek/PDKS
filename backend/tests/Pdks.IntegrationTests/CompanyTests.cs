using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Pdks.IntegrationTests;

/// <summary>Firma kendi kendine kayıt ve firma ayarları (şube, kiosk).</summary>
[Collection(ApiCollection.Name)]
public class CompanyTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();

    private Task<HttpResponseMessage> Register(string email, string password = "GucluSifre123", string version = "2026-10") =>
        _c.PostAsJsonAsync("/api/auth/register", new
        {
            companyName = "Yeni Kafe Ltd.",
            branchName = "Kadıköy",
            firstName = "Ayşe",
            lastName = "Kurucu",
            email,
            password,
            privacyNoticeVersion = version
        });

    [Fact]
    public async Task New_company_registers_and_sees_only_its_own_data()
    {
        Assert.True((await (await _c.GetAsync("/api/auth/registration")).Json<JsonElement>()).GetProperty("enabled").GetBoolean());

        var email = $"kurucu.{Guid.NewGuid():N}@yenikafe.test";
        var res = await Register(email);
        var body = await res.Json<JsonElement>();
        Assert.NotNull(HttpTestExtensions.SetCookieHeader(res)); // oturum çerezi
        var user = body.GetProperty("user");
        Assert.Equal("Admin", user.GetProperty("role").GetString());
        Assert.Equal("Yeni Kafe Ltd.", user.GetProperty("companyName").GetString());
        Assert.Equal("Kadıköy", user.GetProperty("branchName").GetString());
        Assert.True(user.GetProperty("privacyNoticeAccepted").GetBoolean());
        Assert.False(user.GetProperty("mustChangePassword").GetBoolean());
        var token = body.GetProperty("accessToken").GetString()!;

        // Yalnızca kendi firması: personel listesinde tek kişi, hazır vardiya şablonları var.
        var staff = await (await _c.Send(HttpMethod.Get, "/api/users", token)).Json<JsonElement>();
        Assert.Equal(email, Assert.Single(staff.EnumerateArray()).GetProperty("email").GetString());
        var templates = await (await _c.Send(HttpMethod.Get, "/api/shift-templates", token)).Json<JsonElement>();
        Assert.Equal(4, templates.GetArrayLength());

        // Aynı e-posta ikinci kez kullanılamaz; zayıf şifre ve eski aydınlatma metni reddedilir.
        Assert.Equal("email_taken", await (await Register(email)).ErrorCode());
        Assert.Equal("weak_password", await (await Register($"z.{Guid.NewGuid():N}@x.test", "kisa")).ErrorCode());
        Assert.Equal("privacy_notice_outdated", await (await Register($"z.{Guid.NewGuid():N}@x.test", version: "2000-01")).ErrorCode());

        // Firma ayarları: kiosk ekle → kiosk hesabıyla giriş yapılır, kiosk ekranı açılır.
        var settings = await (await _c.Send(HttpMethod.Get, "/api/company", token)).Json<JsonElement>();
        var branchId = Assert.Single(settings.GetProperty("branches").EnumerateArray()).GetProperty("id").GetString();
        Assert.Empty(settings.GetProperty("kiosks").EnumerateArray());

        var created = await (await _c.Send(HttpMethod.Post, "/api/company/kiosks", token, new { name = "Ön Kapı", branchId })).Json<JsonElement>();
        var kioskEmail = created.GetProperty("kiosk").GetProperty("email").GetString()!;
        var kioskId = created.GetProperty("kiosk").GetProperty("id").GetString();
        var kiosk = await _c.Login(kioskEmail, created.GetProperty("password").GetString()!);
        Assert.Equal("Kiosk", kiosk.User.GetProperty("role").GetString());
        var state = await _c.Send(HttpMethod.Get, "/api/kiosk/state", kiosk.AccessToken);
        Assert.True(state.IsSuccessStatusCode, await state.Content.ReadAsStringAsync());

        // Kiosk kapatılınca hesabıyla giriş yapılamaz.
        (await _c.Send(HttpMethod.Post, $"/api/company/kiosks/{kioskId}/deactivate", token)).EnsureSuccessStatusCode();
        var denied = await _c.LoginRaw(kioskEmail, created.GetProperty("password").GetString()!);
        Assert.False(denied.IsSuccessStatusCode);

        // Yeni şube eklenir; tek açık şube kapatılamaz kuralı ve personeli olan şube kuralı.
        var second = await (await _c.Send(HttpMethod.Post, "/api/company/branches", token, new { name = "Beşiktaş" })).Json<JsonElement>();
        Assert.Equal("Europe/Istanbul", second.GetProperty("timeZone").GetString());
        Assert.Equal("branch_has_staff", await (await _c.Send(HttpMethod.Put, $"/api/company/branches/{branchId}", token,
            new { name = "Kadıköy", isActive = false })).ErrorCode());
        Assert.Equal("invalid_timezone", await (await _c.Send(HttpMethod.Post, "/api/company/branches", token,
            new { name = "Ay", timeZone = "Mars/Olympus" })).ErrorCode());

        // Demo firmanın yöneticisi bu firmanın kioskunu göremez; müdür firma ayarlarına giremez.
        var demoAdmin = await _c.Login("admin@pdks.local");
        var demo = await (await _c.Send(HttpMethod.Get, "/api/company", demoAdmin.AccessToken)).Json<JsonElement>();
        Assert.DoesNotContain(demo.GetProperty("kiosks").EnumerateArray(), k => k.GetProperty("email").GetString() == kioskEmail);
        var manager = await _c.Login("mudur@pdks.local");
        Assert.Equal(HttpStatusCode.Forbidden, (await _c.Send(HttpMethod.Get, "/api/company", manager.AccessToken)).StatusCode);
    }
}
