using System.ComponentModel.DataAnnotations;

namespace Pdks.Api.Contracts;

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password,
    /// <summary>Tarayıcı kapansa da oturum açık kalsın (30 gün, her kullanımda uzar).</summary>
    bool RememberMe = false);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required] string NewPassword);

public record UserDto(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    string Email,
    string Role,
    Guid CompanyId,
    string CompanyName,
    Guid? BranchId,
    string? BranchName,
    bool MustChangePassword,
    /// <summary>Güncel KVKK aydınlatma metni onaylandı mı (kiosk için her zaman true).</summary>
    bool PrivacyNoticeAccepted,
    /// <summary>İlk girişte istenen profil bilgileri dolu mu (kiosk için her zaman true).</summary>
    bool ProfileComplete,
    /// <summary>Kullanıcının yetkileri (arayüz menü ve düğmeleri buna göre gösterir).</summary>
    IReadOnlyCollection<string> Permissions,
    /// <summary>true: tüm firmanın verisini görür; false: yalnızca kendi şubesini.</summary>
    bool CompanyWide);

public record LoginResponse(string AccessToken, DateTimeOffset ExpiresAt, UserDto User);

public record AcceptPrivacyNoticeRequest([Required, MaxLength(20)] string Version);

public record ForgotPasswordRequest([Required, EmailAddress, StringLength(256)] string Email);

public record ResetPasswordRequest([Required, StringLength(100)] string Token, [Required, StringLength(200)] string NewPassword);
