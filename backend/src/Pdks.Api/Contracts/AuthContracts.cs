using System.ComponentModel.DataAnnotations;

namespace Pdks.Api.Contracts;

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

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
    string? BranchName);

public record LoginResponse(string AccessToken, DateTimeOffset ExpiresAt, UserDto User);
