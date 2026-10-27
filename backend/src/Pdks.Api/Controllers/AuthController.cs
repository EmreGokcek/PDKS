using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    PdksDbContext db,
    IPasswordHasher<User> hasher,
    TokenService tokens,
    ICurrentUser currentUser,
    AuditLogger audit) : ControllerBase
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
        if (user is null || user.Company is not { IsActive: true })
            return InvalidCredentials();

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return InvalidCredentials();

        // Şifre doğruysa pasif olduğunu söylemekte sakınca yok; kullanıcı ne yapacağını bilsin.
        if (!user.IsActive)
            return this.ApiError(StatusCodes.Status403Forbidden, "account_inactive",
                "Hesabınız pasif durumda. Yöneticinizle görüşün.");

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = hasher.HashPassword(user, request.Password);

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);

        return CreateLoginResponse(user);
    }

    /// <summary>Giriş yapmış kullanıcının bilgileri.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        var user = await LoadCurrentUserAsync(ct);
        if (user is null || !user.IsActive) return Unauthorized();
        return ToDto(user);
    }

    /// <summary>Şifreyi değiştirir ve yeni bir token döner (geçici şifre kısıtı kalkar).</summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<LoginResponse>> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        var user = await LoadCurrentUserAsync(ct);
        if (user is null || !user.IsActive) return Unauthorized();

        if (hasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            return this.ApiError(400, "wrong_current_password", "Mevcut şifre hatalı.");

        if (!PasswordPolicy.IsValid(request.NewPassword))
            return this.ApiError(400, "weak_password", "Yeni şifre en az 8 karakter olmalı, harf ve rakam içermeli.");

        if (request.NewPassword == request.CurrentPassword)
            return this.ApiError(400, "same_password", "Yeni şifre mevcut şifreyle aynı olamaz.");

        user.PasswordHash = hasher.HashPassword(user, request.NewPassword);
        user.MustChangePassword = false;
        audit.Log("user.password_changed", nameof(User), user.Id);
        await db.SaveChangesAsync(ct);

        return CreateLoginResponse(user);
    }

    private Task<User?> LoadCurrentUserAsync(CancellationToken ct) =>
        db.Users
            .Include(u => u.Company)
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Id == currentUser.UserId, ct);

    private LoginResponse CreateLoginResponse(User user)
    {
        var (token, expiresAt) = tokens.CreateAccessToken(user);
        return new LoginResponse(token, expiresAt, ToDto(user));
    }

    private ObjectResult InvalidCredentials() =>
        this.ApiError(StatusCodes.Status401Unauthorized, "invalid_credentials", "E-posta veya şifre hatalı.");

    private static UserDto ToDto(User u) => new(
        u.Id, u.FirstName, u.LastName, u.FullName, u.Email, u.Role.ToString(),
        u.CompanyId, u.Company?.Name ?? string.Empty, u.BranchId, u.Branch?.Name, u.MustChangePassword);
}
