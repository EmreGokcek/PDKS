using System.Security.Claims;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Auth;

namespace Pdks.Api.Auth;

/// <summary>ICurrentUser'ı o anki HTTP isteğinin JWT bilgilerinden doldurur (arka plan işlerinde firma TenantOverride'dan gelir).</summary>
public class CurrentUser(IHttpContextAccessor accessor, TenantOverride tenant) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid? UserId => ReadGuid(PdksClaims.UserId);
    public Guid? CompanyId => tenant.CompanyId ?? ReadGuid(PdksClaims.CompanyId);
    public Guid? BranchId => ReadGuid(PdksClaims.BranchId);

    public UserRole? Role =>
        Enum.TryParse<UserRole>(Principal?.FindFirstValue(PdksClaims.Role), out var role) ? role : null;

    private Guid? ReadGuid(string claimType) =>
        Guid.TryParse(Principal?.FindFirstValue(claimType), out var id) ? id : null;
}
