using Pdks.Domain.Common;

namespace Pdks.Domain.Entities;

public class Branch : TenantEntity
{
    public required string Name { get; set; }

    /// <summary>IANA saat dilimi. Gün/hafta hesapları bu saate göre yapılır.</summary>
    public string TimeZone { get; set; } = "Europe/Istanbul";

    // Konum doğrulaması (ileriki adım)
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public int? GeofenceRadiusMeters { get; set; }

    public bool IsActive { get; set; } = true;

    public Company? Company { get; set; }
}
