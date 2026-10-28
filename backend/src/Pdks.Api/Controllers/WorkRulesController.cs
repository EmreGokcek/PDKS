using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Domain.Security;
using Pdks.Api.Contracts;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Services;

namespace Pdks.Api.Controllers;

/// <summary>Firmanın çalışma kuralları. Herkes okuyabilir (personel kalan molasını hesaplamak için), yalnızca Admin değiştirir.</summary>
[ApiController]
[Route("api/settings/work-rules")]
[Authorize]
public class WorkRulesController(PdksDbContext db, AuditLogger audit) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<WorkRuleDto>> Get(CancellationToken ct)
    {
        var rule = await GetOrCreateAsync(ct);
        return ToDto(rule);
    }

    [HttpPut, Authorize(Policy = Perm.RulesManage)]
    public async Task<ActionResult<WorkRuleDto>> Update(UpdateWorkRuleRequest request, CancellationToken ct)
    {
        var rule = await GetOrCreateAsync(ct);
        var before = ToDto(rule);

        rule.WeeklyWorkMinutes = request.WeeklyWorkMinutes;
        rule.DailyBreakMinutes = request.DailyBreakMinutes;
        rule.LateToleranceMinutes = request.LateToleranceMinutes;
        rule.WeekStartsOn = request.WeekStartsOn;
        rule.NotArrivedAlertMinutes = request.NotArrivedAlertMinutes;
        rule.BreakOverrunAlert = request.BreakOverrunAlert;

        audit.Log("work_rule.updated", nameof(WorkRule), rule.Id, before, ToDto(rule));
        await db.SaveChangesAsync(ct);
        return ToDto(rule);
    }

    /// <summary>Her firmada tek kural kaydı olur; yoksa varsayılanlarla oluşturulur.</summary>
    private async Task<WorkRule> GetOrCreateAsync(CancellationToken ct)
    {
        var rule = await db.WorkRules.FirstOrDefaultAsync(ct);
        if (rule is not null) return rule;

        rule = new WorkRule();
        db.WorkRules.Add(rule);
        await db.SaveChangesAsync(ct);
        return rule;
    }

    private static WorkRuleDto ToDto(WorkRule r) =>
        new(r.WeeklyWorkMinutes, r.DailyBreakMinutes, r.LateToleranceMinutes, r.WeekStartsOn, r.NotArrivedAlertMinutes, r.BreakOverrunAlert);
}
