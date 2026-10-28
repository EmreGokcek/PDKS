using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Pdks.Api.Auth;

/// <summary>IP başına istek sınırları. Değerler "RateLimits" ayarından değiştirilebilir.</summary>
public class RateLimitOptions
{
    public const string SectionName = "RateLimits";

    public int LoginPerMinute { get; set; } = 10;
    public int RefreshPerMinute { get; set; } = 30;
}

public static class RateLimits
{
    public const string Login = "login";
    public const string Refresh = "refresh";

    public static IServiceCollection AddPdksRateLimits(this IServiceCollection services, IConfiguration configuration)
    {
        var o = configuration.GetSection(RateLimitOptions.SectionName).Get<RateLimitOptions>() ?? new RateLimitOptions();

        return services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, ct) =>
            {
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin."
                };
                problem.Extensions["code"] = "too_many_requests";
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry))
                    context.HttpContext.Response.Headers.RetryAfter = ((int)retry.TotalSeconds).ToString();
                await context.HttpContext.Response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json", ct);
            };

            options.AddPolicy(Login, http => Window(http, o.LoginPerMinute));
            options.AddPolicy(Refresh, http => Window(http, o.RefreshPerMinute));
        });
    }

    private static RateLimitPartition<string> Window(HttpContext http, int perMinute) =>
        RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = Math.Max(1, perMinute),
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
}
