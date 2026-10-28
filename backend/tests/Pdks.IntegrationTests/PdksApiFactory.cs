using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using Testcontainers.PostgreSql;

namespace Pdks.IntegrationTests;

/// <summary>
/// Gerçek bir PostgreSQL (Docker) üzerinde API'yi ayağa kaldırır. Açılışta migration ve demo verisi uygulanır.
/// Zaman FakeTimeProvider ile ileri sarılabilir (kilit süresi, oturum süresi testleri için).
/// </summary>
public sealed class PdksApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string DemoPassword = "Pdks123!";

    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder("postgres:17")
        .WithDatabase("pdks")
        .WithUsername("pdks")
        .WithPassword("pdks_test")
        .Build();

    public FakeTimeProvider Time { get; } = new(DateTimeOffset.UtcNow);

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public async Task InitializeAsync()
    {
        await _db.StartAsync();
        // Program ayarları Build'den önce okuduğu için ortam değişkeniyle verilir.
        Environment.SetEnvironmentVariable("ConnectionStrings__Default", _db.GetConnectionString());
        Environment.SetEnvironmentVariable("RateLimits__LoginPerMinute", "10000");
        Environment.SetEnvironmentVariable("RateLimits__RefreshPerMinute", "10000");
        Environment.SetEnvironmentVariable("Seed__Enabled", "true");
        // Anlık uyarı taraması testlerde elle çalıştırılır (zaman ileri sarılınca kendiliğinden çalışmasın).
        Environment.SetEnvironmentVariable("Alerts__Enabled", "false");
        Environment.SetEnvironmentVariable("Seed__DefaultPassword", DemoPassword);
        _ = Server; // uygulamayı başlat (migration + seed)
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _db.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Time);
        });
    }

    /// <summary>Çerezleri kendisi taşımayan istemci; testler Set-Cookie'yi elle yönetir.</summary>
    public HttpClient Client() => CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false, AllowAutoRedirect = false });
}

[CollectionDefinition(Name)]
public class ApiCollection : ICollectionFixture<PdksApiFactory>
{
    public const string Name = "api";
}

public record Session(string AccessToken, string? RefreshCookie, JsonElement User);

public static class HttpTestExtensions
{
    public static async Task<HttpResponseMessage> LoginRaw(this HttpClient c, string email, string password, bool remember = false) =>
        await c.PostAsJsonAsync("/api/auth/login", new { email, password, rememberMe = remember });

    public static async Task<Session> Login(this HttpClient c, string email, string password = PdksApiFactory.DemoPassword, bool remember = false)
    {
        var res = await c.LoginRaw(email, password, remember);
        Assert.True(res.IsSuccessStatusCode, $"Giriş başarısız: {(int)res.StatusCode} {await res.Content.ReadAsStringAsync()}");
        return await ToSession(res);
    }

    public static async Task<Session> ToSession(HttpResponseMessage res)
    {
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return new Session(body.GetProperty("accessToken").GetString()!, RefreshCookie(res), body.GetProperty("user"));
    }

    /// <summary>Set-Cookie başlığından yenileme çerezinin değerini okur.</summary>
    public static string? RefreshCookie(HttpResponseMessage res)
    {
        if (!res.Headers.TryGetValues("Set-Cookie", out var values)) return null;
        foreach (var v in values)
        {
            if (!v.StartsWith("pdks_rt=", StringComparison.Ordinal)) continue;
            var value = v["pdks_rt=".Length..].Split(';')[0];
            return string.IsNullOrEmpty(value) ? null : value;
        }
        return null;
    }

    public static string? SetCookieHeader(HttpResponseMessage res) =>
        res.Headers.TryGetValues("Set-Cookie", out var v) ? v.FirstOrDefault(x => x.StartsWith("pdks_rt=", StringComparison.Ordinal)) : null;

    public static Task<HttpResponseMessage> Refresh(this HttpClient c, string? cookie)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        if (cookie is not null) req.Headers.Add("Cookie", $"pdks_rt={cookie}");
        return c.SendAsync(req);
    }

    public static Task<HttpResponseMessage> Send(this HttpClient c, HttpMethod method, string url, string token, object? body = null, string? cookie = null)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (cookie is not null) req.Headers.Add("Cookie", $"pdks_rt={cookie}");
        if (body is not null) req.Content = JsonContent.Create(body, options: PdksApiFactory.Json);
        return c.SendAsync(req);
    }

    public static async Task<string?> ErrorCode(this HttpResponseMessage res)
    {
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    public static async Task<T> Json<T>(this HttpResponseMessage res)
    {
        Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode} {await res.Content.ReadAsStringAsync()}");
        return (await res.Content.ReadFromJsonAsync<T>(PdksApiFactory.Json))!;
    }
}
