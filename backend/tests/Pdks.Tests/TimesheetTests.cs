using ClosedXML.Excel;
using Pdks.Domain.Attendance;
using Pdks.Domain.Enums;
using Pdks.Domain.Reports;
using Pdks.Infrastructure.Reports;

namespace Pdks.Tests;

public class TimesheetTests
{
    private static readonly DayPlan Work = new(ShiftKind.Work, new TimeOnly(8, 0), new TimeOnly(19, 0), null);
    private static readonly DayPlan Off = new(ShiftKind.WeeklyOff, default, default, null);
    private static readonly DateOnly Today = new(2026, 10, 28);

    /// <summary>Ekim 2026'yı kapsayan tam haftalar: hafta içi 10 saat, hafta sonu hafta tatili, 14 Ekim devamsız, 5 Ekim geç.</summary>
    private static List<DayRecord> October()
    {
        var (_, _, from, to) = TimesheetBuilder.Range(2026, 10, DayOfWeek.Monday);
        var days = new List<DayRecord>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            var weekend = d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            days.Add(weekend
                ? new DayRecord(d, Off, DayStatus.OnLeave, null, null, TimeSpan.Zero, TimeSpan.Zero, TimeSpan.FromHours(1), TimeSpan.Zero, 0, 0, false)
                : d == new DateOnly(2026, 10, 14)
                    ? new DayRecord(d, Work, DayStatus.Absent, null, null, TimeSpan.Zero, TimeSpan.Zero, TimeSpan.FromHours(1), TimeSpan.Zero, 0, 0, false)
                    : new DayRecord(d, Work, DayStatus.Present, null, null, TimeSpan.FromHours(10), TimeSpan.FromHours(1),
                        TimeSpan.FromHours(1), TimeSpan.Zero, d.Day == 5 ? 15 : 0, 0, false));
        }
        return days;
    }

    private static TimesheetRow Row() =>
        TimesheetBuilder.BuildRow(Guid.NewGuid(), "Mehmet Demir", "P-102", "Kasiyer", October(), 2026, 10, Today, 45 * 60, DayOfWeek.Monday, 60);

    [Fact]
    public void Range_covers_full_weeks_around_the_month()
    {
        var r = TimesheetBuilder.Range(2026, 10, DayOfWeek.Monday);
        Assert.Equal(new DateOnly(2026, 9, 28), r.From);
        Assert.Equal(new DateOnly(2026, 11, 1), r.To);
    }

    [Fact]
    public void Cells_have_the_right_codes()
    {
        var row = Row();
        Assert.Equal(31, row.Cells.Count);
        Assert.Equal(TimesheetCode.WeeklyOff, row.Cells[2].Code);   // 3 Ekim Cumartesi
        Assert.Equal(TimesheetCode.Absent, row.Cells[13].Code);     // 14 Ekim
        Assert.Equal(TimesheetCode.Planned, row.Cells[28].Code);    // 29 Ekim (gelecek)
        Assert.True(row.Cells[4].Late);                              // 5 Ekim
    }

    [Fact]
    public void Overtime_counts_weeks_ending_in_the_month()
    {
        // Ekim'de biten haftalar: 28 Eyl–4 Eki, 5–11, 12–18 (devamsızlık, 40 sa), 19–25. 26 Eki–1 Kas Kasım'a yazılır.
        var totals = Row().Totals;
        Assert.Equal(15, totals.OvertimeHours, 3);
        Assert.Equal(220, totals.PlannedHours, 3);
        Assert.Equal(1, totals.AbsentDays);
        Assert.Equal(1, totals.LateCount);
        Assert.Equal(9, totals.WeeklyOffDays);
    }

    [Fact]
    public void Excel_contains_summary_detail_and_legend()
    {
        var (first, last, _, _) = TimesheetBuilder.Range(2026, 10, DayOfWeek.Monday);
        var sheet = new Timesheet("Demo Şirket", "Merkez", 2026, 10, first, last, 45 * 60, DayOfWeek.Monday,
            TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul"), [Row()]);

        using var stream = new MemoryStream();
        TimesheetExcel.Write(sheet, stream);
        stream.Position = 0;
        using var wb = new XLWorkbook(stream);

        Assert.Equal(["Puantaj", "Detay", "Açıklamalar"], wb.Worksheets.Select(w => w.Name));

        var ws = wb.Worksheet("Puantaj");
        Assert.Equal("Mehmet Demir", ws.Cell(6, 2).GetString());
        Assert.Equal(10.0, ws.Cell(6, 4).GetDouble());          // 1 Ekim
        Assert.Equal("HT", ws.Cell(6, 6).GetString());          // 3 Ekim
        Assert.Equal("D", ws.Cell(6, 4 + 13).GetString());      // 14 Ekim

        var detail = wb.Worksheet("Detay");
        Assert.Equal("Ad soyad", detail.Cell(1, 2).GetString());
        Assert.Equal(32, detail.LastRowUsed()!.RowNumber());    // başlık + 31 gün
    }

    [Fact]
    public void Public_holidays_are_marked_and_holiday_work_is_totalled()
    {
        // 14 Ekim (devamsız) ve 1 Ekim (çalıştı, 10 sa) tatil sayılırsa:
        var holidays = new HashSet<DateOnly> { new(2026, 10, 14), new(2026, 10, 1), new(2026, 10, 29) };
        var row = TimesheetBuilder.BuildRow(Guid.NewGuid(), "Mehmet Demir", "P-102", "Kasiyer", October(), 2026, 10, Today, 45 * 60, DayOfWeek.Monday, 60, holidays);
        Assert.Equal(TimesheetCode.PublicHoliday, row.Cells[13].Code);   // gelmediği gün devamsız değil, resmi tatil
        Assert.Equal(TimesheetCode.Work, row.Cells[0].Code);             // tatilde çalıştı
        Assert.Equal(TimesheetCode.PublicHoliday, row.Cells[28].Code);   // 29 Ekim (gelecek) planlı değil, tatil
        Assert.Equal(0, row.Totals.AbsentDays);
        Assert.Equal(2, row.Totals.PublicHolidayDays);
        Assert.Equal(10, row.Totals.HolidayWorkHours, 3);
        Assert.Equal("RT", TimesheetBuilder.ShortCode(TimesheetCode.PublicHoliday));
    }
}
