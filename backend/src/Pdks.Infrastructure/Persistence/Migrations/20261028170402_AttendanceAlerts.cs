using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Pdks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AttendanceAlerts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BreakOverrunAlert",
                table: "WorkRules",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "NotArrivedAlertMinutes",
                table: "WorkRules",
                type: "integer",
                nullable: false,
                defaultValue: 15);

            migrationBuilder.CreateTable(
                name: "AttendanceAlerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CompanyId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceAlerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AttendanceAlerts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceAlerts_UserId_Date_Kind",
                table: "AttendanceAlerts",
                columns: new[] { "UserId", "Date", "Kind" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttendanceAlerts");

            migrationBuilder.DropColumn(
                name: "BreakOverrunAlert",
                table: "WorkRules");

            migrationBuilder.DropColumn(
                name: "NotArrivedAlertMinutes",
                table: "WorkRules");
        }
    }
}
