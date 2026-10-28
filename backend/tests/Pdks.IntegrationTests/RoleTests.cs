using System.Net;
using System.Text.Json;

namespace Pdks.IntegrationTests;

/// <summary>Rollerin yetki sınırları (docs/YETKILER.md).</summary>
[Collection(ApiCollection.Name)]
public class RoleTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();

    private async Task<HttpStatusCode> Status(string email, HttpMethod method, string url, object? body = null)
    {
        var s = await _c.Login(email);
        return (await _c.Send(method, url, s.AccessToken, body)).StatusCode;
    }

    [Fact]
    public async Task Login_response_lists_permissions_and_scope()
    {
        var hr = await _c.Login("ik@pdks.local");
        var perms = hr.User.GetProperty("permissions").EnumerateArray().Select(p => p.GetString()).ToList();
        Assert.Contains("staff.manage", perms);
        Assert.DoesNotContain("shifts.plan", perms);
        Assert.True(hr.User.GetProperty("companyWide").GetBoolean());

        var manager = await _c.Login("mudur@pdks.local");
        Assert.False(manager.User.GetProperty("companyWide").GetBoolean());
    }

    [Theory]
    [InlineData("personel@pdks.local", "/api/users", HttpStatusCode.Forbidden)]
    [InlineData("personel@pdks.local", "/api/dashboard/live", HttpStatusCode.Forbidden)]
    [InlineData("personel@pdks.local", "/api/reports/monthly?year=2026&month=10", HttpStatusCode.Forbidden)]
    [InlineData("mudur@pdks.local", "/api/audit", HttpStatusCode.Forbidden)]
    [InlineData("ik@pdks.local", "/api/audit", HttpStatusCode.OK)]
    [InlineData("ik@pdks.local", "/api/users", HttpStatusCode.OK)]
    [InlineData("ik@pdks.local", "/api/shift-templates", HttpStatusCode.Forbidden)]
    [InlineData("ik@pdks.local", "/api/reports/monthly?year=2026&month=10", HttpStatusCode.OK)]
    [InlineData("kiosk@pdks.local", "/api/me/attendance", HttpStatusCode.Forbidden)]
    [InlineData("admin@pdks.local", "/api/audit", HttpStatusCode.OK)]
    public async Task Endpoint_access(string email, string url, HttpStatusCode expected) =>
        Assert.Equal(expected, await Status(email, HttpMethod.Get, url));

    [Fact]
    public async Task Hr_cannot_create_or_manage_admins()
    {
        var hr = await _c.Login("ik@pdks.local");
        var create = await _c.Send(HttpMethod.Post, "/api/users", hr.AccessToken,
            new { firstName = "Yeni", lastName = "Yönetici", email = $"y.{Guid.NewGuid():N}@pdks.local", role = "Admin" });
        Assert.Equal("invalid_role", await create.ErrorCode());

        var admin = await _c.Login("admin@pdks.local");
        var adminId = admin.User.GetProperty("id").GetString();
        var reset = await _c.Send(HttpMethod.Post, $"/api/users/{adminId}/reset-password", hr.AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, reset.StatusCode);
        Assert.Equal("cannot_manage_user", await reset.ErrorCode());

        // Personel açabilir.
        var employee = await _c.Send(HttpMethod.Post, "/api/users", hr.AccessToken,
            new { firstName = "İK", lastName = "Ekledi", email = $"ik.{Guid.NewGuid():N}@pdks.local", role = "Employee" });
        Assert.Equal(HttpStatusCode.Created, employee.StatusCode);
    }

    [Fact]
    public async Task Manager_cannot_add_staff_or_change_rules()
    {
        Assert.Equal(HttpStatusCode.Forbidden, await Status("mudur@pdks.local", HttpMethod.Post, "/api/users",
            new { firstName = "A", lastName = "B", email = $"m.{Guid.NewGuid():N}@pdks.local", role = "Employee" }));
        Assert.Equal(HttpStatusCode.Forbidden, await Status("mudur@pdks.local", HttpMethod.Put, "/api/settings/work-rules",
            new { weeklyWorkMinutes = 2700, dailyBreakMinutes = 60, lateToleranceMinutes = 5, weekStartsOn = "Monday" }));
    }

    [Fact]
    public async Task Audit_log_records_who_did_what()
    {
        var hr = await _c.Login("ik@pdks.local");
        await _c.Send(HttpMethod.Post, "/api/users", hr.AccessToken,
            new { firstName = "Denetim", lastName = "Kaydı", email = $"d.{Guid.NewGuid():N}@pdks.local", role = "Employee" });

        var page = await (await _c.Send(HttpMethod.Get, "/api/audit?area=user&take=10", hr.AccessToken)).Json<JsonElement>();
        var created = page.GetProperty("items").EnumerateArray().First(i => i.GetProperty("action").GetString() == "user.created");
        Assert.Equal("Demo İK", created.GetProperty("actorName").GetString());
        Assert.Equal("Denetim Kaydı", created.GetProperty("subjectName").GetString());
    }
}
