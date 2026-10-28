using System.Globalization;
using ClosedXML.Excel;
using Pdks.Domain.Attendance;
using Pdks.Domain.Enums;
using Pdks.Domain.Reports;

namespace Pdks.Infrastructure.Reports;

/// <summary>
/// Aylık puantajı Excel'e yazar. İki sayfa:
/// - "Puantaj": kişi × gün tablosu ve aylık toplamlar (renkli, baskıya hazır)
/// - "Detay": kişi kişi, gün gün giriş / çıkış / çalışma / mola (bordro ve muhasebe için)
/// </summary>
public static class TimesheetExcel
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    private static readonly XLColor Brand = XLColor.FromHtml("#16324A");
    private static readonly XLColor Line = XLColor.FromHtml("#D9E1E7");
    private static readonly XLColor WeekendFill = XLColor.FromHtml("#F2F5F7");

    private static readonly Dictionary<TimesheetCode, (string Fill, string Font)> CodeColors = new()
    {
        [TimesheetCode.WeeklyOff] = ("#ECEFF3", "#52687C"),
        [TimesheetCode.AnnualLeave] = ("#D9F4F7", "#0B7F8C"),
        [TimesheetCode.SickLeave] = ("#FBE3E7", "#B0304A"),
        [TimesheetCode.ExcusedLeave] = ("#FBF1DC", "#8A5E10"),
        [TimesheetCode.Absent] = ("#FDEBE2", "#C2410C"),
    };

    public static string FileName(Timesheet t) => $"puantaj-{t.Year}-{t.Month:00}.xlsx";

    public static void Write(Timesheet t, Stream output)
    {
        using var wb = new XLWorkbook();
        WriteSummary(wb.AddWorksheet("Puantaj"), t);
        WriteDetail(wb.AddWorksheet("Detay"), t);
        WriteLegend(wb.AddWorksheet("Açıklamalar"), t);
        wb.SaveAs(output);
    }

    private static readonly (string Header, Func<TimesheetTotals, object> Value, string Format)[] TotalColumns =
    [
        ("Çalışılan gün", x => x.WorkedDays, "0"),
        ("Çalışılan saat", x => Math.Round(x.WorkedHours, 2), "0.00"),
        ("Planlanan saat", x => Math.Round(x.PlannedHours, 2), "0.00"),
        ("Fazla mesai (saat)", x => Math.Round(x.OvertimeHours, 2), "0.00"),
        ("Geç kalma (kez)", x => x.LateCount, "0"),
        ("Geç kalma (dk)", x => x.LateMinutes, "0"),
        ("Erken çıkma (kez)", x => x.EarlyLeaveCount, "0"),
        ("Devamsızlık (gün)", x => x.AbsentDays, "0"),
        ("Hafta tatili", x => x.WeeklyOffDays, "0"),
        ("Yıllık izin", x => x.AnnualLeaveDays, "0"),
        ("Rapor", x => x.SickLeaveDays, "0"),
        ("Mazeret izni", x => x.ExcusedLeaveDays, "0"),
        ("Mola aşımı (saat)", x => Math.Round(x.BreakOverrunHours, 2), "0.00"),
    ];

    private static void WriteSummary(IXLWorksheet ws, Timesheet t)
    {
        var monthName = new DateTime(t.Year, t.Month, 1).ToString("MMMM yyyy", Tr);
        var days = Enumerable.Range(0, t.To.DayNumber - t.From.DayNumber + 1).Select(i => t.From.AddDays(i)).ToList();
        const int firstDayCol = 4;
        var firstTotalCol = firstDayCol + days.Count;
        var lastCol = firstTotalCol + TotalColumns.Length - 1;

        ws.Cell(1, 1).Value = $"{t.CompanyName}{(t.BranchName is null ? "" : $" · {t.BranchName}")} — {monthName} Puantaj Cetveli";
        ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14).Font.SetFontColor(Brand);
        ws.Cell(2, 1).Value = $"Haftalık normal çalışma: {t.WeeklyWorkMinutes / 60.0:0.#} saat. Hücrelerde net çalışma saati (molalar düşülmüş) ya da gün kodu yer alır.";
        ws.Cell(2, 1).Style.Font.SetFontColor(XLColor.FromHtml("#52687C"));

        // Başlıklar (2 satır: gün numarası + gün adı)
        const int h1 = 4, h2 = 5;
        string[] fixedHeaders = ["Sicil no", "Ad soyad", "Pozisyon"];
        for (var i = 0; i < fixedHeaders.Length; i++)
        {
            ws.Range(h1, i + 1, h2, i + 1).Merge().Value = fixedHeaders[i];
        }
        for (var i = 0; i < days.Count; i++)
        {
            var d = days[i];
            ws.Cell(h1, firstDayCol + i).Value = d.Day;
            ws.Cell(h2, firstDayCol + i).Value = d.ToDateTime(TimeOnly.MinValue).ToString("ddd", Tr);
            if (IsWeekend(d)) ws.Range(h1, firstDayCol + i, h2, firstDayCol + i).Style.Fill.SetBackgroundColor(XLColor.FromHtml("#1F4466"));
        }
        for (var i = 0; i < TotalColumns.Length; i++)
            ws.Range(h1, firstTotalCol + i, h2, firstTotalCol + i).Merge().Value = TotalColumns[i].Header;

        var header = ws.Range(h1, 1, h2, lastCol);
        header.Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(Brand)
            .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center).Alignment.SetVertical(XLAlignmentVerticalValues.Center)
            .Alignment.SetWrapText();
        ws.Row(h1).Height = 22;
        ws.Row(h2).Height = 30;

        // Satırlar
        var r = h2 + 1;
        foreach (var row in t.Rows)
        {
            ws.Cell(r, 1).Value = row.EmployeeNumber ?? "";
            ws.Cell(r, 2).Value = row.Name;
            ws.Cell(r, 3).Value = row.Position ?? "";

            for (var i = 0; i < row.Cells.Count; i++)
            {
                var c = row.Cells[i];
                var cell = ws.Cell(r, firstDayCol + i);
                if (c.Code == TimesheetCode.Work)
                {
                    cell.Value = Math.Round(c.Hours, 1);
                    cell.Style.NumberFormat.Format = "0.0";
                    if (c.Late) cell.Style.Font.SetFontColor(XLColor.FromHtml("#C2410C")).Font.SetBold();
                    if (c.Unclosed || c.Unplanned) cell.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#FBF1DC"));
                }
                else
                {
                    cell.Value = TimesheetBuilder.ShortCode(c.Code);
                    if (CodeColors.TryGetValue(c.Code, out var color))
                        cell.Style.Fill.SetBackgroundColor(XLColor.FromHtml(color.Fill)).Font.SetFontColor(XLColor.FromHtml(color.Font)).Font.SetBold();
                    else if (IsWeekend(c.Date))
                        cell.Style.Fill.SetBackgroundColor(WeekendFill);
                }

                var notes = new List<string>();
                if (c.Late) notes.Add("Geç kaldı");
                if (c.EarlyLeave) notes.Add("Erken çıktı");
                if (c.BreakOverrun) notes.Add("Mola aşımı");
                if (c.Unclosed) notes.Add("Kapatılmamış oturum");
                if (c.Unplanned) notes.Add("Plan dışı çalışma");
                if (notes.Count > 0) cell.CreateComment().AddText(string.Join(", ", notes));
            }

            for (var i = 0; i < TotalColumns.Length; i++)
            {
                var cell = ws.Cell(r, firstTotalCol + i);
                cell.Value = XLCellValue.FromObject(TotalColumns[i].Value(row.Totals));
                cell.Style.NumberFormat.Format = TotalColumns[i].Format;
            }
            r++;
        }

        // Toplam satırı
        if (t.Rows.Count > 0)
        {
            ws.Cell(r, 2).Value = "Toplam";
            for (var i = 0; i < TotalColumns.Length; i++)
            {
                var col = firstTotalCol + i;
                var cell = ws.Cell(r, col);
                cell.FormulaA1 = $"SUM({ws.Cell(h2 + 1, col).Address}:{ws.Cell(r - 1, col).Address})";
                cell.Style.NumberFormat.Format = TotalColumns[i].Format;
            }
            ws.Range(r, 1, r, lastCol).Style.Font.SetBold().Fill.SetBackgroundColor(WeekendFill);
        }

        var table = ws.Range(h1, 1, Math.Max(r, h2), lastCol);
        table.Style.Border.SetInsideBorder(XLBorderStyleValues.Thin).Border.SetInsideBorderColor(Line)
            .Border.SetOutsideBorder(XLBorderStyleValues.Thin).Border.SetOutsideBorderColor(Line);
        ws.Range(h2 + 1, firstDayCol, Math.Max(r, h2 + 1), lastCol).Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);

        ws.Column(1).Width = 10;
        ws.Column(2).Width = 22;
        ws.Column(3).Width = 16;
        for (var i = 0; i < days.Count; i++) ws.Column(firstDayCol + i).Width = 5.2;
        for (var i = 0; i < TotalColumns.Length; i++) ws.Column(firstTotalCol + i).Width = 11;

        ws.SheetView.FreezeRows(h2);
        ws.SheetView.FreezeColumns(2);

        ws.PageSetup.PageOrientation = XLPageOrientation.Landscape;
        ws.PageSetup.PaperSize = XLPaperSize.A4Paper;
        ws.PageSetup.FitToPages(1, 0);
        ws.PageSetup.Margins.SetLeft(0.3).SetRight(0.3).SetTop(0.4).SetBottom(0.4);
        ws.PageSetup.SetRowsToRepeatAtTop(h1, h2);
    }

    private static void WriteDetail(IXLWorksheet ws, Timesheet t)
    {
        string[] headers =
        [
            "Sicil no", "Ad soyad", "Tarih", "Gün", "Durum", "Plan", "Giriş", "Çıkış",
            "Çalışma (saat)", "Mola (dk)", "Mola hakkı (dk)", "Mola aşımı (dk)", "Geç kalma (dk)", "Erken çıkma (dk)", "Not"
        ];
        for (var i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
        ws.Range(1, 1, 1, headers.Length).Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(Brand);

        var r = 2;
        foreach (var row in t.Rows)
        {
            for (var i = 0; i < row.Days.Count; i++)
            {
                var d = row.Days[i];
                var c = row.Cells[i];
                ws.Cell(r, 1).Value = row.EmployeeNumber ?? "";
                ws.Cell(r, 2).Value = row.Name;
                ws.Cell(r, 3).Value = d.Date.ToDateTime(TimeOnly.MinValue);
                ws.Cell(r, 3).Style.DateFormat.Format = "dd.MM.yyyy";
                ws.Cell(r, 4).Value = d.Date.ToDateTime(TimeOnly.MinValue).ToString("dddd", Tr);
                ws.Cell(r, 5).Value = StatusText(c.Code);
                ws.Cell(r, 6).Value = PlanText(d.Plan);
                ws.Cell(r, 7).Value = Local(d.FirstIn, t.TimeZone);
                ws.Cell(r, 8).Value = Local(d.LastOut, t.TimeZone);
                ws.Cell(r, 9).Value = Math.Round(d.Worked.TotalHours, 2);
                ws.Cell(r, 9).Style.NumberFormat.Format = "0.00";
                ws.Cell(r, 10).Value = Math.Round(d.Break.TotalMinutes);
                ws.Cell(r, 11).Value = Math.Round(d.BreakAllowance.TotalMinutes);
                ws.Cell(r, 12).Value = Math.Round(d.BreakOverrun.TotalMinutes);
                ws.Cell(r, 13).Value = d.LateMinutes;
                ws.Cell(r, 14).Value = d.EarlyLeaveMinutes;
                ws.Cell(r, 15).Value = string.Join(", ", new[]
                {
                    d.HasUnclosedSession ? "Kapatılmamış oturum" : null,
                    c.Unplanned ? "Plan dışı çalışma" : null
                }.Where(x => x is not null));
                r++;
            }
        }

        ws.Columns(1, headers.Length).AdjustToContents(1, Math.Min(r, 300));
        ws.SheetView.FreezeRows(1);
        if (r > 2) ws.Range(1, 1, r - 1, headers.Length).SetAutoFilter();
    }

    private static void WriteLegend(IXLWorksheet ws, Timesheet t)
    {
        (string Code, string Text, TimesheetCode? Color)[] rows =
        [
            ("8.0", "Çalışılan net saat (molalar düşülmüş). Kırmızı: geç kalınan gün. Sarı zemin: kapatılmamış oturum ya da plan dışı çalışma.", null),
            ("HT", "Hafta tatili", TimesheetCode.WeeklyOff),
            ("Yİ", "Yıllık izin", TimesheetCode.AnnualLeave),
            ("R", "Rapor (hastalık izni)", TimesheetCode.SickLeave),
            ("Mİ", "Mazeret izni", TimesheetCode.ExcusedLeave),
            ("D", "Devamsız: vardiyası vardı, gelmedi", TimesheetCode.Absent),
            ("–", "Planı yok, çalışmadı", null),
            ("(boş)", "Henüz gerçekleşmemiş gün", null),
        ];
        ws.Cell(1, 1).Value = "Kod";
        ws.Cell(1, 2).Value = "Anlamı";
        ws.Range(1, 1, 1, 2).Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(Brand);
        for (var i = 0; i < rows.Length; i++)
        {
            ws.Cell(i + 2, 1).Value = rows[i].Code;
            ws.Cell(i + 2, 2).Value = rows[i].Text;
            if (rows[i].Color is { } code && CodeColors.TryGetValue(code, out var color))
                ws.Cell(i + 2, 1).Style.Fill.SetBackgroundColor(XLColor.FromHtml(color.Fill)).Font.SetFontColor(XLColor.FromHtml(color.Font)).Font.SetBold();
        }

        var n = rows.Length + 3;
        ws.Cell(n, 1).Value = "Fazla mesai";
        ws.Cell(n, 2).Value = $"Haftalık net çalışmanın {t.WeeklyWorkMinutes / 60.0:0.#} saati aşan kısmı. Ay sınırındaki haftalarda haftanın fazla mesaisi, haftanın son gününün düştüğü aya yazılır.";
        ws.Cell(n + 1, 1).Value = "Geç kalma";
        ws.Cell(n + 1, 2).Value = "Vardiya başlangıcından tolerans süresinden fazla sonra giriş; dakika vardiya başlangıcından itibaren sayılır.";
        ws.Cell(n + 2, 1).Value = "Oluşturulma";
        ws.Cell(n + 2, 2).Value = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, t.TimeZone).ToString("dd.MM.yyyy HH:mm", Tr);
        ws.Range(n, 1, n + 2, 1).Style.Font.SetBold();
        ws.Column(1).Width = 14;
        ws.Column(2).Width = 110;
        ws.Column(2).Style.Alignment.SetWrapText();
    }

    private static bool IsWeekend(DateOnly d) => d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

    private static string Local(DateTimeOffset? at, TimeZoneInfo tz) =>
        at is { } a ? TimeZoneInfo.ConvertTime(a, tz).ToString("HH:mm", Tr) : "";

    private static string PlanText(DayPlan? p) => p switch
    {
        null => "",
        { Kind: ShiftKind.Work } => $"{p.Start:HH\\:mm}–{p.End:HH\\:mm}{(p.Name is null ? "" : $" ({p.Name})")}",
        _ => StatusText(p.Kind switch
        {
            ShiftKind.WeeklyOff => TimesheetCode.WeeklyOff,
            ShiftKind.AnnualLeave => TimesheetCode.AnnualLeave,
            ShiftKind.SickLeave => TimesheetCode.SickLeave,
            _ => TimesheetCode.ExcusedLeave
        })
    };

    private static string StatusText(TimesheetCode c) => c switch
    {
        TimesheetCode.Work => "Çalıştı",
        TimesheetCode.Planned => "Planlı",
        TimesheetCode.WeeklyOff => "Hafta tatili",
        TimesheetCode.AnnualLeave => "Yıllık izin",
        TimesheetCode.SickLeave => "Rapor",
        TimesheetCode.ExcusedLeave => "Mazeret izni",
        TimesheetCode.Absent => "Devamsız",
        TimesheetCode.Off => "Plan yok",
        _ => ""
    };
}
