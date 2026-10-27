using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Attendance;
using Pdks.Infrastructure.Scheduling;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Persistence.Seed;
using Pdks.Infrastructure.Services;

namespace Pdks.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionStrings:Default bulunamadı.");

        services.AddDbContext<PdksDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.Configure<SeedOptions>(configuration.GetSection(SeedOptions.SectionName));
        services.AddScoped<DbSeeder>();
        services.AddScoped<AuditLogger>();
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<KioskQrTokens>();
        services.AddScoped<AttendanceService>();
        services.AddScoped<ShiftPublication>();

        return services;
    }
}
