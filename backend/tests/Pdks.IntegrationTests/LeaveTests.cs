using System.Net;
using System.Text.Json;

namespace Pdks.IntegrationTests;

/// <summary>Yıllık izin hakkı, bakiye ve resmi tatiller.</summary>
[Collection(ApiCollection.Name)]
public class LeaveTests(PdksApiFactory api)
{
    private readonly HttpClient _c = api.Client();

    /// <summary>İK yeni personel açar (verilen işe giriş tarihiyle), personel şifresini belirler; personelin token'ı döner.</summary>
    private async Task<(string Token, string UserId)> Employee(DateOnly hireDate)
    {
        var hr = await _c.Login("ik@pdks.local");
        var email = $"izin.{Guid.NewGuid():N}@pdks.local";
        var created = await (await _c.Send(HttpMethod.Post, "/api/users", hr.AccessToken,
            new { firstName = "İzin", lastName = "Deneme", email, role = "Employee", hireDate = hireDate.ToString("yyyy-MM-dd") })).Json<JsonElement>();
        var temp = created.GetProperty("temporaryPassword").GetString()!;
        var s = await _c.Login(email, temp);
        var changed = await (await _c.Send(HttpMethod.Post, "/api/auth/change-password", s.AccessToken,
            new { currentPassword = temp, newPassword = "YeniSifre123" })).Json<JsonElement>();
        return (changed.GetProperty("accessToken").GetString()!, created.GetProperty("user").GetProperty("id").GetString()!);
    }

    private static object Leave(string from, string to) =>
        new { type = "Leave", leaveKind = "AnnualLeave", startDate = from, endDate = to, reason = "Tatil" };

    [Fact]
    public async Task No_annual_leave_in_the_first_year()
    {
        var today = DateOnly.FromDateTime(api.Time.GetUtcNow().UtcDateTime);
        var (token, _) = await Employee(today.AddMonths(-3));
        var balance = await (await _c.Send(HttpMethod.Get, "/api/me/leave-balance", token)).Json<JsonElement>();
        Assert.Equal(0, balance.GetProperty("earned").GetInt32());

        var res = await _c.Send(HttpMethod.Post, "/api/me/requests", token, Leave("2027-10-25", "2027-10-26"));
        Assert.Equal("no_annual_leave_yet", await res.ErrorCode());
    }

    [Fact]
    public async Task Leave_days_skip_holidays_and_sundays_and_balance_is_enforced()
    {
        var today = DateOnly.FromDateTime(api.Time.GetUtcNow().UtcDateTime);
        var (token, userId) = await Employee(today.AddYears(-3).AddDays(-10));

        var balance = await (await _c.Send(HttpMethod.Get, "/api/me/leave-balance", token)).Json<JsonElement>();
        Assert.Equal(42, balance.GetProperty("earned").GetInt32()); // 3 yıl × 14 gün

        // 25–31 Ekim 2027: 29 Ekim resmi tatil, 31 Ekim pazar; 28 Ekim yarım gün (izinden düşer).
        var preview = await (await _c.Send(HttpMethod.Get, "/api/me/leave-preview?kind=AnnualLeave&from=2027-10-25&to=2027-10-31", token)).Json<JsonElement>();
        Assert.Equal(5, preview.GetProperty("days").GetInt32());

        var created = await (await _c.Send(HttpMethod.Post, "/api/me/requests", token, Leave("2027-10-25", "2027-10-31"))).Json<JsonElement>();
        Assert.Equal(5, created.GetProperty("dayCount").GetInt32());

        var after = await (await _c.Send(HttpMethod.Get, "/api/me/leave-balance", token)).Json<JsonElement>();
        Assert.Equal(5, after.GetProperty("pending").GetInt32());
        Assert.Equal(37, after.GetProperty("available").GetInt32());

        // Bakiyeyi aşan talep reddedilir (2 aylık aralık ≈ 50 iş günü).
        var tooLong = await _c.Send(HttpMethod.Post, "/api/me/requests", token, Leave("2027-11-01", "2027-12-29"));
        Assert.Equal("insufficient_leave_balance", await tooLong.ErrorCode());

        // Müdür bakiye düzeltemez; İK düzeltir ve bakiyeye yansır.
        var manager = await _c.Login("mudur@pdks.local");
        var denied = await _c.Send(HttpMethod.Post, "/api/leave/adjustments", manager.AccessToken, new { userId, days = 5, reason = "Devreden izin" });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        var hr = await _c.Login("ik@pdks.local");
        var adjusted = await _c.Send(HttpMethod.Post, "/api/leave/adjustments", hr.AccessToken, new { userId, days = 5, reason = "Devreden izin" });
        Assert.Equal(HttpStatusCode.OK, adjusted.StatusCode);
        var final = await (await _c.Send(HttpMethod.Get, "/api/me/leave-balance", token)).Json<JsonElement>();
        Assert.Equal(42, final.GetProperty("available").GetInt32());
    }

    [Fact]
    public async Task Holiday_calendar_is_filled_automatically_and_editable_by_hr()
    {
        var hr = await _c.Login("ik@pdks.local");
        var list = await (await _c.Send(HttpMethod.Get, "/api/holidays?year=2026", hr.AccessToken)).Json<JsonElement>();
        Assert.Contains(list.EnumerateArray(), h => h.GetProperty("date").GetString() == "2026-10-29");

        var added = await _c.Send(HttpMethod.Post, "/api/holidays", hr.AccessToken, new { date = "2026-12-31", name = "Firma tatili", isHalfDay = true });
        Assert.Equal(HttpStatusCode.OK, added.StatusCode);
        var duplicate = await _c.Send(HttpMethod.Post, "/api/holidays", hr.AccessToken, new { date = "2026-12-31", name = "Tekrar", isHalfDay = false });
        Assert.Equal("holiday_exists", await duplicate.ErrorCode());

        var employee = await _c.Login("personel@pdks.local");
        var forbidden = await _c.Send(HttpMethod.Post, "/api/holidays", employee.AccessToken, new { date = "2026-12-30", name = "x", isHalfDay = false });
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task Team_calendar_hides_nothing_from_reviewers_but_requires_permission()
    {
        var employee = await _c.Login("personel@pdks.local");
        Assert.Equal(HttpStatusCode.Forbidden, (await _c.Send(HttpMethod.Get, "/api/leave/calendar?from=2026-10-01&to=2026-10-31", employee.AccessToken)).StatusCode);

        var manager = await _c.Login("mudur@pdks.local");
        var cal = await (await _c.Send(HttpMethod.Get, "/api/leave/calendar?from=2026-10-01&to=2026-10-31", manager.AccessToken)).Json<JsonElement>();
        Assert.True(cal.GetProperty("people").GetArrayLength() > 0);
        Assert.Contains(cal.GetProperty("holidays").EnumerateArray(), h => h.GetProperty("date").GetString() == "2026-10-29");
    }
}
