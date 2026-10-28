using Microsoft.AspNetCore.Mvc;

namespace Pdks.Api.Auth;

/// <summary>
/// Geçici şifreyle giriş yapan kullanıcı, şifresini değiştirene kadar yalnızca
/// "ben kimim" ve "şifre değiştir" uç noktalarını kullanabilir.
/// </summary>
public class PasswordChangeGate(RequestDelegate next)
{
    private static readonly string[] AllowedPaths = ["/api/auth/me", "/api/auth/change-password", "/api/auth/refresh", "/api/auth/logout"];

    public async Task InvokeAsync(HttpContext context)
    {
        var mustChange = context.User.Identity?.IsAuthenticated == true
            && context.User.HasClaim(PdksClaims.MustChangePassword, "true");

        if (mustChange && !AllowedPaths.Contains(context.Request.Path.Value, StringComparer.OrdinalIgnoreCase))
        {
            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "Devam etmek için şifrenizi değiştirmeniz gerekiyor."
            };
            problem.Extensions["code"] = "password_change_required";

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json");
            return;
        }

        await next(context);
    }
}
