using System.ComponentModel.DataAnnotations;
using Pdks.Domain.Attendance;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Attendance;

namespace Pdks.Api.Contracts;

public record ScanRequest([Required] string QrToken, AttendanceEventType Action);

public record EventDto(AttendanceEventType Type, DateTimeOffset OccurredAt);

public record TodayDto(
    DateOnly Date,
    int WorkedSeconds,
    int BreakSeconds,
    int BreakAllowanceSeconds,
    int BreakRemainingSeconds,
    int BreakOverrunSeconds,
    bool BreakUsed);

public record WeekDayDto(DateOnly Date, int WorkedSeconds);

public record WeekDto(DateOnly Start, int WorkedSeconds, int TargetSeconds, int OvertimeSeconds, List<WeekDayDto> Days);

/// <summary>
/// Personelin anlık durumu. Süreler "serverNow" anına göre hesaplanmıştır;
/// arayüz açık oturum / mola sayaçlarını bu andan itibaren kendisi ilerletir.
/// </summary>
public record AttendanceStatusDto(
    AttendanceState State,
    DateTimeOffset ServerNow,
    DateTimeOffset? SessionStartedAt,
    DateTimeOffset? BreakStartedAt,
    TodayDto Today,
    WeekDto Week,
    bool HasUnclosedSession,
    List<EventDto> Events,
    ShiftDto? TodayShift = null,
    ShiftDto? NextShift = null)
{
    public static AttendanceStatusDto From(AttendanceSnapshot snap)
    {
        var s = snap.Summary;
        static int Sec(TimeSpan t) => (int)Math.Round(t.TotalSeconds);
        return new AttendanceStatusDto(
            s.State, snap.Now, s.SessionStartedAt, s.BreakStartedAt,
            new TodayDto(s.Today, Sec(s.TodayWorked), Sec(s.TodayBreak), Sec(s.BreakAllowance),
                Sec(s.BreakRemaining), Sec(s.BreakOverrun), s.BreakUsedToday),
            new WeekDto(s.WeekStart, Sec(s.WeekWorked), Sec(s.WeeklyTarget), Sec(s.Overtime),
                s.WeekDays.Select(d => new WeekDayDto(d.Date, Sec(d.Worked))).ToList()),
            s.HasUnclosedSession,
            snap.TodayEvents.Select(e => new EventDto(e.Type, e.OccurredAt)).ToList());
    }
}

public record ScanResponse(AttendanceEventType Recorded, DateTimeOffset OccurredAt, string KioskName, AttendanceStatusDto Status);

public record KioskScanDto(string Name, AttendanceEventType Type, DateTimeOffset OccurredAt);

public record KioskStateDto(
    string KioskName,
    string? BranchName,
    string QrToken,
    DateTimeOffset ExpiresAt,
    int WindowSeconds,
    DateTimeOffset ServerNow,
    List<KioskScanDto> Recent);
