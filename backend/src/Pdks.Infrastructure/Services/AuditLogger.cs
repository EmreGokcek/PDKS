using System.Text.Json;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Infrastructure.Services;

/// <summary>
/// Değişiklikleri AuditLog tablosuna ekler. Kaydı yalnızca context'e ekler;
/// asıl değişiklikle aynı SaveChanges içinde yazılır, böylece ikisi birlikte kaydedilir ya da hiçbiri.
/// </summary>
public class AuditLogger(PdksDbContext db, ICurrentUser currentUser)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public void Log(string action, string entityName, Guid? entityId,
        object? oldValues = null, object? newValues = null, string? reason = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = currentUser.UserId,
            Action = action,
            EntityName = entityName,
            EntityId = entityId,
            OldValues = oldValues is null ? null : JsonSerializer.Serialize(oldValues, Json),
            NewValues = newValues is null ? null : JsonSerializer.Serialize(newValues, Json),
            Reason = reason
        });
    }
}
