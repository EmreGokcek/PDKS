using Pdks.Domain.Enums;

namespace Pdks.Infrastructure.Auth;

/// <summary>
/// İsteği yapan kullanıcının bilgileri (JWT'den okunur).
/// Giriş yapılmamışsa tüm alanlar null'dır.
/// </summary>
public interface ICurrentUser
{
    Guid? UserId { get; }
    Guid? CompanyId { get; }
    Guid? BranchId { get; }
    UserRole? Role { get; }
}
