import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Coffee, LogIn, LogOut, Play, TrendingUp, Watch } from 'lucide-react'
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
import { boardClock, formatClock, formatDuration, formatMinutes, formatSeconds, formatTime } from '../../lib/format'
import { availableActions, useAttendance, useScan, type AttendanceAction, type AttendanceState, type AttendanceStatus } from './api'
import { QrScannerSheet } from './QrScannerSheet'
import { SuccessOverlay } from './SuccessOverlay'
import { useLiveStatus } from './useLiveStatus'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { SplitFlap } from '../../components/SplitFlap'

export const actionIcons: Record<AttendanceAction, ReactNode> = {
  CheckIn: <LogIn className="size-5" />,
  BreakStart: <Coffee className="size-5" />,
  BreakEnd: <Play className="size-5" />,
  CheckOut: <LogOut className="size-5" />,
}

const stateLamp: Record<AttendanceState, string> = {
  Out: 'bg-on-brand/40',
  Working: 'bg-signal',
  OnBreak: 'bg-pause',
}
const stateText: Record<AttendanceState, string> = {
  Out: 'text-on-brand/70',
  Working: 'text-signal',
  OnBreak: 'text-pause',
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
        <p className="mb-5 flex items-start gap-2.5 border-l-[3px] border-pause bg-pause-soft px-4 py-3 text-sm text-pause">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {t('attendance.unclosed')}{' '}
            <Link to={user?.role === 'Manager' ? '/mudur/taleplerim' : '/personel/taleplerim'} className="font-medium underline underline-offset-4">
              {t('requests.unclosedLink')}
            </Link>
          </span>
        </p>
      )}

      {/* Durum kartı */}
      <section className="dark relative overflow-hidden rounded-lg bg-brand p-6 text-on-brand sm:p-8 dark:ring-1 dark:ring-line">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <AnimatePresence mode="wait">
              <motion.p
                key={status.state}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`board-label flex items-center gap-2.5 text-xl ${stateText[status.state]}`}
              >
                <span className={`size-3 ${stateLamp[status.state]} ${status.state !== 'Out' ? 'animate-pulse' : ''}`} />
                {t(`attendance.states.${status.state}`)}
              </motion.p>
            </AnimatePresence>

            {onBreak ? (
              <BreakCountdown remaining={live.breakRemaining} overrun={live.breakOverrun} allowance={status.today.breakAllowanceSeconds} />
            ) : (
              <div className="mt-5">
                <SplitFlap text={boardClock(live.workedToday)} label={formatClock(live.workedToday, true)} className="text-[clamp(2.6rem,8vw,4.75rem)]" />
                <p className="board-label mt-3 text-sm text-on-brand/55">{t('attendance.workedToday')}</p>
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
                whileTap={{ scale: 0.98 }}
                className={`board-label flex h-14 min-w-56 items-center justify-center gap-2.5 rounded-md px-6 text-xl transition-[filter,background-color] disabled:cursor-not-allowed disabled:opacity-40 ${
                  i === 0 ? 'bg-accent text-on-accent hover:brightness-105' : 'text-on-brand ring-1 ring-on-brand/25 hover:bg-on-brand/10'
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
      <span className="h-3 w-1 shrink-0" style={{ backgroundColor: shift.color }} />
      {text}
    </p>
  )
}

function BreakCountdown({ remaining, overrun, allowance }: { remaining: number; overrun: number; allowance: number }) {
  const { t } = useTranslation()
  const over = overrun > 0
  // Mola hakkı 5 dakikalık kutucuklar halinde; kalanlar dolu görünür.
  const cells = Math.min(24, Math.max(1, Math.round(allowance / 300)))
  const left = over ? 0 : Math.ceil((remaining / Math.max(1, allowance)) * cells)
  return (
    <div className="mt-5">
      <SplitFlap
        text={(over ? '+' : '') + boardClock(over ? overrun : remaining).slice(3)}
        label={over ? `+${formatClock(overrun)}` : formatClock(remaining)}
        className={`text-[clamp(2.6rem,8vw,4.75rem)] ${over ? 'text-overrun' : 'text-pause'}`}
      />
      <div className="mt-4 flex max-w-sm gap-[3px]" aria-hidden="true">
        {Array.from({ length: cells }, (_, i) => (
          <span key={i} className={`h-2.5 flex-1 ${over ? 'bg-overrun' : i < left ? 'bg-pause' : 'bg-on-brand/12'}`} />
        ))}
      </div>
      <p className="board-label mt-3 text-sm text-on-brand/55">{over ? t('attendance.breakOverrun') : t('attendance.breakRemaining')}</p>
    </div>
  )
}

const toneClasses = {
  signal: { icon: 'text-signal', bar: 'bg-signal' },
  pause: { icon: 'text-pause', bar: 'bg-pause' },
  overrun: { icon: 'text-overrun', bar: 'bg-overrun' },
  brand: { icon: 'text-ink', bar: 'bg-ink' },
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
    <section className={`rounded-lg bg-panel p-4 ring-1 ring-line sm:p-5 ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`[&_svg]:size-4 ${toneClasses[tone].icon}`}>{icon}</span>
        <p className="board-label text-xs text-ink-soft">{label}</p>
      </div>
      <p className="tabular mt-3 font-display text-3xl leading-none font-semibold sm:text-[2.1rem]">{value}</p>
      {sub && <p className="mt-1.5 text-sm text-ink-soft">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden bg-panel-2 ring-1 ring-line">
          <motion.div
            className={`h-full ${toneClasses[tone].bar}`}
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
    <section className="rounded-lg bg-panel p-5 ring-1 ring-line">
      <h2 className="board-label text-sm text-ink-soft">{t('attendance.week')}</h2>
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
                className={`w-full max-w-11 rounded-t-sm ${isToday ? 'bg-accent' : d.worked > 0 ? 'bg-ink/25 dark:bg-ink/30' : 'bg-panel-2 ring-1 ring-line'}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(3, (d.worked / max) * 100)}%` }}
                transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
              <span className={`board-label text-xs ${isToday ? 'text-ink' : 'text-ink-soft'}`}>{labels[dayIndex]}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

const eventTone: Record<AttendanceAction, string> = {
  CheckIn: 'bg-signal',
  BreakStart: 'bg-pause',
  BreakEnd: 'bg-pause',
  CheckOut: 'bg-ink-soft',
}

/** Günün hareketleri pano satırları halinde: saat, renk şeridi, olay. */
function Timeline({ status }: { status: AttendanceStatus }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-lg bg-panel p-5 ring-1 ring-line">
      <h2 className="board-label text-sm text-ink-soft">{t('attendance.timeline')}</h2>
      {status.events.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">{t('attendance.timelineEmpty')}</p>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          <AnimatePresence initial={false}>
            {status.events.map((e) => (
              <motion.li
                key={e.occurredAt + e.type}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 py-2.5"
              >
                <span className="tabular w-14 font-display text-xl font-semibold">{formatTime(e.occurredAt)}</span>
                <span className={`h-5 w-1 ${eventTone[e.type]}`} />
                <span className="board-label flex-1 text-[15px]">{t(`attendance.eventNames.${e.type}`)}</span>
                <span className="text-ink-soft [&_svg]:size-4">{actionIcons[e.type]}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}
