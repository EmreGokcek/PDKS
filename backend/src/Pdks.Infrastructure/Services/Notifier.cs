using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Services;

/// <summary>
/// Bildirim üretir. Bildirimler yalnızca context'e eklenir; asıl işlemle aynı SaveChanges'te kaydedilir.
/// </summary>
public class Notifier(PdksDbContext db)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public void Notify(IEnumerable<Guid> userIds, NotificationType type, object? data = null)
    {
        var payload = data is null ? null : JsonSerializer.Serialize(data, Json);
        foreach (var userId in userIds.Distinct())
            db.Notifications.Add(new Notification { UserId = userId, Type = type, Data = payload });
    }

    public void Notify(Guid userId, NotificationType type, object? data = null) => Notify([userId], type, data);

    /// <summary>Talepleri karara bağlayabilecek kişiler: şubenin müdürleri, tüm yöneticiler ve İK (talep sahibi hariç).</summary>
    public async Task<List<Guid>> ReviewersAsync(Guid branchId, Guid exceptUserId, CancellationToken ct = default) =>
        await db.Users
            .Where(u => u.IsActive && u.Id != exceptUserId &&
                        (u.Role == UserRole.Admin || u.Role == UserRole.HumanResources || (u.Role == UserRole.Manager && u.BranchId == branchId)))
            .Select(u => u.Id)
            .ToListAsync(ct);
}
