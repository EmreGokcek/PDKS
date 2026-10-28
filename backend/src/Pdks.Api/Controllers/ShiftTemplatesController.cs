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
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

/// <summary>Vardiya şablonları ("Sabah 08:00–16:00" gibi). Admin ve müdür yönetir.</summary>
[ApiController]
[Route("api/shift-templates")]
[Authorize(Policy = Perm.ShiftsPlan)]
public class ShiftTemplatesController(PdksDbContext db, ICurrentUser currentUser, AuditLogger audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ShiftTemplateDto>>> List(CancellationToken ct)
    {
        var templates = await Scope().Where(t => t.IsActive).OrderBy(t => t.StartTime).ThenBy(t => t.Name).ToListAsync(ct);
        return templates.Select(ShiftTemplateDto.From).ToList();
    }

    [HttpPost]
    public async Task<ActionResult<ShiftTemplateDto>> Create(SaveShiftTemplateRequest request, CancellationToken ct)
    {
        if (ShiftMath.Validate(request.StartTime, request.EndTime) is { } error)
            return this.ApiError(400, error, "Vardiya saatleri geçersiz.");

        var branchId = currentUser.BranchId ?? await db.Branches.Select(b => (Guid?)b.Id).FirstOrDefaultAsync(ct);
        if (branchId is null) return this.ApiError(400, "invalid_branch", "Şube bulunamadı.");

        var template = new ShiftTemplate
        {
            BranchId = branchId.Value,
            Name = request.Name.Trim(),
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Color = request.Color.ToLowerInvariant()
        };
        db.ShiftTemplates.Add(template);
        audit.Log("shift_template.created", nameof(ShiftTemplate), template.Id, newValues: ShiftTemplateDto.From(template));
        await db.SaveChangesAsync(ct);
        return ShiftTemplateDto.From(template);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ShiftTemplateDto>> Update(Guid id, SaveShiftTemplateRequest request, CancellationToken ct)
    {
        var template = await Scope().FirstOrDefaultAsync(t => t.Id == id && t.IsActive, ct);
        if (template is null) return this.NotFoundError();
        if (ShiftMath.Validate(request.StartTime, request.EndTime) is { } error)
            return this.ApiError(400, error, "Vardiya saatleri geçersiz.");

        var before = ShiftTemplateDto.From(template);
        template.Name = request.Name.Trim();
        template.StartTime = request.StartTime;
        template.EndTime = request.EndTime;
        template.Color = request.Color.ToLowerInvariant();

        // Not: Daha önce bu şablonla atanmış vardiyaların saatleri değişmez; saatler vardiyaya kopyalanır.
        audit.Log("shift_template.updated", nameof(ShiftTemplate), template.Id, before, ShiftTemplateDto.From(template));
        await db.SaveChangesAsync(ct);
        return ShiftTemplateDto.From(template);
    }

    /// <summary>Şablonu listeden kaldırır. Bu şablonla atanmış vardiyalar olduğu gibi kalır.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var template = await Scope().FirstOrDefaultAsync(t => t.Id == id && t.IsActive, ct);
        if (template is null) return this.NotFoundError();
        template.IsActive = false;
        audit.Log("shift_template.deleted", nameof(ShiftTemplate), template.Id);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private IQueryable<ShiftTemplate> Scope() =>
        currentUser.Role == UserRole.Manager
            ? db.ShiftTemplates.Where(t => t.BranchId == currentUser.BranchId)
            : db.ShiftTemplates;
}
