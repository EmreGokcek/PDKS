namespace Pdks.Infrastructure.Auth;

/// <summary>
/// HTTP isteği olmayan işlerde (arka plan görevleri) hangi firmanın verisiyle çalışılacağını belirler.
/// Doluysa ICurrentUser.CompanyId bu değeri döner; istek içinde hiç kullanılmaz.
/// </summary>
public class TenantOverride
{
    public Guid? CompanyId { get; set; }
}
