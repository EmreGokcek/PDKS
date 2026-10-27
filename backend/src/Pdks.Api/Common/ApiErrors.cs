using Microsoft.AspNetCore.Mvc;

namespace Pdks.Api.Common;

/// <summary>
/// Hata yanıtları ProblemDetails biçimindedir ve "code" alanı taşır.
/// Web uygulaması bu kodu seçili dile çevirir; "title" Türkçe yedek mesajdır.
/// </summary>
public static class ApiErrors
{
    public static ObjectResult ApiError(this ControllerBase controller, int status, string code, string title)
    {
        var problem = new ProblemDetails { Status = status, Title = title };
        problem.Extensions["code"] = code;
        return new ObjectResult(problem) { StatusCode = status };
    }

    public static ObjectResult NotFoundError(this ControllerBase c, string title = "Kayıt bulunamadı.") =>
        c.ApiError(StatusCodes.Status404NotFound, "not_found", title);
}
