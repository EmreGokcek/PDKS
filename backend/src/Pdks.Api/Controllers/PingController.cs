using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pdks.Api.Auth;

namespace Pdks.Api.Controllers;

/// <summary>Rol yetkilerinin çalıştığını test etmek için basit uç noktalar.</summary>
[ApiController]
[Route("api/ping")]
public class PingController : ControllerBase
{
    [HttpGet, AllowAnonymous]
    public IActionResult Ping() => Ok(new { status = "ok", time = DateTimeOffset.UtcNow });

    [HttpGet("admin"), Authorize(Roles = Roles.Admin)]
    public IActionResult AdminOnly() => Ok(new { message = "Admin yetkisi doğrulandı." });

    [HttpGet("manager"), Authorize(Roles = Roles.AdminOrManager)]
    public IActionResult ManagerOrAdmin() => Ok(new { message = "Müdür yetkisi doğrulandı." });
}
