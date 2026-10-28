using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Domain.Security;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Social;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Services;
using Pdks.Infrastructure.Social;

namespace Pdks.Api.Controllers;

/// <summary>
/// Duyurular ve kutlamalar. Herkes okur; yönetici tüm firmaya, müdür kendi şubesine duyuru yayınlar.
/// </summary>
[ApiController]
[Authorize(Roles = Roles.Staff)]
public class AnnouncementsController(
    PdksDbContext db,
    ICurrentUser currentUser,
    AnnouncementFeed feed,
    Notifier notifier,
    AuditLogger audit) : ControllerBase
{
    /// <summary>Yönetici ve İK tüm firmaya yazar ve tüm duyuruları düzenler; müdür yalnızca kendi şubesine.</summary>
    private bool IsAdmin => currentUser.Role is { } r && RolePermissions.IsCompanyWide(r);
    private bool CanPost => currentUser.Role is { } r && RolePermissions.Has(r, Perm.AnnouncementsPost);
    private FeedScope Scope => new(currentUser.BranchId, IsAdmin);

    /// <summary>Panodaki akış: yayındaki duyurular, bugünkü ve önümüzdeki 7 günün kutlamaları.</summary>
    [HttpGet("api/announcements/feed")]
    public async Task<FeedDto> Feed(CancellationToken ct)
    {
        var result = await feed.BuildAsync(Scope, currentUser.UserId, ct: ct);
        return new FeedDto(
            result.Today,
            CanPost,
            result.Announcements.Select(a => AnnouncementDto.Create(a, result.Today, CanEdit(a))).ToList(),
            result.Celebrations.Select(c => CelebrationDto.Create(c, currentUser.UserId)).ToList());
    }

    /// <summary>Yönetim listesi: süresi dolanlar dahil son 50 duyuru.</summary>
    [HttpGet("api/announcements"), Authorize(Policy = Perm.AnnouncementsPost)]
    public async Task<List<AnnouncementDto>> List(CancellationToken ct)
    {
        var today = await feed.TodayAsync(currentUser.BranchId, ct);
        var items = await feed.Visible(Scope).AsNoTracking().Include(a => a.CreatedBy)
            .OrderByDescending(a => a.CreatedAt).Take(50).ToListAsync(ct);
        return items.Select(a => AnnouncementDto.Create(a, today, CanEdit(a))).ToList();
    }

    [HttpPost("api/announcements"), Authorize(Policy = Perm.AnnouncementsPost)]
    public async Task<ActionResult<AnnouncementDto>> Create(SaveAnnouncementRequest request, CancellationToken ct)
    {
        var today = await feed.TodayAsync(currentUser.BranchId, ct);
        if (Validate(request, today) is { } error) return error;

        // Müdürün duyurusu kendi şubesine, yöneticininki tüm firmaya gider.
        var announcement = new Announcement
        {
            BranchId = IsAdmin ? null : currentUser.BranchId,
            Title = request.Title.Trim(),
            Body = Clean(request.Body),
            IsPinned = request.IsPinned,
            ShowOnKiosk = request.ShowOnKiosk,
            ExpiresOn = request.ExpiresOn,
            CreatedById = currentUser.UserId!.Value
        };
        db.Announcements.Add(announcement);

        var author = await db.Users.FirstAsync(u => u.Id == currentUser.UserId, ct);
        announcement.CreatedBy = author;
        var recipients = await feed.People(new FeedScope(announcement.BranchId, announcement.BranchId is null))
            .Where(u => u.Id != author.Id).Select(u => u.Id).ToListAsync(ct);
        notifier.Notify(recipients, NotificationType.AnnouncementPublished,
            new { announcementId = announcement.Id, title = announcement.Title, author = author.FullName });

        audit.Log("announcement.created", nameof(Announcement), announcement.Id, newValues: new { announcement.Title });
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(List), AnnouncementDto.Create(announcement, today, true));
    }

    [HttpPut("api/announcements/{id:guid}"), Authorize(Policy = Perm.AnnouncementsPost)]
    public async Task<ActionResult<AnnouncementDto>> Update(Guid id, SaveAnnouncementRequest request, CancellationToken ct)
    {
        var announcement = await db.Announcements.Include(a => a.CreatedBy).FirstOrDefaultAsync(a => a.Id == id, ct);
        if (announcement is null || !CanEdit(announcement)) return this.NotFoundError("Duyuru bulunamadı.");

        var today = await feed.TodayAsync(currentUser.BranchId, ct);
        // Süresi geçmiş bir duyuruyu düzenlerken eski bitiş tarihini korumaya izin ver.
        if (Validate(request, request.ExpiresOn == announcement.ExpiresOn ? DateOnly.MinValue : today) is { } error) return error;

        var old = new { announcement.Title, announcement.IsPinned, announcement.ExpiresOn };
        announcement.Title = request.Title.Trim();
        announcement.Body = Clean(request.Body);
        announcement.IsPinned = request.IsPinned;
        announcement.ShowOnKiosk = request.ShowOnKiosk;
        announcement.ExpiresOn = request.ExpiresOn;

        audit.Log("announcement.updated", nameof(Announcement), announcement.Id, old,
            new { announcement.Title, announcement.IsPinned, announcement.ExpiresOn });
        await db.SaveChangesAsync(ct);
        return AnnouncementDto.Create(announcement, today, true);
    }

    [HttpDelete("api/announcements/{id:guid}"), Authorize(Policy = Perm.AnnouncementsPost)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var announcement = await db.Announcements.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (announcement is null || !CanEdit(announcement)) return this.NotFoundError("Duyuru bulunamadı.");

        db.Announcements.Remove(announcement);
        audit.Log("announcement.deleted", nameof(Announcement), announcement.Id, new { announcement.Title });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Bugün doğum günü ya da iş yıl dönümü olan ekip arkadaşını kutla. Kişiye bildirim gider; günde bir kez.</summary>
    [HttpPost("api/celebrations/congratulate")]
    public async Task<ActionResult<CongratulateResult>> Congratulate(CongratulateRequest request, CancellationToken ct)
    {
        if (request.UserId == currentUser.UserId)
            return this.ApiError(400, "cannot_congratulate_self", "Kendini kutlayamazsın.");

        var target = await feed.People(Scope).AsNoTracking().FirstOrDefaultAsync(u => u.Id == request.UserId, ct);
        if (target is null) return this.NotFoundError("Personel bulunamadı.");

        var today = await feed.TodayAsync(currentUser.BranchId, ct);
        var person = new CelebrationPerson(target.Id, target.FullName, target.BirthDate, target.HireDate, target.ShareBirthday);
        if (!Celebrations.IsToday(person, request.Kind, today))
            return this.ApiError(400, "no_celebration_today", "Bugün bu kişinin kutlanacak bir günü yok.");

        var exists = await db.Congratulations.AnyAsync(c =>
            c.FromUserId == currentUser.UserId && c.ToUserId == target.Id && c.Kind == request.Kind && c.Date == today, ct);
        if (!exists)
        {
            db.Congratulations.Add(new Congratulation
            {
                FromUserId = currentUser.UserId!.Value,
                ToUserId = target.Id,
                Kind = request.Kind,
                Date = today
            });
            var from = await db.Users.Where(u => u.Id == currentUser.UserId).Select(u => u.FirstName + " " + u.LastName).FirstAsync(ct);
            notifier.Notify(target.Id, NotificationType.Congratulated, new { from, kind = request.Kind.ToString() });
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Aynı anda iki kez basıldıysa ikinci kayıt benzersiz indekse takılır; sonuç aynı.
            }
        }

        var count = await db.Congratulations.CountAsync(c => c.ToUserId == target.Id && c.Kind == request.Kind && c.Date == today, ct);
        return new CongratulateResult(count);
    }

    private bool CanEdit(Announcement a) =>
        IsAdmin || (currentUser.Role == UserRole.Manager && a.BranchId != null && a.BranchId == currentUser.BranchId);

    private ObjectResult? Validate(SaveAnnouncementRequest r, DateOnly today)
    {
        if (string.IsNullOrWhiteSpace(r.Title))
            return this.ApiError(400, "announcement_title_required", "Duyuru başlığı gerekli.");
        if (r.ExpiresOn is { } e && e < today)
            return this.ApiError(400, "announcement_expired_date", "Bitiş tarihi bugünden önce olamaz.");
        return null;
    }

    private static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
}
