import { pathFor } from '../../auth/types'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ChevronRight, Coffee, LogIn, LogOut, Play, TrendingUp, Watch } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { PageHeader } from '../../components/AppShell'
import { Button } from '../../components/ui/Button'
import { useNow } from '../../hooks/useNow'
import { addDays, formatDay, hhmm } from '../../lib/dates'
import { locale } from '../../i18n'
import { errorMessage } from '../../lib/api'
import { formatClock, formatDuration, formatMinutes, formatSeconds, formatTime } from '../../lib/format'
import { availableActions, useAttendance, useScan, type AttendanceAction, type AttendanceState, type AttendanceStatus } from './api'
import { QrScannerSheet } from './QrScannerSheet'
import { SuccessOverlay } from './SuccessOverlay'
import { useLiveStatus } from './useLiveStatus'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { FeedPanel } from '../announcements/FeedPanel'

export const actionIcons: Record<AttendanceAction, ReactNode> = {
  CheckIn: <LogIn className="size-5" />,
  BreakStart: <Coffee className="size-5" />,
  BreakEnd: <Play className="size-5" />,
  CheckOut: <LogOut className="size-5" />,
}

const stateDot: Record<AttendanceState, string> = {
  Out: 'bg-on-brand/40',
  Working: 'bg-signal',
  OnBreak: 'bg-pause',
}

/** Personelin "Bugünüm" ekranı: anlık durum, canlı sayaçlar, işlemler ve haftalık özet. */
export function TodayPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const query = useAttendance()
  const scan = useScan()
  const live = useLiveStatus(query.data, query.dataUpdatedAt)
  const today = useNow(60_000)

  const [action, setAction] = useState<AttendanceAction | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ action: AttendanceAction; at: string } | null>(null)
  const clearSuccess = useCallback(() => setSuccess(null), [])

  const handleToken = useCallback(
    async (token: string) => {
      if (!action || scan.isPending) return
      setScanError(null)
      try {
        const result = await scan.mutateAsync({ qrToken: token, action })
        setAction(null)
        setSuccess({ action: result.recorded, at: result.occurredAt })
      } catch (err) {
        setScanError(errorMessage(err, t))
      }
    },
    [action, scan, t],
  )

  const dateLabel = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(today)

  if (query.isPending || !live) {
    return (
      <>
        <PageHeader title={t('placeholder.hello', { name: user?.firstName ?? '' })} subtitle={dateLabel} />
        <PageSkeleton variant="hero" />
      </>
    )
  }

  if (query.isError) {
    return (
      <>
        <PageHeader title={t('placeholder.hello', { name: user?.firstName ?? '' })} subtitle={dateLabel} />
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-ink-soft">{errorMessage(query.error, t)}</p>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </>
    )
  }

  const status = query.data
  const actions = availableActions(status)
  const onBreak = status.state === 'OnBreak'

  return (
    <>
      <PageHeader title={t('placeholder.hello', { name: user?.firstName ?? '' })} subtitle={<span className="first-letter:uppercase">{dateLabel}</span>} />

      {status.hasUnclosedSession && (
        <p className="mb-5 flex items-start gap-2.5 rounded-xl bg-pause-soft px-4 py-3 text-sm text-pause">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {t('attendance.unclosed')}{' '}
            <Link to={user ? pathFor(user.role, 'taleplerim') : '/'} className="font-medium underline underline-offset-4">
              {t('requests.unclosedLink')}
            </Link>
          </span>
        </p>
      )}

      {/* Durum kartı */}
      <section className="relative overflow-hidden rounded-3xl bg-brand p-6 text-on-brand sm:p-8 dark:ring-1 dark:ring-line">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <AnimatePresence mode="wait">
              <motion.p
                key={status.state}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2.5 text-lg font-medium"
              >
                <span className="relative flex size-2.5">
                  {status.state !== 'Out' && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${stateDot[status.state]}`} />}
                  <span className={`relative inline-flex size-2.5 rounded-full ${stateDot[status.state]}`} />
                </span>
                {t(`attendance.states.${status.state}`)}
              </motion.p>
            </AnimatePresence>

            {onBreak ? (
              <BreakCountdown remaining={live.breakRemaining} overrun={live.breakOverrun} allowance={status.today.breakAllowanceSeconds} />
            ) : (
              <div className="mt-4">
                <p className="tabular text-[clamp(3rem,9vw,5.5rem)] leading-none font-semibold tracking-tight">
                  {formatClock(live.workedToday, true)}
                </p>
                <p className="mt-2 text-on-brand/60">{t('attendance.workedToday')}</p>
              </div>
            )}

            <p className="mt-5 max-w-md text-on-brand/75">
              {status.state === 'Out'
                ? t('attendance.stateHints.Out')
                : status.state === 'Working'
                  ? t('attendance.stateHints.Working', { time: formatTime(status.sessionStartedAt!) })
                  : t('attendance.stateHints.OnBreak', { time: formatTime(status.breakStartedAt!) })}
            </p>
            <ShiftLine status={status} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            {actions.map(({ action: a, disabled }, i) => (
              <motion.button
                key={a}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setScanError(null)
                  setAction(a)
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                whileTap={{ scale: 0.97 }}
                className={`flex h-14 min-w-56 items-center justify-center gap-2.5 rounded-2xl px-6 text-lg font-semibold transition-[filter,background-color] disabled:cursor-not-allowed disabled:opacity-40 ${
                  i === 0 ? 'bg-signal text-white hover:brightness-110' : 'bg-on-brand/10 text-on-brand ring-1 ring-on-brand/20 hover:bg-on-brand/15'
                }`}
                title={disabled ? t('attendance.breakUsedUp') : undefined}
              >
                {actionIcons[a]}
                {t(`attendance.actions.${a}`)}
              </motion.button>
            ))}
            {status.state === 'Working' && status.today.breakUsed && (
              <p className="text-center text-sm text-on-brand/55">{t('attendance.breakUsedUp')}</p>
            )}
          </div>
        </div>
      </section>

      <div className="mt-4">
        <FeedPanel allHref={user ? pathFor(user.role, 'duyurular') : '/'} />
      </div>

      {/* Özet kartları */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          icon={<Coffee className="size-5" />}
          tone={live.breakOverrun > 0 ? 'overrun' : 'pause'}
          label={live.breakOverrun > 0 ? t('attendance.breakOverrun') : t('attendance.breakRemaining')}
          value={live.breakOverrun > 0 ? `+${formatMinutes(Math.ceil(live.breakOverrun / 60))}` : formatMinutes(Math.floor(live.breakRemaining / 60))}
          sub={t('attendance.breakOf', { total: formatMinutes(Math.round(status.today.breakAllowanceSeconds / 60)) })}
          progress={Math.min(1, live.breakSeconds / Math.max(1, status.today.breakAllowanceSeconds))}
        />
        <StatCard
          icon={<Watch className="size-5" />}
          tone="signal"
          label={t('attendance.week')}
          value={formatSeconds(live.weekWorked)}
          sub={t('attendance.weekOf', { target: formatSeconds(status.week.targetSeconds) })}
          progress={Math.min(1, live.weekWorked / Math.max(1, status.week.targetSeconds))}
        />
        <StatCard
          className="col-span-2 sm:col-span-1"
          icon={<TrendingUp className="size-5" />}
          tone="brand"
          label={t('attendance.overtime')}
          value={live.overtime > 0 ? formatSeconds(live.overtime) : t('attendance.noOvertime')}
        />
      </div>

      {user && (
        <Link
          to={pathFor(user.role, 'ayim')}
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-panel px-5 py-3.5 text-sm ring-1 ring-line transition-colors hover:bg-panel-2"
        >
          <span>
            <span className="font-medium">{t('month.title')}</span>
            <span className="ml-2 text-ink-soft">{t('month.teaser')}</span>
          </span>
          <ChevronRight className="size-4 text-ink-soft" />
        </Link>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <WeekChart status={status} liveExtra={live.todayLiveExtra} />
        <Timeline status={status} />
      </div>

      <QrScannerSheet
        action={action}
        busy={scan.isPending}
        error={scanError}
        onToken={handleToken}
        onClose={() => setAction(null)}
      />
      <SuccessOverlay result={success} onDone={clearSuccess} />
    </>
  )
}

/** Bugünkü vardiya (çalışma + mola) ya da izin; bugün plan yoksa sıradaki vardiya. */
function ShiftLine({ status }: { status: AttendanceStatus }) {
  const { t } = useTranslation()
  const today = status.today.date
  const todayShift = status.todayShift
  const shift = todayShift ?? status.nextShift
  if (!shift) return null

  const brk = Math.round(status.today.breakAllowanceSeconds / 60)
  let text: string
  if (todayShift && todayShift.kind !== 'Work') {
    text = t('shifts.onLeaveToday', { kind: t(`shifts.kinds.${todayShift.kind}`) })
  } else if (todayShift) {
    const gross = todayShift.durationMinutes
    text = t('shifts.todayShiftFull', {
      start: hhmm(todayShift.startTime),
      end: hhmm(todayShift.endTime),
      work: formatDuration(gross > brk ? gross - brk : gross),
      break: formatMinutes(gross > brk ? brk : 0),
    })
  } else {
    const day =
      shift.date === addDays(today, 1) ? t('shifts.tomorrow').toLocaleLowerCase() : formatDay(shift.date, { weekday: 'long' })
    text = t('shifts.nextShiftHint', { day, start: hhmm(shift.startTime) })
  }

  return (
    <p className="mt-2 flex items-center gap-2 text-sm text-on-brand/60">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: shift.color }} />
      {text}
    </p>
  )
}

function BreakCountdown({ remaining, overrun, allowance }: { remaining: number; overrun: number; allowance: number }) {
  const { t } = useTranslation()
  const over = overrun > 0
  const fraction = allowance > 0 ? remaining / allowance : 0
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="mt-5 flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="size-32 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="10" />
        <motion.circle
          cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          className={over ? 'stroke-overrun' : 'stroke-pause'}
          strokeDasharray={c}
          animate={{ strokeDashoffset: over ? 0 : c * (1 - fraction) }}
          transition={{ duration: 0.8, ease: 'linear' }}
        />
      </svg>
      <div>
        <p className={`tabular text-[clamp(2.75rem,8vw,4.5rem)] leading-none font-semibold tracking-tight ${over ? 'text-overrun' : ''}`}>
          {over ? `+${formatClock(overrun)}` : formatClock(remaining)}
        </p>
        <p className="mt-2 text-on-brand/60">{over ? t('attendance.breakOverrun') : t('attendance.breakRemaining')}</p>
      </div>
    </div>
  )
}

const toneClasses = {
  signal: { icon: 'bg-signal-soft text-signal', bar: 'bg-signal' },
  pause: { icon: 'bg-pause-soft text-pause', bar: 'bg-pause' },
  overrun: { icon: 'bg-overrun-soft text-overrun', bar: 'bg-overrun' },
  brand: { icon: 'bg-ink/[0.06] text-ink dark:bg-ink/10', bar: 'bg-ink' },
}

function StatCard({
  icon,
  label,
  value,
  sub,
  progress,
  tone,
  className = '',
}: {
  className?: string
  icon: ReactNode
  label: string
  value: string
  sub?: string
  progress?: number
  tone: keyof typeof toneClasses
}) {
  return (
    <section className={`rounded-2xl bg-panel p-4 ring-1 ring-line sm:p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-9 place-items-center rounded-xl ${toneClasses[tone].icon}`}>{icon}</span>
        <p className="text-sm text-ink-soft">{label}</p>
      </div>
      <p className="tabular mt-4 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel-2 ring-1 ring-line">
          <motion.div
            className={`h-full rounded-full ${toneClasses[tone].bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}
    </section>
  )
}

function WeekChart({ status, liveExtra }: { status: AttendanceStatus; liveExtra: number }) {
  const { t } = useTranslation()
  const labels = t('attendance.days.short').split(' ')
  const days = status.week.days.map((d) => ({
    ...d,
    worked: d.workedSeconds + (d.date === status.today.date ? liveExtra : 0),
  }))
  const dailyTarget = status.week.targetSeconds / 5
  const max = Math.max(dailyTarget * 1.25, ...days.map((d) => d.worked))

  return (
    <section className="rounded-2xl bg-panel p-5 ring-1 ring-line">
      <h2 className="font-semibold">{t('attendance.week')}</h2>
      <div className="relative mt-6 flex h-40 items-end gap-2 sm:gap-3">
        {/* Günlük ortalama hedef çizgisi */}
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-soft/30"
          style={{ bottom: `${(dailyTarget / max) * 100}%` }}
        />
        {days.map((d, i) => {
          const isToday = d.date === status.today.date
          const dayIndex = (new Date(d.date + 'T00:00:00').getDay() + 6) % 7
          return (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="tabular text-xs text-ink-soft">{d.worked > 0 ? formatClock(d.worked, true).slice(0, -3) : ''}</span>
              <motion.div
                className={`w-full max-w-11 rounded-lg ${isToday ? 'bg-signal' : d.worked > 0 ? 'bg-ink/25 dark:bg-ink/30' : 'bg-panel-2 ring-1 ring-line'}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(3, (d.worked / max) * 100)}%` }}
                transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
              <span className={`text-xs ${isToday ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{labels[dayIndex]}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const eventTone: Record<AttendanceAction, string> = {
  CheckIn: 'bg-signal-soft text-signal',
  BreakStart: 'bg-pause-soft text-pause',
  BreakEnd: 'bg-pause-soft text-pause',
  CheckOut: 'bg-panel-2 text-ink-soft ring-1 ring-line',
}

function Timeline({ status }: { status: AttendanceStatus }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-2xl bg-panel p-5 ring-1 ring-line">
      <h2 className="font-semibold">{t('attendance.timeline')}</h2>
      {status.events.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">{t('attendance.timelineEmpty')}</p>
      ) : (
        <ol className="relative mt-5 space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-line">
          <AnimatePresence initial={false}>
            {status.events.map((e) => (
              <motion.li
                key={e.occurredAt + e.type}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative flex items-center gap-3"
              >
                <span className={`relative grid size-9 place-items-center rounded-full ${eventTone[e.type]} [&_svg]:size-4`}>
                  {actionIcons[e.type]}
                </span>
                <span className="flex-1">{t(`attendance.eventNames.${e.type}`)}</span>
                <span className="tabular text-sm text-ink-soft">{formatTime(e.occurredAt)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}
