using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

/// <summary>Firmanın tatil takvimindeki gün. Yıl ilk istendiğinde Türkiye resmi tatilleriyle doldurulur; İK / yönetici değiştirebilir.</summary>
public class PublicHoliday : TenantEntity
{
    public DateOnly Date { get; set; }
    public required string Name { get; set; }
    /// <summary>Arife gibi yarım gün tatil (öğleden sonra).</summary>
    public bool IsHalfDay { get; set; }
}

/// <summary>Takvimi bir yıl için doldurulmuş mu (silinen tatiller tekrar eklenmesin diye).</summary>
public class HolidayYear : TenantEntity
{
    public int Year { get; set; }
}
