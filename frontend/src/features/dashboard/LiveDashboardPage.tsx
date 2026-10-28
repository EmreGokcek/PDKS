import { pathFor } from '../../auth/types'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/AppShell'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useNow } from '../../hooks/useNow'
import { errorMessage } from '../../lib/api'
import { formatDay, hhmm } from '../../lib/dates'
import { formatClock, formatTime } from '../../lib/format'
import { isLeave, leaveColors } from '../shifts/leave'
import { useLiveDashboard, type LivePerson } from './api'
import { statusTone } from './status'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { FeedPanel } from '../announcements/FeedPanel'
import { useAuth } from '../../auth/AuthContext'

type Tile = 'inside' | 'onBreak' | 'notArrived' | 'late' | 'onLeave' | 'done' | 'upcoming'

const tiles: { key: Tile; dot: string; match: (p: LivePerson) => boolean }[] = [
  { key: 'inside', dot: 'bg-signal', match: (p) => p.state === 'Working' },
  { key: 'onBreak', dot: 'bg-pause', match: (p) => p.state === 'OnBreak' },
  { key: 'notArrived', dot: 'bg-overrun', match: (p) => p.today.status === 'NotArrived' },
  { key: 'late', dot: 'bg-overrun', match: (p) => p.today.lateMinutes > 0 },
  { key: 'upcoming', dot: 'bg-ink-soft', match: (p) => p.today.status === 'Upcoming' },
  { key: 'done', dot: 'bg-ink-soft', match: (p) => p.today.status === 'Present' && p.state === 'Out' },
  { key: 'onLeave', dot: 'bg-[#0ea5b7]', match: (p) => p.today.status === 'OnLeave' },
]

/** Önce ilgilenilmesi gerekenler: gelmeyen, molası aşan, molada, içeride... */
function priority(p: LivePerson, overrun: number) {
  if (p.today.status === 'NotArrived') return 0
  if (p.state === 'OnBreak' && overrun > 0) return 1
  if (p.state === 'OnBreak') return 2
  if (p.state === 'Working') return 3
  if (p.today.status === 'Upcoming') return 4
  if (p.today.status === 'Present') return 5
  if (p.today.status === 'OnLeave') return 6
  return 7
}

/** Müdürün canlı panosu: bugün kim nerede. 30 sn'de bir yenilenir, sayaçlar saniye saniye akar. */
export function LiveDashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const query = useLiveDashboard()
  const now = useNow(1000)
  const [filter, setFilter] = useState<Tile | null>(null)
  const data = query.data

  const elapsed = data ? Math.max(0, Math.floor((now.getTime() - query.dataUpdatedAt) / 1000)) : 0

  const people = useMemo(() => {
    if (!data) return []
    return data.people
      .map((p) => {
        const working = p.state === 'Working' ? elapsed : 0
        const onBreak = p.state === 'OnBreak' ? elapsed : 0
        const breakSeconds = p.today.breakSeconds + onBreak
        const allowance = p.today.breakAllowanceSeconds
        return {
          person: p,
          worked: p.today.workedSeconds + working,
          breakRemaining: Math.max(0, allowance - breakSeconds),
          breakOverrun: Math.max(0, breakSeconds - allowance),
        }
      })
      .sort((a, b) => priority(a.person, a.breakOverrun) - priority(b.person, b.breakOverrun) || a.person.name.localeCompare(b.person.name, 'tr'))
  }, [data, elapsed])

  if (query.isPending) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <PageSkeleton variant="cards" />
      </>
    )
  }

  if (query.isError || !data) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-ink-soft">{errorMessage(query.error, t)}</p>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </>
    )
  }

  const active = filter ? tiles.find((x) => x.key === filter)! : null
  const visible = active ? people.filter((x) => active.match(x.person)) : people

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={<span className="first-letter:uppercase">{formatDay(data.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
        actions={
          <Button variant="ghost" size="sm" onClick={() => query.refetch()} title={t('dashboard.refresh')}>
            <RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            <span className="tabular">{t('dashboard.updated', { time: formatTime(new Date(query.dataUpdatedAt)) })}</span>
          </Button>
        }
      />

      {/* Üst bölüm: katılım halkası + dört ana sayaç; ikincil durumlar küçük süzgeç olarak */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-4">
        <AttendanceRing people={data.people} />
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          {tiles.slice(0, 4).map((tile, i) => (
            <TileButton key={tile.key} tile={tile} index={i} count={data.people.filter(tile.match).length} selected={filter === tile.key} onClick={() => setFilter(filter === tile.key ? null : tile.key)} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tiles.slice(4).map((tile) => {
          const count = data.people.filter(tile.match).length
          const selected = filter === tile.key
          return (
            <button
              key={tile.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(selected ? null : tile.key)}
              className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors ${selected ? 'bg-brand text-on-brand ring-brand' : 'bg-panel text-ink-soft ring-line hover:text-ink'}`}
            >
              <span className={`size-2 rounded-full ${tile.dot}`} />
              {t(`dashboard.tiles.${tile.key}`)}
              <span className="tabular font-semibold text-ink">{count}</span>
            </button>
          )
        })}
        <span className="ml-auto text-xs text-ink-soft max-sm:hidden">{t('dashboard.filterHint')}</span>
      </div>

      <div className="mt-6">
        <FeedPanel allHref={user ? pathFor(user.role, 'duyurular') : '/'} />
      </div>

      {active && (
        <button type="button" onClick={() => setFilter(null)} className="mt-4 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          {t('dashboard.showAll')}
        </button>
      )}

      {data.people.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-panel p-8 text-center text-ink-soft ring-1 ring-line">{t('dashboard.noStaff')}</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-panel p-8 text-center text-ink-soft ring-1 ring-line">{t('dashboard.empty')}</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map(({ person: p, worked, breakRemaining, breakOverrun }) => (
              <motion.li
                key={p.userId}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              >
                <PersonCard person={p} worked={worked} breakRemaining={breakRemaining} breakOverrun={breakOverrun} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </>
  )
}

const tileAccent: Record<string, string> = {
  inside: 'from-signal/15 text-signal',
  onBreak: 'from-pause/15 text-pause',
  notArrived: 'from-overrun/15 text-overrun',
  late: 'from-overrun/10 text-overrun',
}

function TileButton({
  tile,
  index,
  count,
  selected,
  onClick,
}: {
  tile: (typeof tiles)[number]
  index: number
  count: number
  selected: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.98 }}
      className={`relative overflow-hidden rounded-2xl p-4 text-left ring-1 transition-colors sm:p-5 ${selected ? 'bg-brand text-on-brand ring-brand' : 'bg-panel ring-line hover:bg-panel-2'}`}
    >
      {!selected && <span aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br to-transparent to-60% ${tileAccent[tile.key]?.split(' ')[0] ?? ''}`} />}
      <span className="relative flex items-center gap-2 text-sm opacity-80">
        <span className={`size-2 rounded-full ${tile.dot}`} />
        {t(`dashboard.tiles.${tile.key}`)}
      </span>
      <motion.span
        key={count}
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`tabular relative mt-3 block text-4xl font-semibold tracking-tight sm:text-5xl ${selected ? '' : count > 0 ? (tileAccent[tile.key]?.split(' ')[1] ?? '') : 'text-ink-soft/50'}`}
      >
        {count}
      </motion.span>
    </motion.button>
  )
}

/** Bugün vardiyası olanların kaçı geldi: halka grafik. */
function AttendanceRing({ people }: { people: LivePerson[] }) {
  const { t } = useTranslation()
  const expected = people.filter((p) => p.today.plan?.kind === 'Work')
  const arrived = expected.filter((p) => p.today.firstIn).length
  const ratio = expected.length ? arrived / expected.length : 0
  const r = 44
  const c = 2 * Math.PI * r

  return (
    <section className="flex items-center gap-6 rounded-2xl bg-brand p-5 text-on-brand sm:p-6 dark:ring-1 dark:ring-line">
      <div className="relative grid size-32 shrink-0 place-items-center sm:size-36">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="9" />
          <motion.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            className="stroke-signal"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - ratio) }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <span className="tabular text-3xl font-semibold">{expected.length ? `%${Math.round(ratio * 100)}` : '–'}</span>
      </div>
      <div className="min-w-0">
        <h2 className="text-sm text-on-brand/70">{t('dashboard.attendance')}</h2>
        <p className="mt-1 text-xl leading-snug font-semibold">
          {expected.length ? t('dashboard.arrivedOf', { arrived, expected: expected.length }) : t('dashboard.noneExpected')}
        </p>
      </div>
    </section>
  )
}

function PersonCard({
  person: p,
  worked,
  breakRemaining,
  breakOverrun,
}: {
  person: LivePerson
  worked: number
  breakRemaining: number
  breakOverrun: number
}) {
  const { t } = useTranslation()
  const plan = p.today.plan
  const leave = plan && isLeave(plan.kind)

  const statusLabel =
    p.state === 'OnBreak' ? t('dashboard.onBreak') : p.state === 'Working' ? t('dashboard.working') : t(`dashboard.status.${p.today.status}`)
  const tone = p.state === 'OnBreak' ? 'pause' : statusTone[p.today.status]
  const accent =
    p.today.status === 'NotArrived' || breakOverrun > 0 ? 'ring-overrun/40' : p.state === 'OnBreak' ? 'ring-pause/40' : 'ring-line'

  return (
    <article className={`h-full rounded-2xl bg-panel p-4 ring-1 ${accent}`}>
      <header className="flex items-center gap-3">
        <Avatar name={p.name} size="sm" muted={p.today.status === 'Off' || !!leave} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{p.name}</p>
          <p className="text-xs text-ink-soft">
            {leave
              ? t(`shifts.kinds.${plan!.kind}`)
              : plan
                ? `${hhmm(plan.startTime)}–${hhmm(plan.endTime)}${plan.name ? ` · ${plan.name}` : ''}`
                : t('dashboard.noShift')}
          </p>
        </div>
        <Badge tone={tone} dot>
          {statusLabel}
        </Badge>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        {p.today.firstIn && <span className="tabular text-ink-soft">{t('dashboard.checkIn', { time: formatTime(p.today.firstIn) })}</span>}
        {p.today.lastOut && p.state === 'Out' && (
          <span className="tabular text-ink-soft">{t('dashboard.checkOut', { time: formatTime(p.today.lastOut) })}</span>
        )}
        {p.today.lateMinutes > 0 && <Badge tone="overrun">{t('dashboard.lateBy', { minutes: p.today.lateMinutes })}</Badge>}
        {p.today.earlyLeaveMinutes > 0 && <Badge tone="pause">{t('dashboard.earlyBy', { minutes: p.today.earlyLeaveMinutes })}</Badge>}
      </div>

      {(worked > 0 || p.state !== 'Out') && (
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="tabular text-2xl font-semibold tracking-tight">{formatClock(worked, true)}</p>
          {p.state === 'OnBreak' && (
            <p className={`tabular text-sm font-medium ${breakOverrun > 0 ? 'text-overrun' : 'text-pause'}`}>
              {breakOverrun > 0
                ? t('dashboard.breakOver', { time: formatClock(breakOverrun) })
                : t('dashboard.breakLeft', { time: formatClock(breakRemaining) })}
            </p>
          )}
        </div>
      )}

      {leave && <span className="mt-3 block h-1.5 rounded-full" style={{ backgroundColor: leaveColors[plan!.kind as keyof typeof leaveColors] }} />}

      {p.today.hasUnclosedSession && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-pause">
          <AlertTriangle className="size-3.5" />
          {t('dashboard.unclosed')}
        </p>
      )}
    </article>
  )
}
