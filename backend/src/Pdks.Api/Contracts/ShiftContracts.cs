using System.ComponentModel.DataAnnotations;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Scheduling;

namespace Pdks.Api.Contracts;

public record ShiftTemplateDto(Guid Id, string Name, TimeOnly StartTime, TimeOnly EndTime, string Color, int DurationMinutes)
{
    public static ShiftTemplateDto From(ShiftTemplate t) =>
        new(t.Id, t.Name, t.StartTime, t.EndTime, t.Color, (int)ShiftMath.Duration(t.StartTime, t.EndTime).TotalMinutes);
}

public record SaveShiftTemplateRequest(
    [Required, MaxLength(100)] string Name,
    TimeOnly StartTime,
    TimeOnly EndTime,
    [Required, RegularExpression("^#[0-9a-fA-F]{6}$")] string Color);

public record ShiftDto(
    Guid Id,
    Guid UserId,
    DateOnly Date,
    TimeOnly StartTime,
    TimeOnly EndTime,
    Guid? TemplateId,
    string? TemplateName,
    string Color,
    string? Note,
    int DurationMinutes)
{
    public const string DefaultColor = "#64748b";

    public static ShiftDto From(Shift s) => new(
        s.Id, s.UserId, s.Date, s.StartTime, s.EndTime, s.ShiftTemplateId,
        s.ShiftTemplate?.Name, s.ShiftTemplate?.Color ?? DefaultColor, s.Note,
        (int)ShiftMath.Duration(s.StartTime, s.EndTime).TotalMinutes);
}

public record PlannerStaffDto(Guid Id, string FullName, UserRole Role, bool IsActive);

public record PlannerDto(
    DateOnly From,
    DateOnly To,
    int WeeklyWorkMinutes,
    int DailyBreakMinutes,
    DayOfWeek WeekStartsOn,
    List<PlannerStaffDto> Staff,
    List<ShiftDto> Shifts);

public record ShiftCell(Guid UserId, DateOnly Date);

/// <summary>Seçilen hücrelere şablon ya da özel saat atar. Hücrede vardiya varsa değiştirilir.</summary>
public record AssignShiftsRequest(
    [Required, MinLength(1), MaxLength(500)] List<ShiftCell> Cells,
    Guid? TemplateId,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    [MaxLength(500)] string? Note);

public record ClearShiftsRequest([Required, MinLength(1), MaxLength(500)] List<ShiftCell> Cells);

public record CopyWeekRequest(DateOnly FromWeekStart, DateOnly ToWeekStart, bool Overwrite);

public record CopyWeekResult(int Copied, int Skipped);
