using Pdks.Domain.Common;
using Pdks.Domain.Enums;

namespace Pdks.Domain.Entities;

/// <summary>Bir personelin belirli bir gündeki planı: çalışma vardiyası ya da izin.</summary>
public class Shift : TenantEntity
{
    public Guid BranchId { get; set; }
    public Guid UserId { get; set; }
    public Guid? ShiftTemplateId { get; set; }

    public DateOnly Date { get; set; }

    /// <summary>Çalışma ya da izin. İzin günlerinde saatler kullanılmaz (00:00).</summary>
    public ShiftKind Kind { get; set; } = ShiftKind.Work;
    public TimeOnly StartTime { get; set; }
    /// <summary>StartTime'dan küçükse vardiya ertesi güne taşar.</summary>
    public TimeOnly EndTime { get; set; }
    public string? Note { get; set; }

    public Guid CreatedByUserId { get; set; }

    public User? User { get; set; }
    public ShiftTemplate? ShiftTemplate { get; set; }
}
