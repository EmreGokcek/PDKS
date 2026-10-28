using Pdks.Infrastructure.Alerts;

namespace Pdks.Api.Live;

/// <summary>Dakikada bir anlık uyarıları tarar (gelmeyen personel, mola aşımı). Ayar: Alerts:Enabled.</summary>
public sealed class AttendanceAlertWorker(IServiceScopeFactory scopes, TimeProvider time, ILogger<AttendanceAlertWorker> log) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(Interval, time, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            try
            {
                using var scope = scopes.CreateScope();
                var sent = await scope.ServiceProvider.GetRequiredService<AttendanceAlertScanner>().RunAsync(stoppingToken);
                if (sent > 0) log.LogInformation("{Count} anlık uyarı gönderildi.", sent);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                log.LogError(ex, "Anlık uyarı taraması başarısız oldu.");
            }
        }
    }
}
