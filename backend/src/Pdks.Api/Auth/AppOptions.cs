namespace Pdks.Api.Auth;

/// <summary>Uygulamanın genel ayarları ("App" bölümü).</summary>
public class AppOptions
{
    public const string SectionName = "App";

    /// <summary>
    /// Uygulamanın dışarıdan erişilen adresi (ör. https://pdks.firma.com). Kiosk QR bağlantısı bu adresle üretilir.
    /// Boşsa kiosk ekranının açıldığı adres kullanılır. Ortam değişkeni: App__PublicUrl.
    /// </summary>
    public string? PublicUrl { get; set; }
}
