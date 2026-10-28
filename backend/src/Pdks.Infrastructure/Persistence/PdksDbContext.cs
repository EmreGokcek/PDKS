using Microsoft.EntityFrameworkCore;
using Pdks.Domain.Common;
using Pdks.Domain.Entities;
using Pdks.Infrastructure.Auth;

namespace Pdks.Infrastructure.Persistence;

public class PdksDbContext(DbContextOptions<PdksDbContext> options, ICurrentUser currentUser)
    : DbContext(options)
{
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<User> Users => Set<User>();
    public DbSet<WorkRule> WorkRules => Set<WorkRule>();
    public DbSet<ShiftTemplate> ShiftTemplates => Set<ShiftTemplate>();
    public DbSet<Shift> Shifts => Set<Shift>();
    public DbSet<ShiftWeek> ShiftWeeks => Set<ShiftWeek>();
    public DbSet<StaffRequest> StaffRequests => Set<StaffRequest>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AttendanceEvent> AttendanceEvents => Set<AttendanceEvent>();
    public DbSet<Kiosk> Kiosks => Set<Kiosk>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<Congratulation> Congratulations => Set<Congratulation>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PublicHoliday> PublicHolidays => Set<PublicHoliday>();
    public DbSet<HolidayYear> HolidayYears => Set<HolidayYear>();
    public DbSet<LeaveAdjustment> LeaveAdjustments => Set<LeaveAdjustment>();
    public DbSet<ShiftSwap> ShiftSwaps => Set<ShiftSwap>();

    /// <summary>
    /// Global filtrede kullanılır. EF bu değeri her sorguda o anki kullanıcıdan okur.
    /// Giriş yapılmamışsa null olur ve hiçbir firma verisi dönmez.
    /// Giriş / seed gibi firma bağımsız işlemler IgnoreQueryFilters() kullanır.
    /// </summary>
    private Guid? CurrentCompanyId => currentUser.CompanyId;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PdksDbContext).Assembly);

        // Her TenantEntity'ye "sadece kendi firmanın verisi" filtresi uygula.
        var applyFilter = typeof(PdksDbContext)
            .GetMethod(nameof(ApplyTenantFilter), System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(TenantEntity).IsAssignableFrom(entityType.ClrType))
            {
                applyFilter.MakeGenericMethod(entityType.ClrType).Invoke(this, [modelBuilder]);
            }
        }
    }

    private void ApplyTenantFilter<T>(ModelBuilder modelBuilder) where T : TenantEntity
    {
        modelBuilder.Entity<T>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }

        // Yeni eklenen kayıtlara firma bilgisini otomatik ver.
        foreach (var entry in ChangeTracker.Entries<TenantEntity>())
        {
            if (entry.State == EntityState.Added && entry.Entity.CompanyId == Guid.Empty)
            {
                entry.Entity.CompanyId = CurrentCompanyId
                    ?? throw new InvalidOperationException("Firma bilgisi olmadan kayıt eklenemez.");
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
