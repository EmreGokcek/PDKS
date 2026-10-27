using System.ComponentModel.DataAnnotations;
using Pdks.Domain.Enums;

namespace Pdks.Api.Contracts;

public record EventDetailDto(
    Guid Id,
    AttendanceEventType Type,
    DateTimeOffset OccurredAt,
    AttendanceSource Source,
    string? Note,
    string? RecordedBy);

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
