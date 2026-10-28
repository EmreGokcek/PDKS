namespace Pdks.Api.Auth;

/// <summary>KVKK aydınlatma metni. Metin değişince sürüm artırılır; herkes bir sonraki girişte yeniden onaylar.</summary>
public class PrivacyOptions
{
    public const string SectionName = "Privacy";

    /// <summary>Arayüzdeki metnin sürümüyle aynı olmalı (frontend/src/features/privacy/notice.ts).</summary>
    public string NoticeVersion { get; set; } = "2026-10";
}
