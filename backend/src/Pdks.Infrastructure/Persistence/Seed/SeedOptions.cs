namespace Pdks.Infrastructure.Persistence.Seed;

/// <summary>appsettings.Development.json içindeki "Seed" bölümü.</summary>
public class SeedOptions
{
    public const string SectionName = "Seed";

    public bool Enabled { get; set; }
    public string CompanyName { get; set; } = "Demo Şirket";
    public string BranchName { get; set; } = "Merkez";
    public string DefaultPassword { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = "admin@pdks.local";
    public string ManagerEmail { get; set; } = "mudur@pdks.local";
    public string EmployeeEmail { get; set; } = "personel@pdks.local";
    public string HrEmail { get; set; } = "ik@pdks.local";
    public string KioskEmail { get; set; } = "kiosk@pdks.local";
}
