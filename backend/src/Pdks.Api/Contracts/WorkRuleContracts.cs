using System.ComponentModel.DataAnnotations;

namespace Pdks.Api.Contracts;

public record WorkRuleDto(
    int WeeklyWorkMinutes,
    int DailyBreakMinutes,
    int LateToleranceMinutes,
    DayOfWeek WeekStartsOn);

public record UpdateWorkRuleRequest(
    [Range(60, 70 * 60)] int WeeklyWorkMinutes,
    [Range(0, 240)] int DailyBreakMinutes,
    [Range(0, 120)] int LateToleranceMinutes,
    DayOfWeek WeekStartsOn);
