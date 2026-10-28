using System.Runtime.CompilerServices;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Pdks.Domain.Entities;

namespace Pdks.Infrastructure.Live;

/// <summary>Bir kişinin devam kaydı değişti (okutma, düzeltme). Şube, kişinin kendi şubesidir.</summary>
public record AttendanceChange(Guid CompanyId, Guid? BranchId, Guid UserId);

/// <summary>Açık ekranlara anlık haber verir (canlı pano, bildirim zili). Uygulaması API katmanında (SignalR).</summary>
public interface ILiveUpdates
{
    Task AttendanceChangedAsync(IReadOnlyCollection<AttendanceChange> changes, CancellationToken ct = default);
    Task NotificationsChangedAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct = default);
}

/// <summary>Canlı bağlantı olmayan ortamlar için (ör. araçlar): hiçbir şey yapmaz.</summary>
public sealed class NullLiveUpdates : ILiveUpdates
{
    public Task AttendanceChangedAsync(IReadOnlyCollection<AttendanceChange> changes, CancellationToken ct = default) => Task.CompletedTask;
    public Task NotificationsChangedAsync(IReadOnlyCollection<Guid> userIds, CancellationToken ct = default) => Task.CompletedTask;
}

/// <summary>
/// Kayıt başarıyla yazıldıktan sonra ilgili ekranlara haber verir. Böylece okutma, düzeltme, talep onayı,
/// arka plan uyarısı gibi her kaynak ayrı ayrı uğraşmadan canlı yayına girer.
/// Haber verme başarısız olursa asıl işlem etkilenmez (ekranlar zaten belirli aralıklarla yeniler).
/// </summary>
public sealed class LiveUpdatesInterceptor(ILiveUpdates live) : SaveChangesInterceptor
{
    private sealed record Pending(List<(Guid CompanyId, Guid UserId)> Attendance, List<Guid> Notified);

    private readonly ConditionalWeakTable<DbContext, Pending> _pending = new();

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Capture(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Capture(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        _ = PublishAsync(eventData.Context, CancellationToken.None);
        return result;
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        await PublishAsync(eventData.Context, cancellationToken);
        return result;
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        if (eventData.Context is { } ctx) _pending.Remove(ctx);
    }

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        if (eventData.Context is { } ctx) _pending.Remove(ctx);
        return Task.CompletedTask;
    }

    private void Capture(DbContext? context)
    {
        if (context is null) return;
        var attendance = context.ChangeTracker.Entries<AttendanceEvent>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(e => (e.Entity.CompanyId, e.Entity.UserId))
            .Distinct()
            .ToList();
        var notified = context.ChangeTracker.Entries<Notification>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity.UserId)
            .Distinct()
            .ToList();

        if (attendance.Count == 0 && notified.Count == 0) _pending.Remove(context);
        else _pending.AddOrUpdate(context, new Pending(attendance, notified));
    }

    private async Task PublishAsync(DbContext? context, CancellationToken ct)
    {
        if (context is null || !_pending.TryGetValue(context, out var pending)) return;
        _pending.Remove(context);

        try
        {
            if (pending.Attendance.Count > 0)
            {
                // Müdür kişinin kendi şubesini izler (okuttuğu kiosk başka şubede olabilir).
                var ids = pending.Attendance.Select(a => a.UserId).Distinct().ToList();
                var branches = await context.Set<User>().IgnoreQueryFilters().AsNoTracking()
                    .Where(u => ids.Contains(u.Id))
                    .Select(u => new { u.Id, u.BranchId })
                    .ToDictionaryAsync(u => u.Id, u => u.BranchId, ct);
                await live.AttendanceChangedAsync(
                    pending.Attendance.Select(a => new AttendanceChange(a.CompanyId, branches.GetValueOrDefault(a.UserId), a.UserId)).ToList(), ct);
            }
            if (pending.Notified.Count > 0)
                await live.NotificationsChangedAsync(pending.Notified, ct);
        }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            // Canlı haber verilemedi; ekranlar bir sonraki yenilemede güncellenir.
        }
    }
}
