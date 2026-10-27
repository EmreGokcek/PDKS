using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pdks.Api.Auth;
using Pdks.Api.Common;
using Pdks.Api.Contracts;
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
        return AttendanceStatusDto.From(await attendance.GetSnapshotAsync(user, ct));
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
        return new ScanResponse(recorded!.Type, recorded.OccurredAt, kiosk.Name, AttendanceStatusDto.From(snapshot));
    }

    private ObjectResult InvalidQr() =>
        this.ApiError(400, "invalid_qr", "Bu QR kod tanınmadı. Kiosk ekranındaki kodu okut.");
}
