using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pdks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShiftUniquePerDay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Shifts_UserId_Date",
                table: "Shifts");

            migrationBuilder.CreateIndex(
                name: "IX_Shifts_UserId_Date",
                table: "Shifts",
                columns: new[] { "UserId", "Date" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Shifts_UserId_Date",
                table: "Shifts");

            migrationBuilder.CreateIndex(
                name: "IX_Shifts_UserId_Date",
                table: "Shifts",
                columns: new[] { "UserId", "Date" });
        }
    }
}
