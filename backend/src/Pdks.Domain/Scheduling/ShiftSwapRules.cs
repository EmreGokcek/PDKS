using Pdks.Domain.Entities;
using Pdks.Domain.Enums;

namespace Pdks.Domain.Scheduling;

/// <summary>Takasın plana uygulanması ve sonrasında çakışma kontrolü (saf, test edilebilir).</summary>
public static class ShiftSwapRules
{
    /// <summary>
    /// İki kaydın içeriğini (tür, saatler, şablon, mola, not) değiştirir; kayıtlar sahibinde kalır.
    /// Böylece "kişi başına günde bir kayıt" kuralı hiçbir anda bozulmaz.
    /// Arkadaşın o gün kaydı yoksa isteyenin kaydı ona geçer.
    /// </summary>
    public static void Apply(Shift requesterShift, Shift? targetShift, Guid targetUserId)
    {
        if (targetShift is null)
        {
            requesterShift.UserId = targetUserId;
            return;
        }

        (requesterShift.Kind, targetShift.Kind) = (targetShift.Kind, requesterShift.Kind);
        (requesterShift.StartTime, targetShift.StartTime) = (targetShift.StartTime, requesterShift.StartTime);
        (requesterShift.EndTime, targetShift.EndTime) = (targetShift.EndTime, requesterShift.EndTime);
        (requesterShift.ShiftTemplateId, targetShift.ShiftTemplateId) = (targetShift.ShiftTemplateId, requesterShift.ShiftTemplateId);
        (requesterShift.BreakMinutes, targetShift.BreakMinutes) = (targetShift.BreakMinutes, requesterShift.BreakMinutes);
        (requesterShift.Note, targetShift.Note) = (targetShift.Note, requesterShift.Note);
    }

    /// <summary>Yalnızca çalışma ya da hafta tatiliyle takas yapılır; izinli (yıllık, rapor, mazeret) gün takas edilemez.</summary>
    public static bool IsSwappable(ShiftKind? kind) => kind is null or ShiftKind.Work or ShiftKind.WeeklyOff;

    /// <summary>Bir kişinin o günkü çalışma vardiyası önceki / sonraki günkülerle çakışıyor mu?</summary>
    public static bool OverlapsNeighbours(Shift? day, IEnumerable<Shift> neighbours) =>
        day is { Kind: ShiftKind.Work } &&
        neighbours.Any(n => n.Kind == ShiftKind.Work && n.Date != day.Date &&
                            ShiftMath.Overlaps((day.Date, day.StartTime, day.EndTime), (n.Date, n.StartTime, n.EndTime)));
}
