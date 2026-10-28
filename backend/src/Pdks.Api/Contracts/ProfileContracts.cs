using System.ComponentModel.DataAnnotations;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;

namespace Pdks.Api.Contracts;

public record ProfileDto(
    Guid Id,
    string FirstName,
    string LastName,
    string FullName,
    string Email,
    UserRole Role,
    string CompanyName,
    string? BranchName,
    string? EmployeeNumber,
    string? Position,
    DateOnly? HireDate,
    string? Phone,
    string? Address,
    DateOnly? BirthDate,
    bool ShareBirthday,
    string? BloodType,
    DateTimeOffset? HealthDataConsentAt,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelation)
{
    public static ProfileDto From(User u) => new(
        u.Id, u.FirstName, u.LastName, u.FullName, u.Email, u.Role, u.Company?.Name ?? string.Empty, u.Branch?.Name,
        u.EmployeeNumber, u.Position, u.HireDate, u.Phone, u.Address, u.BirthDate, u.ShareBirthday, u.BloodType, u.HealthDataConsentAt,
        u.EmergencyContactName, u.EmergencyContactPhone, u.EmergencyContactRelation);
}

/// <summary>Kişinin kendisinin güncelleyebildiği alanlar.</summary>
public record UpdateProfileRequest(
    [MaxLength(30)] string? Phone,
    [MaxLength(300)] string? Address,
    DateOnly? BirthDate,
    [MaxLength(5)] string? BloodType,
    /// <summary>Kan grubu girilirken açık rıza onayı (KVKK özel nitelikli veri).</summary>
    bool HealthDataConsent,
    [MaxLength(150)] string? EmergencyContactName,
    [MaxLength(30)] string? EmergencyContactPhone,
    [MaxLength(50)] string? EmergencyContactRelation,
    /// <summary>Boş gelirse mevcut tercih korunur.</summary>
    bool? ShareBirthday = null);

public record NotificationDto(Guid Id, NotificationType Type, System.Text.Json.JsonElement? Data, DateTimeOffset CreatedAt, bool IsRead);

public record NotificationListDto(int UnreadCount, List<NotificationDto> Items);

public record MarkReadRequest(List<Guid>? Ids);
