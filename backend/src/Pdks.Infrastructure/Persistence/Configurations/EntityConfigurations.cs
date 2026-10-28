using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pdks.Domain.Entities;

namespace Pdks.Infrastructure.Persistence.Configurations;

internal class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> b)
    {
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();

        b.HasMany(x => x.Branches).WithOne(x => x.Company)
            .HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);

        b.HasMany(x => x.Users).WithOne(x => x.Company)
            .HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.WorkRule).WithOne()
            .HasForeignKey<WorkRule>(x => x.CompanyId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> b)
    {
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.TimeZone).HasMaxLength(64).IsRequired();
        b.HasIndex(x => x.CompanyId);
    }
}

internal class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(100).IsRequired();
        b.Property(x => x.Email).HasMaxLength(256).IsRequired();
        b.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        b.Property(x => x.EmployeeNumber).HasMaxLength(50);
        b.Property(x => x.Phone).HasMaxLength(30);
        b.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Position).HasMaxLength(100);
        b.Property(x => x.Address).HasMaxLength(300);
        b.Property(x => x.BloodType).HasMaxLength(5);
        b.Property(x => x.EmergencyContactName).HasMaxLength(150);
        b.Property(x => x.EmergencyContactPhone).HasMaxLength(30);
        b.Property(x => x.EmergencyContactRelation).HasMaxLength(50);
        b.Property(x => x.ShareBirthday).HasDefaultValue(true);
        b.Property(x => x.PrivacyNoticeVersion).HasMaxLength(20);

        b.HasIndex(x => x.Email).IsUnique();
        b.HasIndex(x => new { x.CompanyId, x.Role });

        b.HasOne(x => x.Branch).WithMany()
            .HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);

        b.Ignore(x => x.FullName);
        b.Ignore(x => x.HasRequiredProfile);
    }
}

internal class WorkRuleConfiguration : IEntityTypeConfiguration<WorkRule>
{
    public void Configure(EntityTypeBuilder<WorkRule> b)
    {
        b.HasIndex(x => x.CompanyId).IsUnique();
        b.Property(x => x.WeekStartsOn).HasConversion<string>().HasMaxLength(20);
    }
}

internal class ShiftTemplateConfiguration : IEntityTypeConfiguration<ShiftTemplate>
{
    public void Configure(EntityTypeBuilder<ShiftTemplate> b)
    {
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.Color).HasMaxLength(20);
        b.HasIndex(x => new { x.CompanyId, x.BranchId });
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal class ShiftConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> b)
    {
        b.Property(x => x.Note).HasMaxLength(500);
        b.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20).HasDefaultValueSql("'Work'");
        b.HasIndex(x => new { x.CompanyId, x.BranchId, x.Date });
        // Kişi başına günde en fazla bir vardiya.
        b.HasIndex(x => new { x.UserId, x.Date }).IsUnique();

        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ShiftTemplate).WithMany().HasForeignKey(x => x.ShiftTemplateId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal class ShiftWeekConfiguration : IEntityTypeConfiguration<ShiftWeek>
{
    public void Configure(EntityTypeBuilder<ShiftWeek> b)
    {
        b.HasIndex(x => new { x.BranchId, x.WeekStart }).IsUnique();
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal class StaffRequestConfiguration : IEntityTypeConfiguration<StaffRequest>
{
    public void Configure(EntityTypeBuilder<StaffRequest> b)
    {
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.EventType).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.LeaveKind).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        b.Property(x => x.ReviewNote).HasMaxLength(500);

        b.HasIndex(x => new { x.CompanyId, x.BranchId, x.Status });
        b.HasIndex(x => new { x.UserId, x.CreatedAt });

        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(40);
        b.Property(x => x.Data).HasColumnType("jsonb");
        b.HasIndex(x => new { x.UserId, x.CreatedAt });
        b.HasIndex(x => new { x.UserId, x.ReadAt });
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal class AttendanceEventConfiguration : IEntityTypeConfiguration<AttendanceEvent>
{
    public void Configure(EntityTypeBuilder<AttendanceEvent> b)
    {
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Source).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.Note).HasMaxLength(500);

        b.HasIndex(x => new { x.UserId, x.OccurredAt });
        b.HasIndex(x => new { x.CompanyId, x.BranchId, x.OccurredAt });

        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Kiosk).WithMany().HasForeignKey(x => x.KioskId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal class KioskConfiguration : IEntityTypeConfiguration<Kiosk>
{
    public void Configure(EntityTypeBuilder<Kiosk> b)
    {
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.Secret).HasMaxLength(128).IsRequired();
        b.HasIndex(x => x.DeviceUserId).IsUnique();

        b.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.DeviceUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.Property(x => x.Action).HasMaxLength(100).IsRequired();
        b.Property(x => x.EntityName).HasMaxLength(100).IsRequired();
        b.Property(x => x.OldValues).HasColumnType("jsonb");
        b.Property(x => x.NewValues).HasColumnType("jsonb");
        b.Property(x => x.Reason).HasMaxLength(500);
        b.HasIndex(x => new { x.CompanyId, x.CreatedAt });
    }
}

internal class AnnouncementConfiguration : IEntityTypeConfiguration<Announcement>
{
    public void Configure(EntityTypeBuilder<Announcement> b)
    {
        b.Property(x => x.Title).HasMaxLength(120).IsRequired();
        b.Property(x => x.Body).HasMaxLength(1000);
        b.Property(x => x.ShowOnKiosk).HasDefaultValue(true);
        b.HasIndex(x => new { x.CompanyId, x.CreatedAt });
        b.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedById).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal class CongratulationConfiguration : IEntityTypeConfiguration<Congratulation>
{
    public void Configure(EntityTypeBuilder<Congratulation> b)
    {
        b.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20);
        b.HasIndex(x => new { x.FromUserId, x.ToUserId, x.Kind, x.Date }).IsUnique();
        b.HasIndex(x => new { x.ToUserId, x.Date });
        b.HasOne<User>().WithMany().HasForeignKey(x => x.FromUserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ToUserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.RevokedReason).HasMaxLength(30);
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => new { x.UserId, x.RevokedAt });
        b.HasIndex(x => x.FamilyId);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
