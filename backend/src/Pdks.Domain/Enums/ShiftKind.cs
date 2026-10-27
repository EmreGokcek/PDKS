namespace Pdks.Domain.Enums;

/// <summary>Plandaki bir günün türü: çalışma vardiyası ya da izin.</summary>
public enum ShiftKind
{
    Work = 0,
    /// <summary>Haftalık izin (hafta tatili).</summary>
    WeeklyOff = 1,
    AnnualLeave = 2,
    /// <summary>Raporlu (hastalık izni).</summary>
    SickLeave = 3,
    /// <summary>Mazeret izni.</summary>
    ExcusedLeave = 4
}
