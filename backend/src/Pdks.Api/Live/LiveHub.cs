using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Pdks.Api.Auth;
using Pdks.Domain.Enums;
using Pdks.Domain.Security;
using Pdks.Infrastructure.Live;

namespace Pdks.Api.Live;

/// <summary>
/// Canlı bağlantı (SignalR). İstemci yalnızca dinler; sunucu "bir şey değişti" der, sayfa veriyi yeniden ister.
/// Gruplar:
/// - user:{id}       kişinin kendi bildirimleri ve kendi kaydı (düzeltme)
/// - branch:{id}     müdürün izlediği şube (pano yetkisi olanlar)
/// - company:{id}    tüm firmayı gören roller (yönetici, İK)
/// Mesajlar veri taşımaz (yalnızca kişi kimliği); yetki kontrolü veriyi çeken uç noktada yapılır.
/// </summary>
[Authorize(Roles = Roles.Staff)]
public class LiveHub : Hub
{
    public const string Path = "/api/hubs/live";

    public override async Task OnConnectedAsync()
    {
        var user = Context.User!;
        var userId = user.FindFirst(PdksClaims.UserId)?.Value;
        var companyId = user.FindFirst(PdksClaims.CompanyId)?.Value;
        var branchId = user.FindFirst(PdksClaims.BranchId)?.Value;

        if (userId is not null) await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.User(userId));

        if (Enum.TryParse<UserRole>(user.FindFirst(PdksClaims.Role)?.Value, out var role) &&
            RolePermissions.Has(role, Perm.DashboardView))
        {
            if (RolePermissions.IsCompanyWide(role) && companyId is not null)
                await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.Company(companyId));
            else if (branchId is not null)
                await Groups.AddToGroupAsync(Context.ConnectionId, LiveGroups.Branch(branchId));
        }

        await base.OnConnectedAsync();
    }
}

public static class LiveGroups
{
    public static string User(object id) => $"user:{id}";
    public static string Branch(object id) => $"branch:{id}";
    public static string Company(object id) => $"company:{id}";
}

/// <summary>Değişiklikleri ilgili gruplara iletir.</summary>
public sealed class HubLiveUpdates(IHubContext<LiveHub> hub) : ILiveUpdates
{
    public async Task AttendanceChangedAsync(IReadOnlyCollection<AttendanceChange> changes, CancellationToken ct = default)
    {
        foreach (var c in changes)
        {
            var groups = new List<string> { LiveGroups.User(c.UserId), LiveGroups.Company(c.CompanyId) };
            if (c.BranchId is { } b) groups.Add(LiveGroups.Branch(b));
            await hub.Clients.Groups(groups).SendAsync("attendance", new { userId = c.UserId }, ct);
        }
    }

    public Task NotificationsChangedAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct = default) =>
        hub.Clients.Groups(userIds.Select(id => LiveGroups.User(id)).ToList()).SendAsync("notifications", ct);
}
