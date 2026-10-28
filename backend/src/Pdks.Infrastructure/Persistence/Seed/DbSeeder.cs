using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;

namespace Pdks.Infrastructure.Persistence.Seed;

/// <summary>
/// Geliştirme ortamında boş veritabanına demo firma ve her rolden bir hesap ekler.
/// Veritabanında herhangi bir firma varsa hiçbir şey yapmaz.
/// </summary>
public class DbSeeder(PdksDbContext db, IPasswordHasher<User> hasher, ILogger<DbSeeder> logger)
{
    public async Task SeedAsync(SeedOptions options, CancellationToken ct = default)
    {
        if (!options.Enabled) return;

        if (string.IsNullOrWhiteSpace(options.DefaultPassword))
            throw new InvalidOperationException("Seed:DefaultPassword ayarlanmalı.");

        if (await db.Companies.AnyAsync(ct))
        {
            await EnsureDemoShiftTemplatesAsync(ct);
            await EnsureDemoSocialAsync(ct);
            return;
        }

        var company = new Company { Name = options.CompanyName };
        var branch = new Branch { CompanyId = company.Id, Name = options.BranchName };
        var workRule = new WorkRule { CompanyId = company.Id };

        db.Companies.Add(company);
        db.Branches.Add(branch);
        db.WorkRules.Add(workRule);

        User NewUser(string first, string last, string email, UserRole role)
        {
            var user = new User
            {
                CompanyId = company.Id,
                BranchId = branch.Id,
                FirstName = first,
                LastName = last,
                Email = email.Trim().ToLowerInvariant(),
                Role = role
            };
            user.PasswordHash = hasher.HashPassword(user, options.DefaultPassword);
            db.Users.Add(user);
            return user;
        }

        NewUser("Sistem", "Yöneticisi", options.AdminEmail, UserRole.Admin);
        NewUser("Demo", "Müdür", options.ManagerEmail, UserRole.Manager);
        NewUser("Demo", "Personel", options.EmployeeEmail, UserRole.Employee);
        var kioskUser = NewUser("Giriş", "Kiosku", options.KioskEmail, UserRole.Kiosk);

        db.Kiosks.Add(new Kiosk
        {
            CompanyId = company.Id,
            BranchId = branch.Id,
            Name = "Ana Giriş",
            Secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
            DeviceUserId = kioskUser.Id
        });

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Demo verisi oluşturuldu: {Company} / {Branch}", company.Name, branch.Name);

        await EnsureDemoShiftTemplatesAsync(ct);
        await EnsureDemoSocialAsync(ct);
    }

    /// <summary>
    /// Duyuru panosu boş görünmesin diye demo firmasına bir hoş geldin duyurusu ekler;
    /// tarihleri boş demo hesaplara bugün doğum günü ve yaklaşan bir iş yıl dönümü verir.
    /// Firmada daha önce hiç duyuru varsa hiçbir şey yapmaz.
    /// </summary>
    private async Task EnsureDemoSocialAsync(CancellationToken ct)
    {
        var company = await db.Companies.IgnoreQueryFilters().OrderBy(c => c.CreatedAt).FirstOrDefaultAsync(ct);
        if (company is null) return;
        if (await db.Announcements.IgnoreQueryFilters().AnyAsync(a => a.CompanyId == company.Id, ct)) return;

        var users = await db.Users.IgnoreQueryFilters().Where(u => u.CompanyId == company.Id).ToListAsync(ct);
        var admin = users.FirstOrDefault(u => u.Role == UserRole.Admin);
        if (admin is null) return;

        var today = DateOnly.FromDateTime(DateTime.Today);
        if (users.FirstOrDefault(u => u.Role == UserRole.Employee) is { BirthDate: null } employee)
            employee.BirthDate = new DateOnly(1996, today.Month, today.Month == 2 && today.Day == 29 ? 28 : today.Day);
        if (users.FirstOrDefault(u => u.Role == UserRole.Manager) is { HireDate: null } manager)
            manager.HireDate = today.AddDays(2).AddYears(-3);

        db.Announcements.Add(new Announcement
        {
            CompanyId = company.Id,
            Title = "PDKS'ye hoş geldiniz",
            Body = "Giriş, çıkış ve molalarınızı girişteki kiosktan QR okutarak kaydedebilirsiniz. Vardiyalarınızı ve taleplerinizi uygulamadan takip edin.",
            IsPinned = true,
            CreatedById = admin.Id
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Demo duyurusu ve kutlama tarihleri eklendi.");
    }

    /// <summary>Demo firmasında hiç vardiya şablonu yoksa örnek şablonlar ekler.</summary>
    private async Task EnsureDemoShiftTemplatesAsync(CancellationToken ct)
    {
        var branch = await db.Branches.IgnoreQueryFilters().OrderBy(b => b.CreatedAt).FirstOrDefaultAsync(ct);
        if (branch is null) return;
        if (await db.ShiftTemplates.IgnoreQueryFilters().AnyAsync(t => t.CompanyId == branch.CompanyId, ct)) return;

        ShiftTemplate T(string name, int sh, int sm, int eh, int em, string color) => new()
        {
            CompanyId = branch.CompanyId,
            BranchId = branch.Id,
            Name = name,
            StartTime = new TimeOnly(sh, sm),
            EndTime = new TimeOnly(eh, em),
            Color = color
        };

        db.ShiftTemplates.AddRange(
            T("Sabah", 8, 0, 16, 0, "#2f80ed"),
            T("Tam gün", 9, 0, 18, 0, "#1f9a76"),
            T("Akşam", 16, 0, 0, 0, "#9b51e0"),
            T("Gece", 0, 0, 8, 0, "#e07a2f"));
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Örnek vardiya şablonları eklendi.");
    }
}
