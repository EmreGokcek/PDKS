import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/AppShell'
import { Spinner } from '../../components/ui/Spinner'
import { useNow } from '../../hooks/useNow'
import { api } from '../../lib/api'
import { addDays, formatDay, hhmm, parseDate, shiftMinutes, todayIso, weekDays, weekStartOf, type WeekDayName } from '../../lib/dates'
import { formatDuration, formatMinutes } from '../../lib/format'
import { useMyShifts, type Shift } from './api'
import { isLeave, leaveColors, netWorkMinutes } from './leave'
import { LeaveChip, ShiftChip } from './ShiftChip'

/** Personelin bu hafta ve gelecek haftaki vardiyaları. */
export function MyShiftsPage() {
  const { t } = useTranslation()
  const rules = useQuery({
    queryKey: ['work-rules'],
    queryFn: () => api<{ weekStartsOn: WeekDayName; dailyBreakMinutes: number }>('/settings/work-rules'),
  })
  const today = todayIso()
  const start = weekStartOf(today, rules.data?.weekStartsOn ?? 'Monday')
  const end = addDays(start, 13)
  const shifts = useMyShifts(start, end)
  const now = useNow(30_000)

  const byDate = new Map((shifts.data ?? []).map((s) => [s.date, s]))
  const next = (shifts.data ?? []).find((s) => !isLeave(s.kind) && startOf(s) > now)
  const dailyBreak = rules.data?.dailyBreakMinutes ?? 60
  const breakFor = (s: Shift) => s.breakMinutes ?? dailyBreak
  const workOf = (s: Shift) => netWorkMinutes(shiftMinutes(s.startTime, s.endTime), breakFor(s))
  const breakOf = (s: Shift) => (shiftMinutes(s.startTime, s.endTime) > breakFor(s) ? breakFor(s) : 0)

  return (
    <>
      <PageHeader title={t('shifts.myTitle')} subtitle={t('shifts.mySubtitle')} />

      {shifts.isPending || rules.isPending ? (
        <div className="grid place-items-center py-24 text-ink-soft">
          <Spinner />
        </div>
      ) : (
        <>
          <NextShiftCard shift={next} now={now} work={next ? workOf(next) : 0} brk={next ? breakOf(next) : 0} />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {[start, addDays(start, 7)].map((ws, wi) => {
              const weekShifts = weekDays(ws).map((d) => byDate.get(d)).filter((s): s is Shift => !!s && !isLeave(s.kind))
              const unpublished = weekDays(ws).every((d) => !byDate.has(d))
              const weekWork = weekShifts.reduce((sum, s) => sum + workOf(s), 0)
              return (
              <section key={ws} className="rounded-2xl bg-panel p-2 ring-1 ring-line">
                <div className="flex items-baseline justify-between gap-3 px-3 pt-3 pb-2">
                  <h2 className="text-sm font-medium text-ink-soft">{wi === 0 ? t('shifts.thisWeek') : t('shifts.nextWeek')}</h2>
                  {weekShifts.length > 0 && (
                    <p className="tabular text-sm text-ink-soft">
                      {t('shifts.weekSummary', { days: weekShifts.length, work: formatDuration(weekWork) })}
                    </p>
                  )}
                </div>
                {unpublished && <p className="mx-3 mb-2 rounded-xl bg-panel-2 px-3 py-2 text-sm text-ink-soft ring-1 ring-line">{t('shifts.notPublished')}</p>}
                <ul>
                  {weekDays(ws).map((d, i) => {
                    const s = byDate.get(d)
                    const isToday = d === today
                    const past = d < today
                    return (
                      <motion.li
                        key={d}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: wi * 0.1 + i * 0.03 }}
                        className={`flex items-center gap-4 rounded-xl px-3 py-2.5 ${isToday ? 'bg-signal-soft/60' : ''} ${past ? 'opacity-55' : ''}`}
                      >
                        <div className="w-14 shrink-0">
                          <p className={`text-xs first-letter:uppercase ${isToday ? 'font-semibold text-signal' : 'text-ink-soft'}`}>
                            {isToday ? t('shifts.today') : formatDay(d, { weekday: 'short' })}
                          </p>
                          <p className="tabular text-lg font-semibold">{formatDay(d, { day: 'numeric' })}</p>
                        </div>
                        <div className="flex min-h-12 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                          {s && isLeave(s.kind) ? (
                            <div className="h-12 w-full">
                              <LeaveChip label={t(`shifts.kinds.${s.kind}`)} color={leaveColors[s.kind]} />
                            </div>
                          ) : s ? (
                            <>
                              <div className="h-12 w-full sm:max-w-56">
                                <ShiftChip start={s.startTime} end={s.endTime} name={s.templateName ?? s.note} color={s.color} />
                              </div>
                              <p className="tabular text-xs text-ink-soft sm:text-sm">
                                {t('shifts.workAndBreak', { work: formatDuration(workOf(s)), break: formatMinutes(breakOf(s)) })}
                              </p>
                            </>
                          ) : (
                            <span className="flex h-full items-center rounded-lg border border-dashed border-line px-3 text-sm text-ink-soft">
                              {t('shifts.off')}
                            </span>
                          )}
                        </div>
                      </motion.li>
                    )
                  })}
                </ul>
              </section>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function startOf(s: Shift) {
  const d = parseDate(s.date)
  const [h, m] = s.startTime.split(':').map(Number)
  d.setHours(h!, m!)
  return d
}

function NextShiftCard({ shift, now, work, brk }: { shift: Shift | undefined; now: Date; work: number; brk: number }) {
  const { t } = useTranslation()
  if (!shift) {
    return (
      <section className="flex items-center gap-4 rounded-3xl bg-panel p-6 ring-1 ring-line">
        <CalendarClock className="size-6 text-ink-soft" />
        <p className="text-ink-soft">{t('shifts.noUpcoming')}</p>
      </section>
    )
  }
  const minutes = Math.max(0, Math.round((startOf(shift).getTime() - now.getTime()) / 60000))
  const today = todayIso()
  const dayLabel =
    shift.date === today ? t('shifts.today') : shift.date === addDays(today, 1) ? t('shifts.tomorrow') : formatDay(shift.date, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl bg-brand p-6 text-on-brand sm:p-8 dark:ring-1 dark:ring-line"
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: shift.color }} />
      <p className="text-on-brand/70">{t('shifts.nextShift')}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight first-letter:uppercase sm:text-4xl">
        {dayLabel}, <span className="tabular">{hhmm(shift.startTime)}–{hhmm(shift.endTime)}</span>
      </p>
      <p className="mt-2 text-on-brand/70">
        {shift.templateName && <>{shift.templateName} · </>}
        {t('shifts.in', { time: formatDuration(minutes) })}
      </p>
      <p className="mt-1 text-on-brand/70">{t('shifts.workAndBreak', { work: formatDuration(work), break: formatMinutes(brk) })}</p>
    </motion.section>
  )
}
