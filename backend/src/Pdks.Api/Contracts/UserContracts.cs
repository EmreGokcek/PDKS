using System.ComponentModel.DataAnnotations;
using Pdks.Domain.Enums;

namespace Pdks.Api.Contracts;

public record UserListItem(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    string Email,
    string? Phone,
    string? EmployeeNumber,
    UserRole Role,
    Guid? BranchId,
    string? BranchName,
    bool IsActive,
    bool MustChangePassword,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    string? Position = null,
    DateOnly? HireDate = null);

public record SaveUserRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Required, EmailAddress, MaxLength(256)] string Email,
    [MaxLength(30)] string? Phone,
    [MaxLength(50)] string? EmployeeNumber,
    UserRole Role,
    Guid? BranchId,
    [MaxLength(100)] string? Position = null,
    DateOnly? HireDate = null);

/// <summary>Geçici şifre yalnızca bu yanıtta bir kez döner, hiçbir yerde düz metin saklanmaz.</summary>
public record UserWithPasswordResponse(UserListItem User, string TemporaryPassword);

public record BranchDto(Guid Id, string Name);
