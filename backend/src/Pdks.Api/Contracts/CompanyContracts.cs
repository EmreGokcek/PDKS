using System.ComponentModel.DataAnnotations;

namespace Pdks.Api.Contracts;

/// <summary>Yeni firma kaydı: firma, ilk şube ve yönetici hesabı birlikte açılır.</summary>
public record RegisterCompanyRequest(
    [Required, StringLength(200, MinimumLength = 2)] string CompanyName,
    [StringLength(200)] string? BranchName,
    [Required, StringLength(100)] string FirstName,
    [Required, StringLength(100)] string LastName,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(200)] string Password,
    /// <summary>Okunan KVKK aydınlatma metninin sürümü.</summary>
    [Required, MaxLength(20)] string PrivacyNoticeVersion);

public record RegistrationStatusDto(bool Enabled);

public record CompanySettingsDto(Guid Id, string Name, List<BranchSettingsDto> Branches, List<KioskDto> Kiosks);

public record BranchSettingsDto(Guid Id, string Name, string TimeZone, bool IsActive, int StaffCount, int KioskCount);

public record KioskDto(
    Guid Id, string Name, Guid BranchId, string? BranchName, string Email, bool IsActive,
    DateTimeOffset? LastLoginAt, DateTimeOffset? LastSeenAt);

/// <summary>Kiosk hesabı ve şifresi. Şifre yalnızca bu yanıtta bir kez görünür.</summary>
public record KioskWithPasswordDto(KioskDto Kiosk, string Password);

public record UpdateCompanyRequest([Required, StringLength(200, MinimumLength = 2)] string Name);

public record SaveBranchRequest(
    [Required, StringLength(200, MinimumLength = 2)] string Name,
    [StringLength(100)] string? TimeZone,
    bool IsActive = true);

public record SaveKioskRequest([Required, StringLength(100, MinimumLength = 2)] string Name, Guid BranchId);
