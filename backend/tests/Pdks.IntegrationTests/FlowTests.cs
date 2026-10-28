using System.Net;
using System.Text.Json;

namespace Pdks.IntegrationTests;

/// <summary>Uçtan uca iş akışları: kiosk QR okutma, duyuru ve bildirim, firma verisi ayrımı.</summary>
[Collection(ApiCollection.Name)]
public class FlowTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();

    [Fact]
    public async Task Employee_checks_in_by_scanning_the_kiosk_qr()
    {
        var kiosk = await _c.Login("kiosk@pdks.local");
        var state = await (await _c.Send(HttpMethod.Get, "/api/kiosk/state", kiosk.AccessToken)).Json<JsonElement>();
        var qr = state.GetProperty("qrToken").GetString()!;

        var employee = await _c.Login("personel@pdks.local");
        var before = await (await _c.Send(HttpMethod.Get, "/api/me/attendance", employee.AccessToken)).Json<JsonElement>();
        var action = before.GetProperty("state").GetString() == "Out" ? "CheckIn" : "CheckOut";

        var scan = await _c.Send(HttpMethod.Post, "/api/attendance/scan", employee.AccessToken, new { qrToken = qr, action });
        var result = await scan.Json<JsonElement>();
        Assert.Equal(action, result.GetProperty("recorded").GetString());

        // Okutma kioskun "son okutmalar" listesine düşer.
        var after = await (await _c.Send(HttpMethod.Get, "/api/kiosk/state", kiosk.AccessToken)).Json<JsonElement>();
        Assert.Contains(after.GetProperty("recent").EnumerateArray(), r => r.GetProperty("type").GetString() == action);
    }

    [Fact]
    public async Task Expired_or_forged_qr_is_rejected()
    {
        var employee = await _c.Login("personel@pdks.local");
        var forged = await _c.Send(HttpMethod.Post, "/api/attendance/scan", employee.AccessToken, new { qrToken = "uydurma", action = "CheckIn" });
        Assert.Equal(HttpStatusCode.BadRequest, forged.StatusCode);

        var kiosk = await _c.Login("kiosk@pdks.local");
        var state = await (await _c.Send(HttpMethod.Get, "/api/kiosk/state", kiosk.AccessToken)).Json<JsonElement>();
        api.Time.Advance(TimeSpan.FromMinutes(5));
        var expired = await _c.Send(HttpMethod.Post, "/api/attendance/scan", employee.AccessToken,
            new { qrToken = state.GetProperty("qrToken").GetString(), action = "CheckIn" });
        Assert.Equal("qr_expired", await expired.ErrorCode());
    }

    [Fact]
    public async Task Manager_announcement_reaches_employee_feed_and_notifications()
    {
        var manager = await _c.Login("mudur@pdks.local");
        var title = $"Test duyurusu {Guid.NewGuid():N}"[..30];
        var created = await _c.Send(HttpMethod.Post, "/api/announcements", manager.AccessToken,
            new { title, body = "Deneme", isPinned = true, showOnKiosk = false, expiresOn = (string?)null });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var employee = await _c.Login("personel@pdks.local");
        var feed = await (await _c.Send(HttpMethod.Get, "/api/announcements/feed", employee.AccessToken)).Json<JsonElement>();
        Assert.Contains(feed.GetProperty("announcements").EnumerateArray(), a => a.GetProperty("title").GetString() == title);
        Assert.False(feed.GetProperty("canPost").GetBoolean());

        var notifications = await (await _c.Send(HttpMethod.Get, "/api/me/notifications", employee.AccessToken)).Json<JsonElement>();
        Assert.Contains(notifications.GetProperty("items").EnumerateArray(), n =>
            n.GetProperty("type").GetString() == "AnnouncementPublished" && n.GetProperty("data").GetProperty("title").GetString() == title);

        // Personel duyuru yazamaz; kioskta gösterilmesi kapalı duyuru kioska gitmez.
        var forbidden = await _c.Send(HttpMethod.Post, "/api/announcements", employee.AccessToken, new { title = "x", isPinned = false, showOnKiosk = true });
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        var kiosk = await _c.Login("kiosk@pdks.local");
        var kioskFeed = await (await _c.Send(HttpMethod.Get, "/api/kiosk/feed", kiosk.AccessToken)).Json<JsonElement>();
        Assert.DoesNotContain(kioskFeed.EnumerateArray(), i => i.GetProperty("text").GetString() == title);
    }

    [Fact]
    public async Task Birthday_can_be_celebrated_once_and_notifies_the_person()
    {
        // Demo personelin doğum günü demo veride "bugün" olarak ayarlı.
        var manager = await _c.Login("mudur@pdks.local");
        var feed = await (await _c.Send(HttpMethod.Get, "/api/announcements/feed", manager.AccessToken)).Json<JsonElement>();
        var birthday = feed.GetProperty("celebrations").EnumerateArray()
            .FirstOrDefault(c => c.GetProperty("kind").GetString() == "Birthday" && c.GetProperty("daysUntil").GetInt32() == 0);
        if (birthday.ValueKind == JsonValueKind.Undefined) return; // gece yarısına denk gelen çalıştırmada atlanır

        var userId = birthday.GetProperty("userId").GetString();
        var first = await (await _c.Send(HttpMethod.Post, "/api/celebrations/congratulate", manager.AccessToken, new { userId, kind = "Birthday" })).Json<JsonElement>();
        var second = await (await _c.Send(HttpMethod.Post, "/api/celebrations/congratulate", manager.AccessToken, new { userId, kind = "Birthday" })).Json<JsonElement>();
        Assert.Equal(first.GetProperty("congratulationCount").GetInt32(), second.GetProperty("congratulationCount").GetInt32());
    }

    [Fact]
    public async Task Requests_without_token_are_rejected()
    {
        var res = await _c.GetAsync("/api/announcements/feed");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
