using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Pdks.Infrastructure.Email;

public record EmailMessage(string To, string Subject, string TextBody, string HtmlBody);

/// <summary>E-posta gönderir. Gönderim başarısız olursa hata fırlatır; çağıran karar verir.</summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}

/// <summary>SMTP ayarları ("Email" bölümü). Host boşsa e-posta gönderilmez, yalnızca günlüğe yazılır (geliştirme).</summary>
public class EmailOptions
{
    public const string SectionName = "Email";

    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? UserName { get; set; }
    public string? Password { get; set; }
    public bool EnableSsl { get; set; } = true;
    /// <summary>Gönderen adresi, ör. bildirim@firma.com</summary>
    public string? From { get; set; }
    public string FromName { get; set; } = "PDKS";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(From);
}

/// <summary>
/// SMTP ile gönderir; SMTP ayarlanmamışsa e-postayı günlüğe yazar (geliştirmede bağlantı konsolda görünür).
/// Brevo, Mailgun, Amazon SES, Gmail gibi her SMTP sağlayıcısıyla çalışır.
/// </summary>
public class SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> log) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var o = options.Value;
        if (!o.IsConfigured)
        {
            log.LogWarning("E-posta ayarlanmamış (Email:Host / Email:From); gönderilmedi. Alıcı: {To}, konu: {Subject}\n{Body}",
                message.To, message.Subject, message.TextBody);
            return;
        }

        using var mail = new MailMessage
        {
            From = new MailAddress(o.From!, o.FromName),
            Subject = message.Subject,
            Body = message.TextBody,
            IsBodyHtml = false
        };
        mail.To.Add(message.To);
        mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(message.HtmlBody, null, "text/html"));

        using var client = new SmtpClient(o.Host, o.Port) { EnableSsl = o.EnableSsl };
        if (!string.IsNullOrEmpty(o.UserName))
            client.Credentials = new NetworkCredential(o.UserName, o.Password);
        await client.SendMailAsync(mail, ct);
    }
}
