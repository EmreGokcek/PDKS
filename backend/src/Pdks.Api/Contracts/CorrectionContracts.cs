using System.ComponentModel.DataAnnotations;
using Pdks.Domain.Enums;

namespace Pdks.Api.Contracts;

/// <summary>
/// Gün düzeltme ekranındaki kayıt. LocalDate / LocalTime şubenin saat dilimindedir;
/// ekran bunları gösterir ve düzenlemede aynen geri gönderir (tarayıcının saat diliminden bağımsız).
/// </summary>
public record EventDetailDto(
    Guid Id,
    AttendanceEventType Type,
    DateTimeOffset OccurredAt,
    AttendanceSource Source,
    string? Note,
    string? RecordedBy,
    DateOnly LocalDate,
    string LocalTime)
{
    public static EventDetailDto Create(Domain.Entities.AttendanceEvent e, string? recordedBy, TimeZoneInfo tz)
    {
        var local = TimeZoneInfo.ConvertTime(e.OccurredAt, tz);
        return new EventDetailDto(e.Id, e.Type, e.OccurredAt, e.Source, e.Note, recordedBy,
            DateOnly.FromDateTime(local.DateTime), local.ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture));
    }
}

/// <summary>Elle eklenen ya da değiştirilen kayıt. Tarih ve saat şubenin yerel saatidir.</summary>
public record ManualEventRequest(
    AttendanceEventType Type,
    DateOnly Date,
    TimeOnly Time,
    [Required, MinLength(3), MaxLength(500)] string Reason);

public record ChangeEventRequest(
    DateOnly Date,
    TimeOnly Time,
    [Required, MinLength(3), MaxLength(500)] string Reason);

public record DeleteEventRequest([Required, MinLength(3), MaxLength(500)] string Reason);

public record CreateRequestDto(
    RequestType Type,
    // Düzeltme
    AttendanceEventType? EventType,
    DateOnly? Date,
    TimeOnly? Time,
    // İzin
    ShiftKind? LeaveKind,
    DateOnly? StartDate,
    DateOnly? EndDate,
    [Required, MinLength(3), MaxLength(500)] string Reason);

public record ReviewRequestDto([MaxLength(500)] string? Note);

public record RequestDto(
    Guid Id,
    Guid UserId,
    string UserName,
    RequestType Type,
    RequestStatus Status,
    AttendanceEventType? EventType,
    DateTimeOffset? EventAt,
    ShiftKind? LeaveKind,
    DateOnly? StartDate,
    DateOnly? EndDate,
    int? DayCount,
    string Reason,
    DateTimeOffset CreatedAt,
    string? ReviewedBy,
    DateTimeOffset? ReviewedAt,
    string? ReviewNote);
