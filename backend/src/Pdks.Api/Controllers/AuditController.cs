using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Entities;
using Pdks.Domain.Security;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Api.Controllers;

public record AuditEntryDto(
    Guid Id,
    DateTimeOffset At,
    string? ActorName,
    string Action,
    string EntityName,
    Guid? EntityId,
    /// <summary>İşlemin ilgili olduğu kişi (ör. kaydı düzeltilen personel).</summary>
    string? SubjectName,
    JsonElement? OldValues,
    JsonElement? NewValues,
    string? Reason);

public record AuditPageDto(List<AuditEntryDto> Items, DateTimeOffset? NextBefore);

/// <summary>Denetim kaydı: kim, neyi, ne zaman, neden değiştirdi. Yalnızca okunur.</summary>
[ApiController]
[Route("api/audit")]
[Authorize(Policy = Perm.AuditView)]
public class AuditController(PdksDbContext db) : ControllerBase
{
    /// <param name="before">Bu zamandan önceki kayıtlar (sayfalama).</param>
    /// <param name="area">İşlem grubu (işlem adının başı): user, profile, attendance, shift, request, announcement, work_rule.</param>
    /// <param name="actorId">Yalnızca bu kişinin yaptıkları.</param>
    [HttpGet]
    public async Task<AuditPageDto> List(
        [FromQuery] DateTimeOffset? before,
        [FromQuery] string? area,
        [FromQuery] Guid? actorId,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 200);
        var query = db.AuditLogs.AsNoTracking();
        if (before is { } b) query = query.Where(a => a.CreatedAt < b);
        if (!string.IsNullOrWhiteSpace(area)) query = query.Where(a => a.Action.StartsWith(area));
        if (actorId is { } actor) query = query.Where(a => a.ActorUserId == actor);

        var logs = await query.OrderByDescending(a => a.CreatedAt).Take(take + 1).ToListAsync(ct);
        var hasMore = logs.Count > take;
        if (hasMore) logs.RemoveAt(logs.Count - 1);

        // İlgili kişi adları tek seferde: işlemi yapan, kullanıcı kayıtları, giriş-çıkış ve talep sahipleri.
        var ids = logs.Select(l => l.EntityId).OfType<Guid>().ToList();
        var eventOwners = await db.AttendanceEvents.Where(e => ids.Contains(e.Id)).Select(e => new { e.Id, e.UserId }).ToListAsync(ct);
        var requestOwners = await db.StaffRequests.Where(r => ids.Contains(r.Id)).Select(r => new { r.Id, r.UserId }).ToListAsync(ct);
        var subjectOf = eventOwners.ToDictionary(x => x.Id, x => x.UserId);
        foreach (var r in requestOwners) subjectOf[r.Id] = r.UserId;
        foreach (var l in logs.Where(l => l.EntityName == nameof(User) && l.EntityId is not null)) subjectOf[l.EntityId!.Value] = l.EntityId.Value;

        var userIds = logs.Select(l => l.ActorUserId).OfType<Guid>().Concat(subjectOf.Values).Distinct().ToList();
        var names = await db.Users.Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FirstName + " " + u.LastName, ct);

        string? Name(Guid? id) => id is { } x && names.TryGetValue(x, out var n) ? n : null;
        static JsonElement? Parse(string? json) => json is null ? null : JsonSerializer.Deserialize<JsonElement>(json);

        var items = logs.Select(l => new AuditEntryDto(
            l.Id, l.CreatedAt, Name(l.ActorUserId), l.Action, l.EntityName, l.EntityId,
            l.EntityId is { } e && subjectOf.TryGetValue(e, out var s) ? Name(s) : null,
            Parse(l.OldValues), Parse(l.NewValues), l.Reason)).ToList();

        return new AuditPageDto(items, hasMore ? logs[^1].CreatedAt : null);
    }
}
