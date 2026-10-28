import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { pathFor } from '../../auth/types'
import { PageHeader } from '../../components/AppShell'
import { IconButton } from '../../components/ui/Button'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { locale } from '../../i18n'
import { api, errorMessage } from '../../lib/api'
import { formatDay, parseDate, todayIso } from '../../lib/dates'
import type { LeaveBalance } from '../leave/api'
import type { TimesheetCell, TimesheetTotals } from '../timesheet/api'
import { codeStyle } from '../timesheet/codes'

interface MyMonth {
  year: number
  month: number
  weeklyWorkMinutes: number
  row: { cells: TimesheetCell[]; totals: TimesheetTotals }
  leave: LeaveBalance
}

const hours = (h: number) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(h)

/** Benim ayım: kendi aylık puantajım (yöneticinin gördüğüyle aynı hesap), bordro öncesi kontrol için. */
export function MyMonthPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const now = parseDate(todayIso())
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const q = useQuery({
    queryKey: ['me', 'month', ym.y, ym.m],
    queryFn: () => api<MyMonth>(`/me/month?year=${ym.y}&month=${ym.m}`),
    placeholderData: keepPreviousData,
  })
  const shift = (d: number) => setYm(({ y, m }) => (m + d < 1 ? { y: y - 1, m: 12 } : m + d > 12 ? { y: y + 1, m: 1 } : { y, m: m + d }))
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth() + 1
  const label = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(ym.y, ym.m - 1, 1))

  return (
    <>
      <PageHeader
        title={t('month.title')}
        subtitle={<span className="first-letter:uppercase">{label}</span>}
        actions={
          <div className="flex items-center gap-1">
            <IconButton label={t('timesheet.prevMonth')} onClick={() => shift(-1)}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <IconButton label={t('timesheet.nextMonth')} onClick={() => shift(1)} disabled={isCurrent}>
              <ChevronRight className="size-5" />
            </IconButton>
          </div>
        }
      />

      {q.isPending ? (
        <PageSkeleton variant="cards" />
      ) : q.isError ? (
        <p className="py-12 text-center text-ink-soft">{errorMessage(q.error, t)}</p>
      ) : (
        <div className={`space-y-4 ${q.isPlaceholderData ? 'opacity-60' : ''}`}>
          <Totals totals={q.data.row.totals} />
          <Calendar cells={q.data.row.cells} />
          <p className="flex items-start gap-2 text-sm text-ink-soft">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              {t('month.hint')}{' '}
              {user && (
                <Link to={pathFor(user.role, 'taleplerim')} className="font-medium text-ink underline underline-offset-4">
                  {t('month.requestLink')}
                </Link>
              )}
            </span>
          </p>
        </div>
      )}
    </>
  )
}

function Tile({ label, value, sub, tone = '' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl bg-panel p-4 ring-1 ring-line">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className={`tabular mt-2 text-2xl font-semibold tracking-tight ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
    </div>
  )
}

function Totals({ totals: x }: { totals: TimesheetTotals }) {
  const { t } = useTranslation()
  const leaveDays = x.annualLeaveDays + x.sickLeaveDays + x.excusedLeaveDays
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile label={t('month.worked')} value={t('month.hours', { value: hours(x.workedHours) })} sub={t('month.days', { count: x.workedDays })} />
      <Tile label={t('month.overtime')} value={t('month.hours', { value: hours(x.overtimeHours) })} tone={x.overtimeHours > 0 ? 'text-pause' : ''} sub={t('month.overtimeHint')} />
      <Tile
        label={t('month.late')}
        value={x.lateCount}
        tone={x.lateCount > 0 ? 'text-overrun' : ''}
        sub={x.lateCount > 0 ? t('month.lateMinutes', { count: x.lateMinutes }) : t('month.none')}
      />
      <Tile label={t('month.absent')} value={x.absentDays} tone={x.absentDays > 0 ? 'text-overrun' : ''} sub={x.earlyLeaveCount > 0 ? t('month.early', { count: x.earlyLeaveCount }) : undefined} />
      <Tile label={t('month.leave')} value={leaveDays} sub={t('timesheet.leaveBreakdown', { ht: x.weeklyOffDays, yi: x.annualLeaveDays, r: x.sickLeaveDays, mi: x.excusedLeaveDays })} />
      <Tile label={t('month.holidays')} value={x.publicHolidayDays} sub={x.holidayWorkHours > 0 ? t('month.holidayWork', { value: hours(x.holidayWorkHours) }) : undefined} />
      <Tile label={t('month.breakOverrun')} value={t('month.hours', { value: hours(x.breakOverrunHours) })} tone={x.breakOverrunHours > 0 ? 'text-pause' : ''} />
      <Tile label={t('month.unclosed')} value={x.unclosedCount} tone={x.unclosedCount > 0 ? 'text-pause' : ''} />
    </div>
  )
}

/** Ay takvimi: her günde çalışılan saat ya da gün kodu. */
function Calendar({ cells }: { cells: TimesheetCell[] }) {
  const { t } = useTranslation()
  const lead = (parseDate(cells[0]!.date).getDay() + 6) % 7
  const labels = t('attendance.days.short').split(' ')
  const today = todayIso()

  return (
    <section className="rounded-2xl bg-panel p-3 ring-1 ring-line sm:p-4">
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-ink-soft">
        {labels.map((l) => (
          <span key={l} className="pb-1">
            {l}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {cells.map((c) => {
          const style = codeStyle[c.code]
          const tips = [c.late && t('month.lateDay'), c.earlyLeave && t('timesheet.tips.early'), c.unclosed && t('timesheet.tips.unclosed')].filter(Boolean)
          return (
            <div
              key={c.date}
              title={[formatDay(c.date, { weekday: 'long', day: 'numeric', month: 'long' }), ...tips].join(' · ')}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm ring-1 sm:aspect-auto sm:h-16 ${c.date === today ? 'ring-signal' : 'ring-line'} ${c.code === 'Work' ? (c.unclosed ? 'bg-pause-soft' : 'bg-signal-soft/50') : style ?? 'bg-panel-2/40'}`}
            >
              <span className="text-[11px] text-ink-soft">{parseDate(c.date).getDate()}</span>
              <span className={`tabular font-semibold ${c.late ? 'text-overrun' : ''}`}>
                {c.code === 'Work' ? hours(c.hours) : c.code === 'None' ? '' : t(`timesheet.short.${c.code as 'Off'}`)}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
