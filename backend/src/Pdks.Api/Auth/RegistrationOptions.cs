namespace Pdks.Api.Auth;

/// <summary>Firma kendi kendine kayıt ayarları ("Registration" bölümü).</summary>
public class RegistrationOptions
{
    public const string SectionName = "Registration";

    /// <summary>Giriş ekranında "Firmanı kaydet" açık mı? Kapalıysa yeni firma yalnızca elle kurulur. Ortam değişkeni: Registration__Enabled.</summary>
    public bool Enabled { get; set; } = true;
}
