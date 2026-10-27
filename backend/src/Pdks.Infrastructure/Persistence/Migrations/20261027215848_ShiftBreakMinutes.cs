using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pdks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShiftBreakMinutes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BreakMinutes",
                table: "Shifts",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BreakMinutes",
                table: "Shifts");
        }
    }
}
