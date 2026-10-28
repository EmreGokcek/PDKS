using System.Net;
using System.Text.Json;

namespace Pdks.IntegrationTests;

/// <summary>Vardiya takası akışı: isteyen → ekip arkadaşı kabul → müdür onay → plan değişir.</summary>
[Collection(ApiCollection.Name)]
public class SwapTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();

    [Fact]
    public async Task Swap_goes_through_peer_and_manager_and_changes_the_plan()
    {
        var today = DateOnly.FromDateTime(api.Time.GetUtcNow().UtcDateTime);
        var weekStart = today.AddDays(28 - ((int)today.DayOfWeek + 6) % 7); // 4 hafta sonraki pazartesi
        var day = weekStart.AddDays(2);
        var to = weekStart.AddDays(6).ToString("yyyy-MM-dd");
        var from = weekStart.ToString("yyyy-MM-dd");

        var manager = await _c.Login("mudur@pdks.local");
        var employee = await _c.Login("personel@pdks.local");
        var hr = await _c.Login("ik@pdks.local");
        var employeeId = employee.User.GetProperty("id").GetString()!;
        var hrId = hr.User.GetProperty("id").GetString()!;

        // Plan: herkes hafta tatili, personel çarşamba 09–18 çalışıyor; hafta yayınlanır.
        var planner = await (await _c.Send(HttpMethod.Get, $"/api/shifts?from={from}&to={to}", manager.AccessToken)).Json<JsonElement>();
        var staff = planner.GetProperty("staff").EnumerateArray().Select(s => s.GetProperty("id").GetString()!).ToList();
        var allCells = staff.SelectMany(u => Enumerable.Range(0, 7).Select(i => new { userId = u, date = weekStart.AddDays(i).ToString("yyyy-MM-dd") })).ToList();
        (await _c.Send(HttpMethod.Post, "/api/shifts/assign", manager.AccessToken, new { cells = allCells, kind = "WeeklyOff" })).EnsureSuccessStatusCode();
        (await _c.Send(HttpMethod.Post, "/api/shifts/assign", manager.AccessToken,
            new { cells = new[] { new { userId = employeeId, date = day.ToString("yyyy-MM-dd") } }, startTime = "09:00", endTime = "18:00", kind = "Work" })).EnsureSuccessStatusCode();
        var publish = await _c.Send(HttpMethod.Post, "/api/shifts/publish", manager.AccessToken, new { weekStart = from });
        Assert.True(publish.IsSuccessStatusCode, await publish.Content.ReadAsStringAsync());

        // Personel takas ister: İK o gün hafta tatilinde, uygun görünür.
        var myShifts = await (await _c.Send(HttpMethod.Get, $"/api/me/shifts?from={from}&to={to}", employee.AccessToken)).Json<JsonElement>();
        var shiftId = myShifts.EnumerateArray().First(s => s.GetProperty("date").GetString() == day.ToString("yyyy-MM-dd")).GetProperty("id").GetString();
        var candidates = await (await _c.Send(HttpMethod.Get, $"/api/me/swaps/candidates?shiftId={shiftId}", employee.AccessToken)).Json<JsonElement>();
        var hrCandidate = candidates.EnumerateArray().First(c => c.GetProperty("userId").GetString() == hrId);
        Assert.True(hrCandidate.GetProperty("available").GetBoolean());
        Assert.Equal("WeeklyOff", hrCandidate.GetProperty("shift").GetProperty("kind").GetString());

        var swap = await (await _c.Send(HttpMethod.Post, "/api/me/swaps", employee.AccessToken, new { shiftId, targetUserId = hrId, note = "Doktor randevusu" })).Json<JsonElement>();
        var swapId = swap.GetProperty("id").GetString();
        Assert.Equal("PendingPeer", swap.GetProperty("status").GetString());

        // Müdür, arkadaş kabul etmeden onaylayamaz; personel müdür listesine erişemez.
        Assert.Equal("swap_not_pending", await (await _c.Send(HttpMethod.Post, $"/api/swaps/{swapId}/approve", manager.AccessToken, new { note = (string?)null })).ErrorCode());
        Assert.Equal(HttpStatusCode.Forbidden, (await _c.Send(HttpMethod.Get, "/api/swaps", employee.AccessToken)).StatusCode);

        var accepted = await (await _c.Send(HttpMethod.Post, $"/api/me/swaps/{swapId}/accept", hr.AccessToken)).Json<JsonElement>();
        Assert.Equal("PendingManager", accepted.GetProperty("status").GetString());

        var approved = await (await _c.Send(HttpMethod.Post, $"/api/swaps/{swapId}/approve", manager.AccessToken, new { note = "Tamam" })).Json<JsonElement>();
        Assert.Equal("Approved", approved.GetProperty("status").GetString());
        Assert.Equal("Work", approved.GetProperty("requesterShift").GetProperty("kind").GetString()); // takas öncesi hâl

        // Plan değişti: İK o gün 09–18 çalışıyor, personel hafta tatilinde.
        var hrShifts = await (await _c.Send(HttpMethod.Get, $"/api/me/shifts?from={from}&to={to}", hr.AccessToken)).Json<JsonElement>();
        var hrDay = hrShifts.EnumerateArray().First(s => s.GetProperty("date").GetString() == day.ToString("yyyy-MM-dd"));
        Assert.Equal("Work", hrDay.GetProperty("kind").GetString());
        Assert.StartsWith("09:00", hrDay.GetProperty("startTime").GetString());

        var empShifts = await (await _c.Send(HttpMethod.Get, $"/api/me/shifts?from={from}&to={to}", employee.AccessToken)).Json<JsonElement>();
        Assert.Equal("WeeklyOff", empShifts.EnumerateArray().First(s => s.GetProperty("date").GetString() == day.ToString("yyyy-MM-dd")).GetProperty("kind").GetString());

        // Bildirim: personel "onaylandı" bildirimi aldı.
        var notes = await (await _c.Send(HttpMethod.Get, "/api/me/notifications", employee.AccessToken)).Json<JsonElement>();
        Assert.Contains(notes.GetProperty("items").EnumerateArray(), n => n.GetProperty("type").GetString() == "SwapUpdated");
    }

    [Fact]
    public async Task Unpublished_or_foreign_shifts_cannot_be_swapped()
    {
        var employee = await _c.Login("personel@pdks.local");
        var res = await _c.Send(HttpMethod.Get, $"/api/me/swaps/candidates?shiftId={Guid.NewGuid()}", employee.AccessToken);
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }
}
