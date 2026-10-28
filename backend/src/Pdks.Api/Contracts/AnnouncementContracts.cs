using System.ComponentModel.DataAnnotations;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Social;

namespace Pdks.Api.Contracts;

public record AnnouncementDto(
    Guid Id,
    string Title,
    string? Body,
    bool IsPinned,
    bool ShowOnKiosk,
    DateOnly? ExpiresOn,
    /// <summary>Boşsa tüm firmaya.</summary>
    bool CompanyWide,
    string AuthorName,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    bool IsActive,
    bool CanEdit)
{
    public static AnnouncementDto Create(Announcement a, DateOnly today, bool canEdit) => new(
        a.Id, a.Title, a.Body, a.IsPinned, a.ShowOnKiosk, a.ExpiresOn, a.BranchId is null,
        a.CreatedBy?.FullName ?? string.Empty, a.CreatedAt, a.UpdatedAt,
        a.ExpiresOn is null || a.ExpiresOn >= today, canEdit);
}

public record CelebrationDto(
    Guid UserId,
    string Name,
    CelebrationKind Kind,
    DateOnly Date,
    int DaysUntil,
    int? Years,
    int CongratulationCount,
    bool CongratulatedByMe,
    bool IsMe)
{
    public static CelebrationDto Create(CelebrationItem i, Guid? viewerId) => new(
        i.Celebration.UserId, i.Celebration.Name, i.Celebration.Kind, i.Celebration.Date, i.Celebration.DaysUntil,
        i.Celebration.Years, i.CongratulationCount, i.CongratulatedByViewer, i.Celebration.UserId == viewerId);
}

public record FeedDto(DateOnly Today, bool CanPost, List<AnnouncementDto> Announcements, List<CelebrationDto> Celebrations);

public record SaveAnnouncementRequest(
    [Required, MaxLength(120)] string Title,
    [MaxLength(1000)] string? Body,
    bool IsPinned,
    bool ShowOnKiosk,
    DateOnly? ExpiresOn);

public record CongratulateRequest(Guid UserId, CelebrationKind Kind);

public record CongratulateResult(int CongratulationCount);

/// <summary>Kiosk ekranında dönen duyuru satırı.</summary>
public record KioskFeedItemDto(string Kind, string Text, string? Detail, int? Years);
