using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    PdksDbContext db,
    IPasswordHasher<User> hasher,
    TokenService tokens,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>E-posta ve şifre ile giriş yapar, JWT döner.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        // Giriş anında henüz firma bilinmiyor, bu yüzden firma filtresi devre dışı.
        var user = await db.Users
            .IgnoreQueryFilters()
            .Include(u => u.Company)
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

        // Hangi bilginin yanlış olduğunu söylemiyoruz (güvenlik).
        if (user is null || !user.IsActive || user.Company is not { IsActive: true })
            return InvalidCredentials();

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return InvalidCredentials();

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = hasher.HashPassword(user, request.Password);

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        var (token, expiresAt) = tokens.CreateAccessToken(user);
        return new LoginResponse(token, expiresAt, ToDto(user));
    }

    /// <summary>Giriş yapmış kullanıcının bilgileri.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        var user = await db.Users
            .Include(u => u.Company)
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Id == currentUser.UserId, ct);

        if (user is null || !user.IsActive) return Unauthorized();
        return ToDto(user);
    }

    private ObjectResult InvalidCredentials() =>
        Problem(statusCode: StatusCodes.Status401Unauthorized, title: "E-posta veya şifre hatalı.");

    private static UserDto ToDto(User u) => new(
        u.Id, u.FirstName, u.LastName, u.FullName, u.Email, u.Role.ToString(),
        u.CompanyId, u.Company?.Name ?? string.Empty, u.BranchId, u.Branch?.Name);
}
