using System.Text.Json;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Alerts;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;

namespace Pdks.IntegrationTests;

/// <summary>Anlık uyarı (gelmedi) ve canlı bağlantı: müdüre bildirim düşer, açık ekranına anında haber gider.</summary>
[Collection(ApiCollection.Name)]
public class AlertTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    [Fact]
    public async Task Manager_is_alerted_once_when_employee_does_not_show_up()
    {
        // Gece yarısına yakınsa vardiya "bugün" başlamış olsun diye saat ileri alınır.
        if (TimeZoneInfo.ConvertTime(api.Time.GetUtcNow(), Istanbul).Hour < 2) api.Time.Advance(TimeSpan.FromHours(3));
        var localNow = TimeZoneInfo.ConvertTime(api.Time.GetUtcNow(), Istanbul);
        var today = DateOnly.FromDateTime(localNow.DateTime);
        var start = TimeOnly.FromDateTime(localNow.DateTime).AddMinutes(-60);
        start = new TimeOnly(start.Hour, start.Minute / 5 * 5);
        var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));

        // Diğer testleri etkilememek için ayrı şube: bir müdür ve bir personel.
        var branchId = await NewBranchAsync();
        var admin = await _c.Login("admin@pdks.local");
        var (managerToken, _) = await NewUserAsync(admin.AccessToken, "Manager", branchId);
        var (_, employeeId) = await NewUserAsync(admin.AccessToken, "Employee", branchId);

        var from = weekStart.ToString("yyyy-MM-dd");
        var to = weekStart.AddDays(6).ToString("yyyy-MM-dd");
        var planner = await (await _c.Send(HttpMethod.Get, $"/api/shifts?from={from}&to={to}", managerToken)).Json<JsonElement>();
        var staff = planner.GetProperty("staff").EnumerateArray().Select(s => s.GetProperty("id").GetString()!).ToList();
        Assert.Equal(2, staff.Count);
        var cells = staff.SelectMany(u => Enumerable.Range(0, 7).Select(i => new { userId = u, date = weekStart.AddDays(i).ToString("yyyy-MM-dd") })).ToList();
        (await _c.Send(HttpMethod.Post, "/api/shifts/assign", managerToken, new { cells, kind = "WeeklyOff" })).EnsureSuccessStatusCode();
        (await _c.Send(HttpMethod.Post, "/api/shifts/assign", managerToken, new
        {
            cells = new[] { new { userId = employeeId, date = today.ToString("yyyy-MM-dd") } },
            startTime = start.ToString("HH:mm"), endTime = start.AddHours(8).ToString("HH:mm"), kind = "Work"
        })).EnsureSuccessStatusCode();

        // Müdürün ekranı canlı bağlantıda
        var pings = 0;
        await using var hub = new HubConnectionBuilder()
            .WithUrl(new Uri(api.Server.BaseAddress, "/api/hubs/live"), o =>
            {
                o.HttpMessageHandlerFactory = _ => api.Server.CreateHandler();
                o.Transports = HttpTransportType.LongPolling;
                o.AccessTokenProvider = () => Task.FromResult<string?>(managerToken);
            })
            .Build();
        hub.On("notifications", () => Interlocked.Increment(ref pings));
        await hub.StartAsync();

        // Plan yayınlanmadan uyarı yok (personel vardiyasını bilmiyor).
        await ScanAsync();
        Assert.Equal(0, await AlertCountAsync(managerToken, employeeId));

        var publish = await _c.Send(HttpMethod.Post, "/api/shifts/publish", managerToken, new { weekStart = from });
        Assert.True(publish.IsSuccessStatusCode, await publish.Content.ReadAsStringAsync());
        await ScanAsync();
        await ScanAsync(); // ikinci tur aynı uyarıyı tekrar göndermez
        Assert.Equal(1, await AlertCountAsync(managerToken, employeeId));

        for (var i = 0; i < 50 && Volatile.Read(ref pings) == 0; i++) await Task.Delay(100);
        Assert.True(pings > 0, "Müdürün açık ekranına canlı haber gitmedi.");
    }

    private async Task ScanAsync()
    {
        using var scope = api.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AttendanceAlertScanner>().RunAsync();
    }

    private async Task<int> AlertCountAsync(string token, string userId)
    {
        var notes = await (await _c.Send(HttpMethod.Get, "/api/me/notifications?take=50", token)).Json<JsonElement>();
        return notes.GetProperty("items").EnumerateArray().Count(n =>
            n.GetProperty("type").GetString() == "EmployeeNotArrived" &&
            n.GetProperty("data").GetProperty("userId").GetString() == userId);
    }

    private async Task<Guid> NewBranchAsync()
    {
        using var scope = api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PdksDbContext>();
        var companyId = await db.Companies.Select(c => c.Id).FirstAsync();
        scope.ServiceProvider.GetRequiredService<TenantOverride>().CompanyId = companyId;
        var branch = new Branch { Name = $"Uyarı {Guid.NewGuid():N}"[..20] };
        db.Branches.Add(branch);
        await db.SaveChangesAsync();
        return branch.Id;
    }

    private async Task<(string Token, string Id)> NewUserAsync(string adminToken, string role, Guid branchId)
    {
        var email = $"uyari.{Guid.NewGuid():N}@pdks.local";
        var created = await (await _c.Send(HttpMethod.Post, "/api/users", adminToken,
            new { firstName = "Uyarı", lastName = role, email, role, branchId })).Json<JsonElement>();
        var temp = created.GetProperty("temporaryPassword").GetString()!;
        var s = await _c.Login(email, temp);
        var changed = await (await _c.Send(HttpMethod.Post, "/api/auth/change-password", s.AccessToken,
            new { currentPassword = temp, newPassword = "YeniSifre123" })).Json<JsonElement>();
        return (changed.GetProperty("accessToken").GetString()!, created.GetProperty("user").GetProperty("id").GetString()!);
    }
}
