using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Domain.Security;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Domain.Scheduling;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Scheduling;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

/// <summary>
/// Haftalık vardiya planı. Müdür yalnızca kendi şubesindeki personeli, admin herkesi planlar.
/// Planlanan kişiler: Personel ve Müdür rolleri (admin ve kiosk hesapları plana girmez).
/// </summary>
[ApiController]
[Route("api/shifts")]
[Authorize(Policy = Perm.ShiftsPlan)]
public class ShiftsController(PdksDbContext db, ICurrentUser currentUser, AuditLogger audit, Notifier notifier, ShiftPublication publication) : ControllerBase
{
    private const int MaxRangeDays = 42;

    /// <summary>Planlama tablosu için personel listesi ve aralıktaki vardiyalar.</summary>
    [HttpGet]
    public async Task<ActionResult<PlannerDto>> Planner([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > MaxRangeDays)
            return this.ApiError(400, "invalid_range", "Tarih aralığı geçersiz.");

        var staffIds = StaffScope().Select(u => u.Id);
        var shifts = await db.Shifts.AsNoTracking()
            .Include(s => s.ShiftTemplate)
            .Where(s => s.Date >= from && s.Date <= to && staffIds.Contains(s.UserId))
            .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
            .ToListAsync(ct);

        var withShifts = shifts.Select(s => s.UserId).Distinct().ToList();
        var staff = await StaffScope()
            .Where(u => u.IsActive || withShifts.Contains(u.Id))
            .OrderBy(u => u.FirstName).ThenBy(u => u.LastName)
            .Select(u => new PlannerStaffDto(u.Id, u.FirstName + " " + u.LastName, u.Role, u.IsActive))
            .ToListAsync(ct);

        var rules = await db.WorkRules.AsNoTracking().FirstOrDefaultAsync(ct) ?? new WorkRule();

        // Yayın durumu: "from" haftanın ilk günüyse o haftanın yayın kaydı
        var branchIds = await StaffScope().Where(u => u.IsActive && u.BranchId != null).Select(u => u.BranchId!.Value).Distinct().ToListAsync(ct);
        var week = await db.ShiftWeeks.AsNoTracking()
            .Where(w => w.WeekStart == from && branchIds.Contains(w.BranchId))
            .OrderByDescending(w => w.PublishedAt)
            .FirstOrDefaultAsync(ct);
        var publishedBy = week is null ? null
            : await db.Users.Where(u => u.Id == week.PublishedByUserId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync(ct);

        return new PlannerDto(from, to, rules.WeeklyWorkMinutes, rules.DailyBreakMinutes, rules.WeekStartsOn,
            staff, shifts.Select(ShiftDto.From).ToList(), week?.PublishedAt, publishedBy);
    }

    /// <summary>
    /// Haftanın planını yayınlar; personel ancak bundan sonra görür.
    /// Her aktif kişinin her günü dolu olmalı (vardiya ya da izin); boş gün varsa liste döner.
    /// </summary>
    [HttpPost("publish")]
    public async Task<ActionResult<PublishResult>> Publish(PublishWeekRequest request, CancellationToken ct)
    {
        var rules = await db.WorkRules.AsNoTracking().FirstOrDefaultAsync(ct) ?? new WorkRule();
        if (request.WeekStart.DayOfWeek != rules.WeekStartsOn)
            return this.ApiError(400, "invalid_range", "Hafta başlangıcı çalışma kurallarıyla uyuşmuyor.");

        var weekEnd = request.WeekStart.AddDays(6);
        var staff = await StaffScope().Where(u => u.IsActive).ToListAsync(ct);
        var staffIds = staff.Select(u => u.Id).ToList();
        var filled = (await db.Shifts.AsNoTracking()
                .Where(x => staffIds.Contains(x.UserId) && x.Date >= request.WeekStart && x.Date <= weekEnd)
                .Select(x => new { x.UserId, x.Date })
                .ToListAsync(ct))
            .Select(x => (x.UserId, x.Date))
            .ToHashSet();

        var days = Enumerable.Range(0, 7).Select(i => request.WeekStart.AddDays(i)).ToList();
        var missing = staff
            .Select(u => new MissingDaysDto(u.Id, u.FullName, days.Where(d => !filled.Contains((u.Id, d))).ToList()))
            .Where(m => m.Dates.Count > 0)
            .OrderBy(m => m.Name)
            .ToList();

        if (missing.Count > 0)
        {
            var problem = this.ApiError(409, "plan_incomplete", "Planda boş günler var. Her gün için vardiya ya da izin seçilmeli.");
            ((ProblemDetails)problem.Value!).Extensions["missing"] = missing;
            return problem;
        }

        var branchIds = staff.Where(u => u.BranchId != null).Select(u => u.BranchId!.Value).Distinct().ToList();
        if (branchIds.Count == 0 && currentUser.BranchId is { } own) branchIds.Add(own);

        var now = DateTimeOffset.UtcNow;
        var existing = await db.ShiftWeeks
            .Where(w => w.WeekStart == request.WeekStart && branchIds.Contains(w.BranchId))
            .ToDictionaryAsync(w => w.BranchId, ct);
        foreach (var branchId in branchIds)
        {
            if (!existing.TryGetValue(branchId, out var week))
            {
                week = new ShiftWeek { BranchId = branchId, WeekStart = request.WeekStart };
                db.ShiftWeeks.Add(week);
            }
            week.PublishedAt = now;
            week.PublishedByUserId = currentUser.UserId!.Value;
        }

        notifier.Notify(staffIds, NotificationType.ShiftWeekPublished, new { weekStart = request.WeekStart });
        audit.Log("shifts.week_published", nameof(ShiftWeek), null, newValues: new { request.WeekStart, Branches = branchIds });
        await db.SaveChangesAsync(ct);
        return new PublishResult(now);
    }

    /// <summary>Yayını geri alır; personel bu haftanın vardiyalarını artık görmez.</summary>
    [HttpPost("unpublish")]
    public async Task<IActionResult> Unpublish(PublishWeekRequest request, CancellationToken ct)
    {
        var branchIds = await StaffScope().Where(u => u.BranchId != null).Select(u => u.BranchId!.Value).Distinct().ToListAsync(ct);
        if (currentUser.BranchId is { } own && !branchIds.Contains(own)) branchIds.Add(own);

        var weeks = await db.ShiftWeeks
            .Where(w => w.WeekStart == request.WeekStart && branchIds.Contains(w.BranchId))
            .ToListAsync(ct);
        if (weeks.Count > 0)
        {
            db.ShiftWeeks.RemoveRange(weeks);
            audit.Log("shifts.week_unpublished", nameof(ShiftWeek), null, oldValues: new { request.WeekStart });
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    /// <summary>Hücrelere şablon, özel saat ya da izin atar; dolu hücrenin kaydı değiştirilir.</summary>
    [HttpPost("assign")]
    public async Task<ActionResult<List<ShiftDto>>> Assign(AssignShiftsRequest request, CancellationToken ct)
    {
        var isWork = request.Kind == ShiftKind.Work;
        ShiftTemplate? template = null;
        TimeOnly start = default, end = default;

        if (isWork)
        {
            if (request.TemplateId is { } templateId)
            {
                template = await db.ShiftTemplates.FirstOrDefaultAsync(t => t.Id == templateId && t.IsActive, ct);
                if (template is null) return this.ApiError(400, "invalid_template", "Vardiya şablonu bulunamadı.");
                (start, end) = (template.StartTime, template.EndTime);
            }
            else if (request.StartTime is { } s && request.EndTime is { } e)
            {
                (start, end) = (s, e);
                // Özel saat bir şablonla birebir aynıysa o şablon sayılır (ör. 09:00–18:00 → "Tam gün").
                template = await db.ShiftTemplates
                    .Where(t => t.IsActive && t.StartTime == start && t.EndTime == end)
                    .OrderBy(t => t.CreatedAt)
                    .FirstOrDefaultAsync(ct);
            }
            else
            {
                return this.ApiError(400, "shift_times_required", "Şablon ya da başlangıç ve bitiş saati seçilmeli.");
            }

            if (ShiftMath.Validate(start, end) is { } timeError)
                return this.ApiError(400, timeError, "Vardiya saatleri geçersiz.");

            if (request.BreakMinutes is { } brk && TimeSpan.FromMinutes(brk) >= ShiftMath.Duration(start, end))
                return this.ApiError(400, "break_too_long", "Mola süresi vardiya süresinden kısa olmalı.");
        }

        var cells = request.Cells.Distinct().ToList();
        var userIds = cells.Select(c => c.UserId).Distinct().ToList();
        var users = await StaffScope().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        if (users.Count != userIds.Count)
            return this.ApiError(400, "invalid_staff", "Seçilen kişilerden biri planlanamaz.");

        var minDate = cells.Min(c => c.Date).AddDays(-1);
        var maxDate = cells.Max(c => c.Date).AddDays(1);
        var existing = await db.Shifts
            .Where(x => userIds.Contains(x.UserId) && x.Date >= minDate && x.Date <= maxDate)
            .ToListAsync(ct);

        if (isWork)
        {
            // Çakışma kontrolü: aynı kişinin önceki / sonraki günkü çalışma vardiyasıyla (gece vardiyaları ertesi güne taşar).
            var planned = existing
                .Where(x => x.Kind == ShiftKind.Work)
                .ToDictionary(x => (x.UserId, x.Date), x => (x.Date, x.StartTime, x.EndTime));
            foreach (var c in cells) planned[(c.UserId, c.Date)] = (c.Date, start, end);
            foreach (var c in cells)
            {
                var mine = planned[(c.UserId, c.Date)];
                foreach (var neighbour in new[] { c.Date.AddDays(-1), c.Date.AddDays(1) })
                {
                    if (planned.TryGetValue((c.UserId, neighbour), out var other) && ShiftMath.Overlaps(mine, other))
                    {
                        var problem = this.ApiError(409, "shift_overlap",
                            $"{users[c.UserId].FullName} için {c.Date:dd.MM} vardiyası bir önceki/sonraki günle çakışıyor.");
                        ((ProblemDetails)problem.Value!).Extensions["userId"] = c.UserId;
                        ((ProblemDetails)problem.Value!).Extensions["date"] = c.Date;
                        return problem;
                    }
                }
            }
        }

        var byCell = existing.ToDictionary(x => (x.UserId, x.Date));
        var result = new List<Shift>();
        foreach (var c in cells)
        {
            if (!byCell.TryGetValue((c.UserId, c.Date), out var shift))
            {
                shift = new Shift
                {
                    UserId = c.UserId,
                    Date = c.Date,
                    BranchId = users[c.UserId].BranchId ?? currentUser.BranchId ?? Guid.Empty,
                    CreatedByUserId = currentUser.UserId!.Value
                };
                db.Shifts.Add(shift);
            }
            shift.Kind = request.Kind;
            // Mola belirtilmezse boş kalır ve çalışma kurallarındaki günlük mola (ör. 60 dk) geçerli olur.
            shift.BreakMinutes = isWork ? request.BreakMinutes : null;
            shift.StartTime = start;
            shift.EndTime = end;
            shift.ShiftTemplateId = template?.Id;
            shift.ShiftTemplate = template;
            shift.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            result.Add(shift);
        }

        if (result.Any(r => r.BranchId == Guid.Empty))
            return this.ApiError(400, "invalid_branch", "Personelin şubesi tanımlı değil.");

        await NotifyIfPublishedAsync(result.Select(r => (r.UserId, r.BranchId, r.Date)), ct);

        audit.Log("shifts.assigned", nameof(Shift), null, newValues: new
        {
            Count = cells.Count, Kind = request.Kind.ToString(), Start = start, End = end, TemplateId = template?.Id, request.BreakMinutes,
            Cells = cells.Select(c => new { c.UserId, c.Date })
        });
        await db.SaveChangesAsync(ct);
        return result.Select(ShiftDto.From).ToList();
    }

    [HttpPost("clear")]
    public async Task<IActionResult> Clear(ClearShiftsRequest request, CancellationToken ct)
    {
        var userIds = request.Cells.Select(c => c.UserId).Distinct().ToList();
        var dates = request.Cells.Select(c => c.Date).Distinct().ToList();
        var cellSet = request.Cells.Select(c => (c.UserId, c.Date)).ToHashSet();

        var staffIds = StaffScope().Select(u => u.Id);
        var candidates = await db.Shifts
            .Where(s => userIds.Contains(s.UserId) && dates.Contains(s.Date) && staffIds.Contains(s.UserId))
            .ToListAsync(ct);
        var toRemove = candidates.Where(s => cellSet.Contains((s.UserId, s.Date))).ToList();

        if (toRemove.Count > 0)
        {
            await NotifyIfPublishedAsync(toRemove.Select(r => (r.UserId, r.BranchId, r.Date)), ct);
            db.Shifts.RemoveRange(toRemove);
            audit.Log("shifts.cleared", nameof(Shift), null,
                oldValues: toRemove.Select(s => new { s.UserId, s.Date, s.StartTime, s.EndTime }));
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    /// <summary>Bir haftanın planını başka bir haftaya kopyalar.</summary>
    [HttpPost("copy-week")]
    public async Task<ActionResult<CopyWeekResult>> CopyWeek(CopyWeekRequest request, CancellationToken ct)
    {
        var offset = request.ToWeekStart.DayNumber - request.FromWeekStart.DayNumber;
        if (offset == 0 || offset % 7 != 0)
            return this.ApiError(400, "invalid_range", "Kaynak ve hedef hafta geçersiz.");

        var staffIds = StaffScope().Where(u => u.IsActive).Select(u => u.Id);
        var source = await db.Shifts.AsNoTracking()
            .Where(s => s.Date >= request.FromWeekStart && s.Date < request.FromWeekStart.AddDays(7) && staffIds.Contains(s.UserId))
            .ToListAsync(ct);
        var target = await db.Shifts
            .Where(s => s.Date >= request.ToWeekStart && s.Date < request.ToWeekStart.AddDays(7) && staffIds.Contains(s.UserId))
            .ToDictionaryAsync(s => (s.UserId, s.Date), ct);

        int copied = 0, skipped = 0;
        foreach (var s in source)
        {
            var date = s.Date.AddDays(offset);
            if (target.TryGetValue((s.UserId, date), out var existing))
            {
                if (!request.Overwrite) { skipped++; continue; }
                existing.Kind = s.Kind;
                existing.BreakMinutes = s.BreakMinutes;
                existing.StartTime = s.StartTime;
                existing.EndTime = s.EndTime;
                existing.ShiftTemplateId = s.ShiftTemplateId;
                existing.Note = s.Note;
            }
            else
            {
                db.Shifts.Add(new Shift
                {
                    UserId = s.UserId,
                    BranchId = s.BranchId,
                    Date = date,
                    Kind = s.Kind,
                    BreakMinutes = s.BreakMinutes,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime,
                    ShiftTemplateId = s.ShiftTemplateId,
                    Note = s.Note,
                    CreatedByUserId = currentUser.UserId!.Value
                });
            }
            copied++;
        }

        if (copied > 0)
        {
            audit.Log("shifts.week_copied", nameof(Shift), null, newValues: new { request.FromWeekStart, request.ToWeekStart, copied, skipped });
            await db.SaveChangesAsync(ct);
        }
        return new CopyWeekResult(copied, skipped);
    }

    /// <summary>Yayındaki bir haftada değişen vardiyalar için kişilere bildirim (kişi başına tek bildirim).</summary>
    private async Task NotifyIfPublishedAsync(IEnumerable<(Guid UserId, Guid BranchId, DateOnly Date)> changes, CancellationToken ct)
    {
        var list = changes.ToList();
        var published = await publication.PublishedDaysAsync(list.Select(c => (c.BranchId, c.Date)).Distinct().ToList(), ct);
        foreach (var group in list.Where(c => published.Contains((c.BranchId, c.Date))).GroupBy(c => c.UserId))
        {
            var dates = group.Select(c => c.Date).Distinct().OrderBy(d => d).ToList();
            notifier.Notify(group.Key, NotificationType.ShiftChanged, new { dates });
        }
    }

    /// <summary>Planlanabilir kişiler: Personel ve Müdür. Müdür yalnızca kendi şubesini görür.</summary>
    private IQueryable<User> StaffScope()
    {
        var query = db.Users.Where(u => RolePermissions.Workforce.Contains(u.Role));
        return currentUser.Role == UserRole.Manager ? query.Where(u => u.BranchId == currentUser.BranchId) : query;
    }
}

/// <summary>Kişinin kendi vardiyaları (yalnızca yayınlanmış haftalar).</summary>
[ApiController]
[Route("api/me/shifts")]
[Authorize(Roles = Roles.Staff)]
public class MyShiftsController(PdksDbContext db, ICurrentUser currentUser, ShiftPublication publication) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ShiftDto>>> List([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
    {
        if (to < from || to.DayNumber - from.DayNumber > 62)
            return this.ApiError(400, "invalid_range", "Tarih aralığı geçersiz.");

        var shifts = await db.Shifts.AsNoTracking()
            .Include(s => s.ShiftTemplate)
            .Where(s => s.UserId == currentUser.UserId && s.Date >= from && s.Date <= to)
            .OrderBy(s => s.Date)
            .ToListAsync(ct);
        // Yalnızca yayınlanmış haftalar
        return (await publication.VisibleAsync(shifts, ct)).Select(ShiftDto.From).ToList();
    }
}
