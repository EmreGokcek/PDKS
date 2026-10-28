using System.Net;
using System.Text.Json;

namespace Pdks.IntegrationTests;

/// <summary>docs/YETKILER.md tablosunun testleri: kim neye erişebilir, kim neye erişemez.</summary>
[Collection(ApiCollection.Name)]
public class PermissionTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();

    private Task<TestWorld> World() => TestWorld.GetAsync(api);

    public static TheoryData<string, string, string> Forbidden => new()
    {
        // rol e-postası, yöntem, adres
        { "personel@pdks.local", "GET", "/api/users" },
        { "personel@pdks.local", "GET", "/api/dashboard/live" },
        { "personel@pdks.local", "GET", "/api/reports/monthly?year=2026&month=10" },
        { "personel@pdks.local", "GET", "/api/shifts?from=2026-10-26&to=2026-11-01" },
        { "personel@pdks.local", "GET", "/api/requests" },
        { "personel@pdks.local", "GET", "/api/audit" },
        { "personel@pdks.local", "POST", "/api/announcements" },
        { "mudur@pdks.local", "POST", "/api/users" },
        { "mudur@pdks.local", "PUT", "/api/settings/work-rules" },
        { "mudur@pdks.local", "GET", "/api/audit" },
        { "kiosk@pdks.local", "GET", "/api/me/attendance" },
        { "kiosk@pdks.local", "GET", "/api/users" },
        { "kiosk@pdks.local", "GET", "/api/announcements/feed" },
        { "kiosk@pdks.local", "GET", "/api/settings/work-rules" },
        { "kiosk@pdks.local", "GET", "/api/dashboard/live" },
    };

    [Theory]
    [MemberData(nameof(Forbidden))]
    public async Task Role_cannot_reach_endpoint(string email, string method, string url)
    {
        var s = await _c.Login(email);
        var body = method == "GET" ? null : new { };
        var res = await _c.Send(new HttpMethod(method), url, s.AccessToken, body);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Manager_sees_only_own_branch_and_not_admins()
    {
        var w = await World();
        var m = await _c.Login("mudur@pdks.local");

        var list = await (await _c.Send(HttpMethod.Get, "/api/users", m.AccessToken)).Json<JsonElement>();
        var ids = list.EnumerateArray().Select(u => u.GetProperty("id").GetGuid()).ToList();
        Assert.Contains(w.DemoEmployee.Id, ids);
        Assert.Contains(w.SecondManager.Id, ids);
        Assert.DoesNotContain(w.OtherBranchEmployee.Id, ids);
        Assert.DoesNotContain(w.DemoAdmin.Id, ids);

        Assert.Equal(HttpStatusCode.NotFound, (await _c.Send(HttpMethod.Get, $"/api/users/{w.OtherBranchEmployee.Id}", m.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _c.Send(HttpMethod.Get, $"/api/users/{w.OtherBranchEmployee.Id}/profile", m.AccessToken)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await _c.Send(HttpMethod.Get, $"/api/staff/{w.OtherBranchEmployee.Id}/attendance?date=2026-10-27", m.AccessToken)).StatusCode);
    }

    [Fact]
    public async Task Manager_corrects_only_employees_and_never_own_records()
    {
        var w = await World();
        var m = await _c.Login("mudur@pdks.local");
        var body = new { type = "CheckIn", date = "2026-10-01", time = "09:00", reason = "Test düzeltmesi" };

        // Başka müdürün kaydını görebilir ama düzeltemez
        Assert.Equal(HttpStatusCode.OK, (await _c.Send(HttpMethod.Get, $"/api/staff/{w.SecondManager.Id}/attendance?date=2026-10-01", m.AccessToken)).StatusCode);
        var other = await _c.Send(HttpMethod.Post, $"/api/staff/{w.SecondManager.Id}/attendance", m.AccessToken, body);
        Assert.Equal("not_your_staff", await other.ErrorCode());

        var own = await _c.Send(HttpMethod.Post, $"/api/staff/{w.DemoManager.Id}/attendance", m.AccessToken, body);
        Assert.Equal("cannot_edit_own", await own.ErrorCode());

        // Yönetici müdürün kaydını düzeltebilir
        var admin = await _c.Login("admin@pdks.local");
        var byAdmin = await _c.Send(HttpMethod.Post, $"/api/staff/{w.SecondManager.Id}/attendance", admin.AccessToken, body);
        Assert.True(byAdmin.IsSuccessStatusCode, await byAdmin.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Manager_request_is_reviewed_by_admin_not_by_other_managers()
    {
        var w = await World();
        var m3 = await _c.Login("mudur3@pdks.local");
        var created = await (await _c.Send(HttpMethod.Post, "/api/me/requests", m3.AccessToken, new
        {
            type = "Leave", leaveKind = "ExcusedLeave", startDate = "2026-12-01", endDate = "2026-12-01", reason = "Mazeret testi"
        })).Json<JsonElement>();
        var id = created.GetProperty("id").GetString();

        var m = await _c.Login("mudur@pdks.local");
        var list = await (await _c.Send(HttpMethod.Get, "/api/requests", m.AccessToken)).Json<JsonElement>();
        Assert.DoesNotContain(list.EnumerateArray(), r => r.GetProperty("id").GetString() == id);
        Assert.Equal(HttpStatusCode.NotFound, (await _c.Send(HttpMethod.Post, $"/api/requests/{id}/approve", m.AccessToken, new { })).StatusCode);

        var admin = await _c.Login("admin@pdks.local");
        Assert.Equal(HttpStatusCode.OK, (await _c.Send(HttpMethod.Post, $"/api/requests/{id}/approve", admin.AccessToken, new { })).StatusCode);
        _ = w;
    }

    [Fact]
    public async Task Companies_never_see_each_others_data()
    {
        var w = await World();
        var rival = await _c.Login("admin@rakip.local");

        var list = await (await _c.Send(HttpMethod.Get, "/api/users", rival.AccessToken)).Json<JsonElement>();
        Assert.All(list.EnumerateArray(), u => Assert.EndsWith("@rakip.local", u.GetProperty("email").GetString()));
        Assert.Equal(HttpStatusCode.NotFound, (await _c.Send(HttpMethod.Get, $"/api/users/{w.DemoEmployee.Id}", rival.AccessToken)).StatusCode);

        var feed = await (await _c.Send(HttpMethod.Get, "/api/announcements/feed", rival.AccessToken)).Json<JsonElement>();
        Assert.Empty(feed.GetProperty("announcements").EnumerateArray());

        var audit = await (await _c.Send(HttpMethod.Get, "/api/audit", rival.AccessToken)).Json<JsonElement>();
        Assert.DoesNotContain(audit.GetProperty("items").EnumerateArray(), a => a.GetProperty("targetName").GetString() == "Demo Personel");
    }

    [Fact]
    public async Task Admin_reads_the_audit_log_with_filters()
    {
        var admin = await _c.Login("admin@pdks.local");
        var page = await (await _c.Send(HttpMethod.Get, "/api/audit?take=10", admin.AccessToken)).Json<JsonElement>();
        Assert.True(page.GetProperty("items").GetArrayLength() > 0);

        var users = await (await _c.Send(HttpMethod.Get, "/api/audit?category=users&take=50", admin.AccessToken)).Json<JsonElement>();
        Assert.All(users.GetProperty("items").EnumerateArray(), a =>
            Assert.True(a.GetProperty("action").GetString()!.StartsWith("user.") || a.GetProperty("action").GetString()!.StartsWith("profile.")));
    }
}
