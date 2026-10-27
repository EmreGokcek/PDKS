using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>
/// Firmanın çalışma kuralları. Admin panelinden ayarlanır.
/// Haftalık net çalışma (molalar düşülmüş) WeeklyWorkMinutes'ı aşarsa fark fazla mesai sayılır.
/// </summary>
public class WorkRule : TenantEntity
{
    /// <summary>Haftalık normal çalışma süresi (dakika). Varsayılan 45 saat.</summary>
    public int WeeklyWorkMinutes { get; set; } = 45 * 60;

    /// <summary>Günlük mola hakkı (dakika). Tek seferde kullanılır.</summary>
    public int DailyBreakMinutes { get; set; } = 60;

    /// <summary>Bu kadar dakikaya kadar geç gelmek "geç kalma" sayılmaz.</summary>
    public int LateToleranceMinutes { get; set; } = 5;

    public DayOfWeek WeekStartsOn { get; set; } = DayOfWeek.Monday;
}
