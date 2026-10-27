using Pdks.Domain.Common;
using Pdks.Domain.Enums;

namespace Pdks.Domain.Entities;

public class User : TenantEntity
{
    public Guid? BranchId { get; set; }

    public required string FirstName { get; set; }
    public required string LastName { get; set; }

    /// <summary>Giriş için kullanılır, sistem genelinde benzersizdir (küçük harfe çevrilmiş saklanır).</summary>
    public required string Email { get; set; }
    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; }
    public string? EmployeeNumber { get; set; }
    public string? Phone { get; set; }

    public bool IsActive { get; set; } = true;

    /// <summary>Geçici şifreyle oluşturulan veya şifresi sıfırlanan kullanıcı, ilk girişte şifresini değiştirmek zorundadır.</summary>
    public bool MustChangePassword { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }

    public Company? Company { get; set; }
    public Branch? Branch { get; set; }

    public string FullName => $"{FirstName} {LastName}";
}
