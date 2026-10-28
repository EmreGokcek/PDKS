import { ChevronLeft, ChevronRight, FileSpreadsheet, Printer } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PageHeader } from '../../components/AppShell'
import { Button, IconButton } from '../../components/ui/Button'
import { locale } from '../../i18n'
import { download, errorMessage } from '../../lib/api'
import { formatDay, parseDate, todayIso } from '../../lib/dates'
import { useTimesheet, type Timesheet, type TimesheetCell, type TimesheetCode, type TimesheetTotals } from './api'
import { PageSkeleton } from '../../components/ui/Skeleton'

/** Gün kodlarının renkleri (Excel çıktısıyla aynı). */
const codeStyle: Partial<Record<TimesheetCode, string>> = {
  WeeklyOff: 'bg-[#eceff3] text-[#52687c] dark:bg-[#22364a] dark:text-[#a9bccd]',
  AnnualLeave: 'bg-[#d9f4f7] text-[#0b7f8c] dark:bg-[#0e3940] dark:text-[#6fd3df]',
  SickLeave: 'bg-[#fbe3e7] text-[#b0304a] dark:bg-[#43202a] dark:text-[#f19aab]',
  ExcusedLeave: 'bg-[#fbf1dc] text-[#8a5e10] dark:bg-[#3d321a] dark:text-[#e7c27a]',
  Absent: 'bg-overrun-soft text-overrun',
  PublicHoliday: 'bg-[#ede7f6] text-[#5b3c99] dark:bg-[#2e2445] dark:text-[#c3b0f0]',
}

const legendCodes: Exclude<TimesheetCode, 'None'>[] = ['Work', 'WeeklyOff', 'AnnualLeave', 'SickLeave', 'ExcusedLeave', 'PublicHoliday', 'Absent', 'Off', 'Planned']

type TotalKey = 'workedDays' | 'workedHours' | 'plannedHours' | 'overtimeHours' | 'holidayWork' | 'late' | 'early' | 'absent' | 'leave' | 'overrun'

const totalCols: { key: TotalKey; value: (x: TimesheetTotals) => number; hours?: boolean; tone?: string }[] = [
  { key: 'workedDays', value: (x) => x.workedDays },
  { key: 'workedHours', value: (x) => x.workedHours, hours: true },
  { key: 'plannedHours', value: (x) => x.plannedHours, hours: true },
  { key: 'overtimeHours', value: (x) => x.overtimeHours, hours: true, tone: 'text-pause' },
  { key: 'holidayWork', value: (x) => x.holidayWorkHours, hours: true, tone: 'text-[#5b3c99] dark:text-[#c3b0f0]' },
  { key: 'late', value: (x) => x.lateCount, tone: 'text-overrun' },
  { key: 'early', value: (x) => x.earlyLeaveCount, tone: 'text-pause' },
  { key: 'absent', value: (x) => x.absentDays, tone: 'text-overrun' },
  { key: 'leave', value: (x) => x.annualLeaveDays + x.sickLeaveDays + x.excusedLeaveDays },
  { key: 'overrun', value: (x) => x.breakOverrunHours, hours: true, tone: 'text-pause' },
]

const hoursFmt = () => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 })

/** Aylık puantaj cetveli: kişi × gün, aylık toplamlar, Excel ve yazdırma (PDF). */
export function TimesheetPage() {
  const { t } = useTranslation()
  const now = parseDate(todayIso())
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const sheet = useTimesheet(ym.y, ym.m)
  const [downloading, setDownloading] = useState(false)

  const shift = (delta: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m - 1 + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() + 1 }
    })
  const isThisMonth = ym.y === now.getFullYear() && ym.m === now.getMonth() + 1
  const monthLabel = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(ym.y, ym.m - 1, 1))

  async function exportExcel() {
    setDownloading(true)
    try {
      await download(`/reports/monthly/export?year=${ym.y}&month=${ym.m}`, `puantaj-${ym.y}-${String(ym.m).padStart(2, '0')}.xlsx`)
      toast.success(t('timesheet.downloaded'))
    } catch (err) {
      toast.error(errorMessage(err, t))
    } finally {
      setDownloading(false)
    }
  }

  const data = sheet.data

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={t('timesheet.title')}
          subtitle={<span className="first-letter:uppercase">{data ? t('timesheet.subtitle', { month: monthLabel, count: data.rows.length }) : monthLabel}</span>}
          actions={
            <>
              <div className="flex items-center rounded-xl ring-1 ring-line">
                <IconButton label={t('timesheet.prevMonth')} onClick={() => shift(-1)}>
                  <ChevronLeft className="size-5" />
                </IconButton>
                <button
                  type="button"
                  onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() + 1 })}
                  className={`px-2 text-sm font-medium ${isThisMonth ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
                >
                  {t('timesheet.thisMonth')}
                </button>
                <IconButton label={t('timesheet.nextMonth')} onClick={() => shift(1)} disabled={isThisMonth}>
                  <ChevronRight className="size-5" />
                </IconButton>
              </div>
              <Button variant="secondary" onClick={() => window.print()} disabled={!data || data.rows.length === 0}>
                <Printer className="size-4" />
                <span className="hidden sm:inline">{t('timesheet.print')}</span>
              </Button>
              <Button onClick={exportExcel} loading={downloading} disabled={!data || data.rows.length === 0}>
                <FileSpreadsheet className="size-4" />
                <span className="hidden sm:inline">{downloading ? t('timesheet.downloading') : t('timesheet.excel')}</span>
              </Button>
            </>
          }
        />
      </div>

      {sheet.isPending || !data ? (
        <PageSkeleton variant="table" />
      ) : data.rows.length === 0 ? (
        <p className="rounded-2xl bg-panel p-8 text-center text-ink-soft ring-1 ring-line">{t('timesheet.empty')}</p>
      ) : (
        <>
          <PrintHeader sheet={data} monthLabel={monthLabel} />
          <Legend />
          <motion.section
            key={`${ym.y}-${ym.m}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`overflow-x-auto rounded-2xl bg-panel ring-1 ring-line transition-opacity print:overflow-visible print:rounded-none print:ring-0 ${sheet.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            <SheetTable sheet={data} />
          </motion.section>
          <p className="mt-3 text-xs text-ink-soft print:mt-1 print:text-[7px]">{t('timesheet.overtimeRule')}</p>
          <PrintFooter />
        </>
      )}
    </>
  )
}

function SheetTable({ sheet }: { sheet: Timesheet }) {
  const { t } = useTranslation()
  const days = sheet.rows[0]!.cells.map((c) => c.date)
  const today = todayIso()
  const fmt = hoursFmt()
  const sum = (pick: (x: TimesheetTotals) => number) => sheet.rows.reduce((s, r) => s + pick(r.totals), 0)

  return (
    <table className="timesheet w-full min-w-[1600px] table-fixed border-collapse text-[13px] print:min-w-0 print:text-[7.5px]">
      <colgroup>
        <col style={{ width: '12%' }} />
        {days.map((d) => (
          <col key={d} style={{ width: `${62 / days.length}%` }} />
        ))}
        {totalCols.map((c) => (
          <col key={c.key} style={{ width: `${26 / totalCols.length}%` }} />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-line text-ink-soft">
          <th className="sticky left-0 z-[1] bg-panel px-3 py-2 text-left font-normal print:static print:px-1">{t('timesheet.person')}</th>
          {days.map((d) => {
            const dow = parseDate(d).getDay()
            const weekend = dow === 0 || dow === 6
            return (
              <th key={d} className={`border-l border-line py-1.5 text-center font-normal ${weekend ? 'bg-panel-2' : ''} ${d === today ? 'text-signal' : ''}`}>
                <span className="block text-[10px] leading-none print:text-[6px]">{formatDay(d, { weekday: 'narrow' })}</span>
                <span className="tabular block font-semibold leading-tight">{parseDate(d).getDate()}</span>
              </th>
            )
          })}
          {totalCols.map((c, i) => (
            <th
              key={c.key}
              className={`bg-panel-2 px-1 py-1.5 text-center text-[11px] leading-tight font-medium text-ink print:text-[6.5px] ${i === 0 ? 'border-l-2 border-line' : 'border-l border-line'}`}
            >
              {t(`timesheet.cols.${c.key}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sheet.rows.map((r) => (
          <tr key={r.userId} className="border-b border-line last:border-0 print:break-inside-avoid">
            <th scope="row" className="sticky left-0 z-[1] bg-panel px-3 py-2 text-left font-normal print:static print:px-1 print:py-0.5">
              <span className="block truncate font-medium text-ink">{r.name}</span>
              <span className="block truncate text-xs text-ink-soft print:text-[6px]">{[r.employeeNumber, r.position].filter(Boolean).join(' · ')}</span>
            </th>
            {r.cells.map((c) => (
              <DayCell key={c.date} cell={c} lateMinutes={r.totals.lateMinutes} />
            ))}
            {totalCols.map((col, i) => {
              const v = col.value(r.totals)
              return (
                <td
                  key={col.key}
                  title={col.key === 'leave' ? t('timesheet.leaveBreakdown', { ht: r.totals.weeklyOffDays, yi: r.totals.annualLeaveDays, r: r.totals.sickLeaveDays, mi: r.totals.excusedLeaveDays }) : undefined}
                  className={`tabular bg-panel-2/50 px-1 text-center ${i === 0 ? 'border-l-2 border-line' : 'border-l border-line'} ${v > 0 ? `font-semibold ${col.tone ?? 'text-ink'}` : 'text-ink-soft/50'}`}
                >
                  {v > 0 ? (col.hours ? fmt.format(v) : v) : '–'}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-line font-semibold">
          <th scope="row" className="sticky left-0 z-[1] bg-panel-2 px-3 py-2 text-left print:static print:px-1">
            {t('timesheet.total')}
          </th>
          <td colSpan={days.length} className="bg-panel-2" />
          {totalCols.map((col, i) => (
            <td key={col.key} className={`tabular bg-panel-2 px-1 text-center ${i === 0 ? 'border-l-2 border-line' : 'border-l border-line'}`}>
              {col.hours ? fmt.format(sum(col.value)) : sum(col.value)}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  )
}

function DayCell({ cell: c, lateMinutes }: { cell: TimesheetCell; lateMinutes: number }) {
  const { t } = useTranslation()
  const dow = parseDate(c.date).getDay()
  const weekend = dow === 0 || dow === 6
  const flagged = c.unclosed || c.unplanned

  const tips = [
    c.late && t('timesheet.tips.late', { minutes: lateMinutes }),
    c.earlyLeave && t('timesheet.tips.early'),
    c.breakOverrun && t('timesheet.tips.overrun'),
    c.unclosed && t('timesheet.tips.unclosed'),
    c.unplanned && t('timesheet.tips.unplanned'),
  ].filter(Boolean)
  const title = [formatDay(c.date, { weekday: 'long', day: 'numeric', month: 'long' }), t(`timesheet.codes.${c.code === 'None' ? 'Planned' : c.code}` as 'timesheet.codes.Work'), ...tips].join(' · ')

  let content: React.ReactNode = ''
  let cls = weekend ? 'bg-panel-2/70' : ''
  if (c.code === 'Work') {
    content = hoursFmt().format(c.hours)
    cls = `${flagged ? 'bg-pause-soft' : cls} ${c.late ? 'font-semibold text-overrun' : 'text-ink'}`
  } else if (c.code === 'Planned') {
    content = <span className="mx-auto block size-1 rounded-full bg-ink-soft/40" />
  } else if (c.code in codeStyle || c.code === 'Off') {
    content = t(`timesheet.short.${c.code as 'Off'}`)
    cls = codeStyle[c.code] ? `${codeStyle[c.code]} font-semibold` : `${cls} text-ink-soft/60`
  }

  return (
    <td title={title} className={`tabular h-11 border-l border-line px-0 text-center print:h-auto print:py-1 ${cls}`}>
      {content}
    </td>
  )
}

function Legend() {
  const { t } = useTranslation()
  return (
    <ul className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft print:mb-2 print:text-[7px]">
      {legendCodes.map((code) => (
        <li key={code} className="flex items-center gap-1.5">
          <span
            className={`grid h-5 min-w-7 place-items-center rounded px-1 text-[11px] font-semibold print:h-3 print:min-w-4 print:text-[6px] ${
              code === 'Work' ? 'bg-panel text-ink ring-1 ring-line' : code === 'Planned' || code === 'Off' ? 'bg-panel ring-1 ring-line' : codeStyle[code]
            }`}
          >
            {code === 'Work' ? '8' : code === 'Planned' ? <span className="size-1 rounded-full bg-ink-soft/40" /> : t(`timesheet.short.${code as 'Off'}`)}
          </span>
          {t(`timesheet.codes.${code}`)}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="font-semibold text-overrun">8</span>
        {t('timesheet.lateMark')}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-5 rounded bg-pause-soft ring-1 ring-pause/20" />
        {t('timesheet.flagMark')}
      </li>
    </ul>
  )
}

/** Yalnızca baskıda görünen başlık. */
function PrintHeader({ sheet, monthLabel }: { sheet: Timesheet; monthLabel: string }) {
  const { t } = useTranslation()
  const [printed] = useState(() => new Intl.DateTimeFormat(locale(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date()))
  return (
    <header className="mb-2 hidden items-end justify-between border-b-2 border-ink pb-1 print:flex">
      <div>
        <h1 className="text-[13px] font-semibold first-letter:uppercase">
          {t('timesheet.printTitle', { company: sheet.companyName + (sheet.branchName ? ` · ${sheet.branchName}` : ''), month: monthLabel })}
        </h1>
      </div>
      <p className="text-[7px] text-ink-soft">{t('timesheet.printedAt', { date: printed })}</p>
    </header>
  )
}

/** Yalnızca baskıda görünen imza alanları. */
function PrintFooter() {
  const { t } = useTranslation()
  return (
    <div className="mt-6 hidden grid-cols-2 gap-16 text-[8px] print:grid">
      {(['prepared', 'approved'] as const).map((k) => (
        <div key={k}>
          <p className="font-semibold">{t(`timesheet.signatures.${k}`)}</p>
          <div className="mt-8 border-t border-ink" />
        </div>
      ))}
    </div>
  )
}
