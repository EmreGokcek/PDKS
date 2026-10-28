namespace Pdks.Api.Auth;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "pdks-api";
    public string Audience { get; set; } = "pdks-web";
    /// <summary>En az 32 karakter. Üretimde ortam değişkeninden verilmeli.</summary>
    public string SigningKey { get; set; } = string.Empty;
    /// <summary>Kısa tutulur; süresi dolunca tarayıcı çerezdeki yenileme anahtarıyla sessizce yenisini alır.</summary>
    public int AccessTokenMinutes { get; set; } = 15;
    /// <summary>Girişteki tablet her gün yeniden giriş istemesin diye kiosk oturumu daha uzun tutulur.</summary>
    public int KioskTokenDays { get; set; } = 30;
}
