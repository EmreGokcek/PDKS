using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Persistence;

namespace Pdks.Api.Controllers;

/// <summary>Personelin kendi giriş-çıkış işlemleri. Kiosk hesapları kullanamaz.</summary>
[ApiController]
[Authorize(Roles = Roles.Admin + "," + Roles.Manager + "," + Roles.Employee)]
public class AttendanceController(
    PdksDbContext db,
    ICurrentUser currentUser,
    AttendanceService attendance,
    KioskQrTokens qrTokens) : ControllerBase
{
    /// <summary>Bugünkü durum, süreler ve haftalık özet.</summary>
    [HttpGet("api/me/attendance")]
    public async Task<ActionResult<AttendanceStatusDto>> Status(CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == currentUser.UserId, ct);
        if (user is null) return Unauthorized();
        return await WithShiftsAsync(AttendanceStatusDto.From(await attendance.GetSnapshotAsync(user, ct)), user.Id, ct);
    }

    /// <summary>Kiosktaki QR okutularak giriş, çıkış veya mola kaydı.</summary>
    [HttpPost("api/attendance/scan")]
    public async Task<ActionResult<ScanResponse>> Scan(ScanRequest request, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == currentUser.UserId, ct);
        if (user is null || !user.IsActive) return Unauthorized();

        var parsed = KioskQrTokens.Parse(request.QrToken);
        if (parsed is null) return InvalidQr();

        // Firma filtresi sayesinde başka firmanın kioskunun QR'ı burada bulunamaz.
        var kiosk = await db.Kiosks.FirstOrDefaultAsync(k => k.Id == parsed.KioskId, ct);
        if (kiosk is null) return InvalidQr();
        if (!kiosk.IsActive)
            return this.ApiError(400, "kiosk_inactive", "Bu kiosk kullanım dışı.");

        switch (qrTokens.Verify(parsed, kiosk.Secret))
        {
            case KioskQrTokens.Result.Invalid:
                return InvalidQr();
            case KioskQrTokens.Result.Expired:
                return this.ApiError(400, "qr_expired", "QR kodun süresi doldu. Ekrandaki güncel kodu okut.");
        }

        var (error, recorded) = await attendance.RecordAsync(user, request.Action, kiosk, ct);
        if (error is not null)
            return this.ApiError(409, error, "Bu işlem şu anki durumunla uyuşmuyor.");

        var snapshot = await attendance.GetSnapshotAsync(user, ct);
        var status = await WithShiftsAsync(AttendanceStatusDto.From(snapshot), user.Id, ct);
        return new ScanResponse(recorded!.Type, recorded.OccurredAt, kiosk.Name, status);
    }

    /// <summary>Bugünkü plan (vardiya ya da izin) ve henüz başlamamış ilk çalışma vardiyası.</summary>
    private async Task<AttendanceStatusDto> WithShiftsAsync(AttendanceStatusDto status, Guid userId, CancellationToken ct)
    {
        var today = status.Today.Date;
        var shifts = await db.Shifts.AsNoTracking()
            .Include(s => s.ShiftTemplate)
            .Where(s => s.UserId == userId && s.Date >= today && s.Date <= today.AddDays(14))
            .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
            .ToListAsync(ct);

        var tz = await attendance.TimeZoneForAsync(currentUser.BranchId, ct);
        var localNow = TimeZoneInfo.ConvertTime(status.ServerNow, tz).DateTime;

        var todayShift = shifts.FirstOrDefault(s => s.Date == today);
        var nextShift = shifts.FirstOrDefault(s => s.Kind == ShiftKind.Work && s.Date.ToDateTime(s.StartTime) > localNow);

        return status with
        {
            TodayShift = todayShift is null ? null : ShiftDto.From(todayShift),
            NextShift = nextShift is null ? null : ShiftDto.From(nextShift)
        };
    }

    private ObjectResult InvalidQr() =>
        this.ApiError(400, "invalid_qr", "Bu QR kod tanınmadı. Kiosk ekranındaki kodu okut.");
}
