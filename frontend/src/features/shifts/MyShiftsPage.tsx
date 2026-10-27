import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/AppShell'
import { Spinner } from '../../components/ui/Spinner'
import { useNow } from '../../hooks/useNow'
import { api } from '../../lib/api'
import { addDays, formatDay, hhmm, parseDate, todayIso, weekDays, weekStartOf, type WeekDayName } from '../../lib/dates'
import { formatDuration } from '../../lib/format'
import { useMyShifts, type Shift } from './api'
import { ShiftChip } from './ShiftChip'

/** Personelin bu hafta ve gelecek haftaki vardiyaları. */
export function MyShiftsPage() {
  const { t } = useTranslation()
  const rules = useQuery({
    queryKey: ['work-rules'],
    queryFn: () => api<{ weekStartsOn: WeekDayName }>('/settings/work-rules'),
  })
  const today = todayIso()
  const start = weekStartOf(today, rules.data?.weekStartsOn ?? 'Monday')
  const end = addDays(start, 13)
  const shifts = useMyShifts(start, end)
  const now = useNow(30_000)

  const byDate = new Map((shifts.data ?? []).map((s) => [s.date, s]))
  const next = (shifts.data ?? []).find((s) => startOf(s) > now)

  return (
    <>
      <PageHeader title={t('shifts.myTitle')} subtitle={t('shifts.mySubtitle')} />

      {shifts.isPending || rules.isPending ? (
        <div className="grid place-items-center py-24 text-ink-soft">
          <Spinner />
        </div>
      ) : (
        <>
          <NextShiftCard shift={next} now={now} />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {[start, addDays(start, 7)].map((ws, wi) => (
              <section key={ws} className="rounded-2xl bg-panel p-2 ring-1 ring-line">
                <h2 className="px-3 pt-3 pb-2 text-sm font-medium text-ink-soft">
                  {wi === 0 ? t('shifts.thisWeek') : t('shifts.nextWeek')}
                </h2>
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
                        <div className="h-12 flex-1">
                          {s ? (
                            <ShiftChip start={s.startTime} end={s.endTime} name={s.templateName ?? s.note} color={s.color} />
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
            ))}
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

function NextShiftCard({ shift, now }: { shift: Shift | undefined; now: Date }) {
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
    </motion.section>
  )
}
