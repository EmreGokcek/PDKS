namespace Pdks.Api.Auth;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "pdks-api";
    public string Audience { get; set; } = "pdks-web";
    /// <summary>En az 32 karakter. Üretimde ortam değişkeninden verilmeli.</summary>
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 480;
}
