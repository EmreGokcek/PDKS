namespace Pdks.Api.Auth;

/// <summary>JWT içinde taşınan alan adları (kısa, standart isimler).</summary>
public static class PdksClaims
{
    public const string UserId = "sub";
    public const string Email = "email";
    public const string Name = "name";
    public const string Role = "role";
    public const string CompanyId = "company_id";
    public const string BranchId = "branch_id";
    /// <summary>Varsa kullanıcı şifresini değiştirmeden başka işlem yapamaz.</summary>
    public const string MustChangePassword = "pwd_change";
}

/// <summary>[Authorize(Roles = ...)] için hazır rol grupları.</summary>
public static class Roles
{
    public const string Admin = "Admin";
    public const string Manager = "Manager";
    public const string Employee = "Employee";
    public const string Kiosk = "Kiosk";
    public const string HumanResources = "HumanResources";

    /// <summary>Kiosk dışındaki tüm insan hesapları.</summary>
    public const string Staff = Admin + "," + Manager + "," + HumanResources + "," + Employee;
}
