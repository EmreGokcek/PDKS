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

        if (await db.Companies.AnyAsync(ct)) return;

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
    }
}
