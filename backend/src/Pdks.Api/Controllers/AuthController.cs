using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Pdks.Api.Auth;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Security;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Companies;
using Pdks.Infrastructure.Email;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    PdksDbContext db,
    IPasswordHasher<User> hasher,
    TokenService tokens,
    RefreshTokenService refreshTokens,
    ICurrentUser currentUser,
    AuditLogger audit,
    IOptions<LoginSessionOptions> sessionOptions,
    IOptions<PrivacyOptions> privacyOptions,
    IOptions<RegistrationOptions> registrationOptions,
    IOptions<AppOptions> appOptions,
    PasswordResetService passwordResets,
    IEmailSender email,
    ILogger<AuthController> log,
    IWebHostEnvironment env,
    TimeProvider time) : ControllerBase
{
    private LoginSessionOptions Session => sessionOptions.Value;

    /// <summary>
    /// E-posta ve şifre ile giriş. Kısa ömürlü erişim anahtarı döner; yenileme anahtarı HttpOnly çereze yazılır.
    /// Art arda hatalı denemelerde hesap geçici kilitlenir; IP başına da istek sınırı vardır.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var now = time.GetUtcNow();

        // Giriş anında henüz firma bilinmiyor, bu yüzden firma filtresi devre dışı.
        var user = await db.Users
            .IgnoreQueryFilters()
            .Include(u => u.Company)
            .Include(u => u.Branch)
            .FirstOrDefaultAsync(u => u.Email == email, ct);

        // Hangi bilginin yanlış olduğunu söylemiyoruz (güvenlik).
        if (user is null || user.Company is not { IsActive: true })
        {
            // Olmayan hesapta da şifre özeti hesaplanır; yanıt süresinden hesabın varlığı anlaşılmasın.
            hasher.VerifyHashedPassword(new User { FirstName = "", LastName = "", Email = "" }, DummyHash, request.Password);
            return InvalidCredentials();
        }

        if (user.LockoutUntil is { } until && until > now)
            return Locked(until, now);

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= Session.MaxFailedLogins)
            {
                user.FailedLoginCount = 0;
                user.LockoutUntil = now.AddMinutes(Session.LockoutMinutes);
                // Kimliksiz istekte firma bilgisi yok; denetim kaydına kişinin firması verilir.
                db.AuditLogs.Add(new AuditLog
                {
                    CompanyId = user.CompanyId,
                    Action = "user.locked_out",
                    EntityName = nameof(User),
                    EntityId = user.Id
                });
                await db.SaveChangesAsync(ct);
                return Locked(user.LockoutUntil.Value, now);
            }
            await db.SaveChangesAsync(ct);
            return InvalidCredentials();
        }

        // Şifre doğruysa pasif olduğunu söylemekte sakınca yok; kullanıcı ne yapacağını bilsin.
        if (!user.IsActive)
            return this.ApiError(StatusCodes.Status403Forbidden, "account_inactive",
                "Hesabınız pasif durumda. Yöneticinizle görüşün.");

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = hasher.HashPassword(user, request.Password);

        user.FailedLoginCount = 0;
        user.LockoutUntil = null;
        user.LastLoginAt = now;

        // Girişteki tablet her gün yeniden giriş istemesin: kiosk oturumu her zaman kalıcıdır.
        var issued = refreshTokens.Issue(user, request.RememberMe || user.Role == UserRole.Kiosk);
        await db.SaveChangesAsync(ct);

        SessionCookie.Write(Response, issued, SecureCookies);
        return CreateLoginResponse(user);
    }

    /// <summary>Giriş ekranı "Firmanı kaydet" bağlantısını göstersin mi?</summary>
    [HttpGet("registration")]
    [AllowAnonymous]
    public RegistrationStatusDto RegistrationStatus() => new(registrationOptions.Value.Enabled);

    /// <summary>
    /// Yeni firma kaydı: firma, ilk şube (varsayılan "Merkez"), varsayılan çalışma kuralları ve vardiya şablonları
    /// ile kaydı yapan kişinin yönetici hesabı açılır; kişi doğrudan oturum açmış olur.
    /// Kiosk ve diğer personel daha sonra Firma ayarları ve Personel sayfalarından eklenir.
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Register)]
    public async Task<ActionResult<LoginResponse>> Register(RegisterCompanyRequest request, CancellationToken ct)
    {
        if (!registrationOptions.Value.Enabled)
            return this.ApiError(404, "registration_disabled", "Yeni firma kaydı kapalı.");
        if (request.PrivacyNoticeVersion != privacyOptions.Value.NoticeVersion)
            return this.ApiError(400, "privacy_notice_outdated", "Aydınlatma metni güncellendi; sayfayı yenileyip yeniden okuyun.");
        if (!PasswordPolicy.IsValid(request.Password))
            return this.ApiError(400, "weak_password", "Şifre en az 8 karakter olmalı, harf ve rakam içermeli.");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email, ct))
            return this.ApiError(409, "email_taken", "Bu e-posta adresi zaten kullanılıyor.");

        var now = time.GetUtcNow();
        var company = new Company { Name = request.CompanyName.Trim() };
        var branch = new Branch
        {
            CompanyId = company.Id,
            Name = string.IsNullOrWhiteSpace(request.BranchName) ? "Merkez" : request.BranchName.Trim(),
            Company = company
        };
        var admin = new User
        {
            CompanyId = company.Id,
            BranchId = branch.Id,
            Company = company,
            Branch = branch,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Email = email,
            Role = UserRole.Admin,
            PrivacyNoticeVersion = request.PrivacyNoticeVersion,
            PrivacyNoticeAcceptedAt = now,
            LastLoginAt = now
        };
        admin.PasswordHash = hasher.HashPassword(admin, request.Password);

        db.Companies.Add(company);
        db.Branches.Add(branch);
        db.WorkRules.Add(new WorkRule { CompanyId = company.Id });
        db.ShiftTemplates.AddRange(CompanySetup.DefaultShiftTemplates(company.Id, branch.Id));
        db.Users.Add(admin);
        db.AuditLogs.Add(new AuditLog
        {
            CompanyId = company.Id,
            ActorUserId = admin.Id,
            Action = "company.registered",
            EntityName = nameof(Company),
            EntityId = company.Id,
            NewValues = System.Text.Json.JsonSerializer.Serialize(new { company = company.Name, branch = branch.Name, admin = email })
        });

        var issued = refreshTokens.Issue(admin, persistent: false);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Aynı e-postayla aynı anda yapılan iki kayıt: benzersiz dizin ikincisini durdurur.
            return this.ApiError(409, "email_taken", "Bu e-posta adresi zaten kullanılıyor.");
        }

        SessionCookie.Write(Response, issued, SecureCookies);
        return CreateLoginResponse(admin);
    }

    /// <summary>Çerezdeki yenileme anahtarıyla yeni erişim anahtarı alır. Anahtar her seferinde değişir.</summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Refresh)]
    public async Task<ActionResult<LoginResponse>> Refresh(CancellationToken ct)
    {
        if (SessionCookie.Read(Request) is not { } raw)
            return this.ApiError(401, "session_expired", "Oturum süresi doldu.");

        var result = await refreshTokens.RotateAsync(raw, ct);
        switch (result.Outcome)
        {
            case RefreshOutcome.Ok:
                await db.SaveChangesAsync(ct);
                SessionCookie.Write(Response, result.NewToken!, SecureCookies);
                return CreateLoginResponse(result.User!);
            case RefreshOutcome.Grace:
                return CreateLoginResponse(result.User!);
            case RefreshOutcome.Reused:
                SessionCookie.Clear(Response, SecureCookies);
                return this.ApiError(401, "session_revoked", "Güvenlik nedeniyle oturum kapatıldı. Yeniden giriş yap.");
            default:
                SessionCookie.Clear(Response, SecureCookies);
                return this.ApiError(401, "session_expired", "Oturum süresi doldu.");
        }
    }

    /// <summary>Çıkış: bu cihazdaki oturumu sunucuda da kapatır.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        if (SessionCookie.Read(Request) is { } raw)
            await refreshTokens.RevokeFamilyOfAsync(raw, "logout", ct);
        SessionCookie.Clear(Response, SecureCookies);
        return NoContent();
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

    /// <summary>Şifreyi değiştirir. Diğer cihazlardaki oturumlar kapanır, bu cihaz için yeni oturum açılır.</summary>
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

        // Bu cihazdaki oturumun "beni hatırla" tercihi korunur.
        var persistent = false;
        if (SessionCookie.Read(Request) is { } raw)
        {
            var hash = RefreshTokenService.Hash(raw);
            persistent = await db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => t.Persistent).FirstOrDefaultAsync(ct);
        }
        await refreshTokens.RevokeAllForUserAsync(user.Id, "password_changed", ct);

        user.PasswordHash = hasher.HashPassword(user, request.NewPassword);
        user.MustChangePassword = false;
        audit.Log("user.password_changed", nameof(User), user.Id);
        var issued = refreshTokens.Issue(user, persistent);
        await db.SaveChangesAsync(ct);

        SessionCookie.Write(Response, issued, SecureCookies);
        return CreateLoginResponse(user);
    }

    /// <summary>
    /// "Şifremi unuttum": hesap varsa e-postasına 30 dakika geçerli, tek kullanımlık bir bağlantı gönderilir.
    /// Hesabın var olup olmadığı yanıttan anlaşılmaz (her zaman aynı yanıt).
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.PasswordReset)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken ct)
    {
        var address = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.IgnoreQueryFilters().Include(u => u.Company)
            .FirstOrDefaultAsync(u => u.Email == address, ct);

        // Kiosk hesaplarının şifresini yönetici yeniler; pasif hesaplar ve kapalı firmalar sıfırlayamaz.
        if (user is null || !user.IsActive || user.Role == UserRole.Kiosk || user.Company is not { IsActive: true })
            return NoContent();

        var baseUrl = PublicBaseUrl();
        if (baseUrl is null)
        {
            log.LogError("Şifre sıfırlama bağlantısı üretilemedi: App:PublicUrl ayarlanmalı.");
            return NoContent();
        }

        var token = await passwordResets.CreateAsync(user, ct);
        if (token is null) return NoContent(); // saatlik sınır doldu

        db.AuditLogs.Add(new AuditLog
        {
            CompanyId = user.CompanyId, ActorUserId = user.Id, Action = "user.password_reset_requested",
            EntityName = nameof(User), EntityId = user.Id
        });
        await db.SaveChangesAsync(ct);

        var link = $"{baseUrl}/sifre-sifirla?token={Uri.EscapeDataString(token)}";
        try
        {
            await email.SendAsync(PasswordResetEmail(user, link), ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            log.LogError(ex, "Şifre sıfırlama e-postası gönderilemedi.");
        }
        return NoContent();
    }

    /// <summary>Bağlantıdaki anahtarla yeni şifre belirler. Tüm oturumlar kapanır; kişi yeni şifresiyle giriş yapar.</summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.PasswordReset)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken ct)
    {
        var token = await passwordResets.FindValidAsync(request.Token, ct);
        if (token?.User is not { IsActive: true, Company.IsActive: true } user || user.Role == UserRole.Kiosk)
            return this.ApiError(400, "invalid_reset_token", "Bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bağlantı iste.");
        if (!PasswordPolicy.IsValid(request.NewPassword))
            return this.ApiError(400, "weak_password", "Yeni şifre en az 8 karakter olmalı, harf ve rakam içermeli.");

        user.PasswordHash = hasher.HashPassword(user, request.NewPassword);
        user.MustChangePassword = false;
        user.FailedLoginCount = 0;
        user.LockoutUntil = null;
        await passwordResets.InvalidateAsync(user.Id, ct);
        await refreshTokens.RevokeAllForUserAsync(user.Id, "password_reset", ct);
        db.AuditLogs.Add(new AuditLog
        {
            CompanyId = user.CompanyId, ActorUserId = user.Id, Action = "user.password_reset_by_email",
            EntityName = nameof(User), EntityId = user.Id
        });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>E-postadaki bağlantının adresi. Üretimde App:PublicUrl zorunlu (istek başlığına güvenilmez).</summary>
    private string? PublicBaseUrl()
    {
        if (!string.IsNullOrWhiteSpace(appOptions.Value.PublicUrl)) return appOptions.Value.PublicUrl.TrimEnd('/');
        return env.IsDevelopment() ? $"{Request.Scheme}://{Request.Host}" : null;
    }

    private static EmailMessage PasswordResetEmail(User user, string link)
    {
        var minutes = (int)PasswordResetService.Lifetime.TotalMinutes;
        var name = System.Net.WebUtility.HtmlEncode(user.FirstName);
        var href = System.Net.WebUtility.HtmlEncode(link);
        var text =
            $"Merhaba {user.FirstName},\n\n" +
            $"PDKS hesabın için şifre sıfırlama isteği aldık. Yeni şifreni belirlemek için {minutes} dakika içinde bu bağlantıyı aç:\n\n{link}\n\n" +
            "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.";
        var html =
            $"<p>Merhaba {name},</p>" +
            $"<p>PDKS hesabın için şifre sıfırlama isteği aldık. Yeni şifreni belirlemek için {minutes} dakika içinde aşağıdaki düğmeye tıkla.</p>" +
            $"<p><a href=\"{href}\" style=\"display:inline-block;padding:12px 20px;background:#1f9a76;color:#fff;border-radius:10px;text-decoration:none;font-weight:600\">Yeni şifre belirle</a></p>" +
            $"<p style=\"color:#667085;font-size:13px\">Düğme çalışmazsa bu adresi tarayıcına yapıştır:<br>{href}</p>" +
            "<p style=\"color:#667085;font-size:13px\">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p>";
        return new EmailMessage(user.Email, "PDKS şifre sıfırlama", text, html);
    }

    /// <summary>KVKK aydınlatma metninin okunduğunu kaydeder.</summary>
    [HttpPost("privacy-notice")]
    [Authorize]
    public async Task<ActionResult<UserDto>> AcceptPrivacyNotice(AcceptPrivacyNoticeRequest request, CancellationToken ct)
    {
        var user = await LoadCurrentUserAsync(ct);
        if (user is null || !user.IsActive) return Unauthorized();
        if (request.Version != privacyOptions.Value.NoticeVersion)
            return this.ApiError(400, "privacy_notice_outdated", "Aydınlatma metni güncellendi; sayfayı yenileyip yeniden okuyun.");

        if (user.PrivacyNoticeVersion != request.Version)
        {
            user.PrivacyNoticeVersion = request.Version;
            user.PrivacyNoticeAcceptedAt = time.GetUtcNow();
            audit.Log("user.privacy_notice_accepted", nameof(User), user.Id, newValues: new { request.Version });
            await db.SaveChangesAsync(ct);
        }
        return ToDto(user);
    }

    private bool SecureCookies => !env.IsDevelopment() || Request.IsHttps;

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

    private ObjectResult Locked(DateTimeOffset until, DateTimeOffset now)
    {
        var minutes = Math.Max(1, (int)Math.Ceiling((until - now).TotalMinutes));
        var error = this.ApiError(StatusCodes.Status429TooManyRequests, "account_locked",
            $"Çok sayıda hatalı deneme. {minutes} dakika sonra tekrar deneyin.");
        ((Microsoft.AspNetCore.Mvc.ProblemDetails)error.Value!).Extensions["minutes"] = minutes;
        Response.Headers.RetryAfter = ((int)Math.Ceiling((until - now).TotalSeconds)).ToString();
        return error;
    }

    private UserDto ToDto(User u) => new(
        u.Id, u.FirstName, u.LastName, u.FullName, u.Email, u.Role.ToString(),
        u.CompanyId, u.Company?.Name ?? string.Empty, u.BranchId, u.Branch?.Name, u.MustChangePassword,
        u.Role == UserRole.Kiosk || u.PrivacyNoticeVersion == privacyOptions.Value.NoticeVersion,
        u.Role == UserRole.Kiosk || u.HasRequiredProfile,
        RolePermissions.For(u.Role),
        RolePermissions.IsCompanyWide(u.Role));

    /// <summary>Olmayan hesaplar için sabit bir şifre özeti (zamanlama farkını gidermek için).</summary>
    private static readonly string DummyHash =
        new PasswordHasher<User>().HashPassword(new User { FirstName = "", LastName = "", Email = "" }, "pdks-dummy-password");
}
