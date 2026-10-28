using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Pdks.Domain.Entities;
using Pdks.Domain.Enums;
using Pdks.Infrastructure.Persistence;

namespace Pdks.IntegrationTests;

/// <summary>
/// Yetki testleri için ek veri: demo firmada ikinci bir şube (müdür + personel), demo şubede ikinci bir müdür
/// ve tamamen ayrı bir firma. Veritabanına doğrudan yazılır, bir kez oluşturulur.
/// </summary>
public record TestWorld(
    Guid DemoCompanyId,
    User OtherBranchManager,
    User OtherBranchEmployee,
    User SecondManager,
    User RivalAdmin,
    User DemoEmployee,
    User DemoManager,
    User DemoAdmin)
{
    private static TestWorld? _world;
    private static readonly SemaphoreSlim Lock = new(1, 1);

    public static async Task<TestWorld> GetAsync(PdksApiFactory api)
    {
        if (_world is not null) return _world;
        await Lock.WaitAsync();
        try
        {
            return _world ??= await CreateAsync(api);
        }
        finally
        {
            Lock.Release();
        }
    }

    private static async Task<TestWorld> CreateAsync(PdksApiFactory api)
    {
        using var scope = api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PdksDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();

        var users = await db.Users.IgnoreQueryFilters().ToListAsync();
        var demoAdmin = users.Single(u => u.Email == "admin@pdks.local");
        var companyId = demoAdmin.CompanyId;
        var demoBranchId = demoAdmin.BranchId;

        var branch2 = new Branch { CompanyId = companyId, Name = "Şube 2" };
        var rival = new Company { Name = "Rakip Firma" };
        var rivalBranch = new Branch { CompanyId = rival.Id, Name = "Rakip Merkez" };
        db.AddRange(branch2, rival, rivalBranch);
        db.WorkRules.Add(new WorkRule { CompanyId = rival.Id });

        User U(string email, UserRole role, Guid company, Guid? branch)
        {
            var u = new User
            {
                CompanyId = company, BranchId = branch, FirstName = "Test", LastName = role.ToString(), Email = email, Role = role,
                Phone = "0555 000 00 00", BirthDate = new DateOnly(1990, 1, 1),
                EmergencyContactName = "Yakın", EmergencyContactPhone = "0555 111 11 11"
            };
            u.PasswordHash = hasher.HashPassword(u, PdksApiFactory.DemoPassword);
            db.Users.Add(u);
            return u;
        }

        var world = new TestWorld(
            companyId,
            U("mudur2@pdks.local", UserRole.Manager, companyId, branch2.Id),
            U("personel2@pdks.local", UserRole.Employee, companyId, branch2.Id),
            U("mudur3@pdks.local", UserRole.Manager, companyId, demoBranchId),
            U("admin@rakip.local", UserRole.Admin, rival.Id, rivalBranch.Id),
            users.Single(u => u.Email == "personel@pdks.local"),
            users.Single(u => u.Email == "mudur@pdks.local"),
            demoAdmin);
        await db.SaveChangesAsync();
        return world;
    }
}
