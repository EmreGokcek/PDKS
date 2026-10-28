using Pdks.Domain.Enums;
using Pdks.Domain.Security;

namespace Pdks.Tests;

public class PermissionsTests
{
    [Fact]
    public void Every_permission_belongs_to_some_role() =>
        Assert.All(Perm.All, p => Assert.NotEmpty(RolePermissions.RolesWith(p)));

    [Fact]
    public void Employee_only_has_own_attendance() =>
        Assert.Equal(new[] { Perm.AttendanceSelf }, RolePermissions.For(UserRole.Employee));

    [Fact]
    public void Kiosk_has_nothing_but_the_kiosk_screen() =>
        Assert.Equal(new[] { Perm.Kiosk }, RolePermissions.For(UserRole.Kiosk));

    [Theory]
    [InlineData(UserRole.Manager, Perm.StaffManage, false)]
    [InlineData(UserRole.Manager, Perm.RulesManage, false)]
    [InlineData(UserRole.Manager, Perm.ShiftsPlan, true)]
    [InlineData(UserRole.HumanResources, Perm.ShiftsPlan, false)]
    [InlineData(UserRole.HumanResources, Perm.StaffManage, true)]
    [InlineData(UserRole.HumanResources, Perm.RulesManage, false)]
    [InlineData(UserRole.HumanResources, Perm.CompanyManage, false)]
    [InlineData(UserRole.Admin, Perm.CompanyManage, true)]
    [InlineData(UserRole.Admin, Perm.Kiosk, false)]
    public void Role_matrix(UserRole role, string permission, bool expected) =>
        Assert.Equal(expected, RolePermissions.Has(role, permission));

    [Fact]
    public void Hr_cannot_create_admins() =>
        Assert.DoesNotContain(UserRole.Admin, RolePermissions.AssignableRoles(UserRole.HumanResources));

    [Fact]
    public void Only_admin_and_hr_see_the_whole_company()
    {
        Assert.True(RolePermissions.IsCompanyWide(UserRole.Admin));
        Assert.True(RolePermissions.IsCompanyWide(UserRole.HumanResources));
        Assert.False(RolePermissions.IsCompanyWide(UserRole.Manager));
    }
}
