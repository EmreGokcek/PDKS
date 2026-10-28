using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Api.Controllers;

public record AuditItemDto(
    Guid Id,
    DateTimeOffset At,
    string? ActorName,
    string Action,
    string EntityName,
    Guid? EntityId,
    /// <summary>İşlemden etkilenen kişi (personel kaydı, kayıt sahibi, talep sahibi).</summary>
    string? TargetName,
    JsonElement? OldValues,
    JsonElement? NewValues,
    string? Reason);

public record AuditPageDto(List<AuditItemDto> Items, DateTimeOffset? NextCursor);

/// <summary>Denetim kaydı: kim, neyi, ne zaman, neden değiştirdi. Yalnızca yönetici görür; kayıtlar değiştirilemez.</summary>
[ApiController]
[Route("api/audit")]
[Authorize(Roles = Roles.Admin)]
public class AuditController(PdksDbContext db) : ControllerBase
{
    /// <summary>Kategoriye göre işlem öneki.</summary>
    private static readonly Dictionary<string, string[]> Categories = new()
    {
        ["users"] = ["user.created", "user.updated", "user.activated", "user.deactivated", "profile."],
        ["security"] = ["user.locked_out", "user.password_", "user.privacy_"],
        ["attendance"] = ["attendance."],
        ["requests"] = ["request."],
        ["shifts"] = ["shifts.", "shift_template."],
        ["announcements"] = ["announcement."],
        ["settings"] = ["work_rule.", "holiday."],
    };

    [HttpGet]
    public async Task<AuditPageDto> List(
        [FromQuery] string? category,
        [FromQuery] Guid? actorId,
        [FromQuery] Guid? targetUserId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] DateTimeOffset? before,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 10, 100);
        var q = db.AuditLogs.AsNoTracking();

        if (category is not null && Categories.TryGetValue(category, out var prefixes))
            q = q.Where(StartsWithAny(prefixes));
        if (actorId is not null) q = q.Where(a => a.ActorUserId == actorId);
        if (targetUserId is { } target)
        {
            // Kişinin kendisi ya da ona ait kayıtlar (giriş-çıkış, talep)
            var eventIds = db.AttendanceEvents.Where(e => e.UserId == target).Select(e => (Guid?)e.Id);
            var requestIds = db.StaffRequests.Where(r => r.UserId == target).Select(r => (Guid?)r.Id);
            q = q.Where(a => a.EntityId == target || eventIds.Contains(a.EntityId) || requestIds.Contains(a.EntityId));
        }
        if (from is { } f) q = q.Where(a => a.CreatedAt >= new DateTimeOffset(f.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero).AddHours(-14));
        if (to is { } t) q = q.Where(a => a.CreatedAt < new DateTimeOffset(t.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero).AddHours(14));
        // Sayfalama: son görülen kaydın zamanından öncekiler.
        if (before is { } b) q = q.Where(a => a.CreatedAt < b);

        var rows = await q.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id).Take(take + 1).ToListAsync(ct);
        var page = rows.Take(take).ToList();

        // Kişi adlarını tek seferde çöz
        var actorIds = page.Where(r => r.ActorUserId != null).Select(r => r.ActorUserId!.Value);
        var entityIds = page.Where(r => r.EntityId != null).Select(r => r.EntityId!.Value).ToList();
        var eventOwners = await db.AttendanceEvents.Where(e => entityIds.Contains(e.Id)).Select(e => new { e.Id, e.UserId }).ToListAsync(ct);
        var requestOwners = await db.StaffRequests.Where(r => entityIds.Contains(r.Id)).Select(r => new { r.Id, r.UserId }).ToListAsync(ct);
        var userIds = actorIds.Concat(entityIds).Concat(eventOwners.Select(e => e.UserId)).Concat(requestOwners.Select(r => r.UserId)).Distinct().ToList();
        var names = await db.Users.Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, ct);

        string? TargetOf(AuditLog a)
        {
            if (a.EntityId is not { } id) return null;
            Guid? owner = a.EntityName switch
            {
                nameof(User) => id,
                nameof(AttendanceEvent) => eventOwners.FirstOrDefault(e => e.Id == id)?.UserId,
                nameof(StaffRequest) => requestOwners.FirstOrDefault(r => r.Id == id)?.UserId,
                _ => null
            };
            return owner is { } o && names.TryGetValue(o, out var n) ? n : null;
        }

        static JsonElement? Parse(string? json) => json is null ? null : JsonSerializer.Deserialize<JsonElement>(json);

        var items = page.Select(a => new AuditItemDto(
            a.Id, a.CreatedAt,
            a.ActorUserId is { } actor && names.TryGetValue(actor, out var an) ? an : null,
            a.Action, a.EntityName, a.EntityId, TargetOf(a),
            Parse(a.OldValues), Parse(a.NewValues), a.Reason)).ToList();

        return new AuditPageDto(items, rows.Count > take ? page[^1].CreatedAt : null);
    }

    /// <summary>"Action şu öneklerden biriyle başlar" koşulunu SQL'e çevrilebilir biçimde kurar.</summary>
    private static System.Linq.Expressions.Expression<Func<AuditLog, bool>> StartsWithAny(string[] prefixes)
    {
        var a = System.Linq.Expressions.Expression.Parameter(typeof(AuditLog), "a");
        var action = System.Linq.Expressions.Expression.Property(a, nameof(AuditLog.Action));
        var startsWith = typeof(string).GetMethod(nameof(string.StartsWith), [typeof(string)])!;
        System.Linq.Expressions.Expression body = System.Linq.Expressions.Expression.Constant(false);
        foreach (var p in prefixes)
            body = System.Linq.Expressions.Expression.OrElse(body,
                System.Linq.Expressions.Expression.Call(action, startsWith, System.Linq.Expressions.Expression.Constant(p)));
        return System.Linq.Expressions.Expression.Lambda<Func<AuditLog, bool>>(body, a);
    }
}
