import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/AppShell'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { useNow } from '../../hooks/useNow'
import { errorMessage } from '../../lib/api'
import { formatDay, hhmm } from '../../lib/dates'
import { formatClock, formatTime } from '../../lib/format'
import { isLeave, leaveColors } from '../shifts/leave'
import { useLiveDashboard, type LivePerson } from './api'
import { statusTone } from './status'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { SplitFlap } from '../../components/SplitFlap'

type Tile = 'inside' | 'onBreak' | 'notArrived' | 'late' | 'onLeave' | 'done' | 'upcoming'

const tiles: { key: Tile; dot: string; match: (p: LivePerson) => boolean }[] = [
  { key: 'inside', dot: 'bg-signal', match: (p) => p.state === 'Working' },
  { key: 'onBreak', dot: 'bg-pause', match: (p) => p.state === 'OnBreak' },
  { key: 'notArrived', dot: 'bg-overrun', match: (p) => p.today.status === 'NotArrived' },
  { key: 'late', dot: 'bg-overrun', match: (p) => p.today.lateMinutes > 0 },
  { key: 'upcoming', dot: 'bg-ink-soft', match: (p) => p.today.status === 'Upcoming' },
  { key: 'done', dot: 'bg-ink-soft', match: (p) => p.today.status === 'Present' && p.state === 'Out' },
  { key: 'onLeave', dot: 'bg-[#4f8fd6]', match: (p) => p.today.status === 'OnLeave' },
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

      {/* Pano başlığı: katılım + dört ana sayaç (dokununca liste süzülür) */}
      <section className="dark overflow-hidden rounded-lg bg-brand text-on-brand ring-1 ring-line">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
          <AttendanceStrip people={data.people} />
          <div className="grid grid-cols-4 border-on-brand/10 max-lg:border-t lg:border-l">
            {tiles.slice(0, 4).map((tile, i) => (
              <TileButton key={tile.key} tile={tile} index={i} count={data.people.filter(tile.match).length} selected={filter === tile.key} onClick={() => setFilter(filter === tile.key ? null : tile.key)} />
            ))}
          </div>
        </div>
      </section>
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
              className={`board-label flex items-center gap-2 rounded-sm px-3 py-1.5 text-[13px] ring-1 transition-colors ${selected ? 'bg-ink text-panel ring-ink' : 'bg-panel text-ink-soft ring-line hover:text-ink'}`}
            >
              <span className={`size-2 ${tile.dot}`} />
              {t(`dashboard.tiles.${tile.key}`)}
              <span className={`tabular ${selected ? '' : 'text-ink'}`}>{count}</span>
            </button>
          )
        })}
        <span className="ml-auto text-xs text-ink-soft max-sm:hidden">{t('dashboard.filterHint')}</span>
      </div>

      {active && (
        <button type="button" onClick={() => setFilter(null)} className="mt-4 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          {t('dashboard.showAll')}
        </button>
      )}

      {data.people.length === 0 ? (
        <p className="mt-6 rounded-lg bg-panel p-8 text-center text-ink-soft ring-1 ring-line">{t('dashboard.noStaff')}</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-lg bg-panel p-8 text-center text-ink-soft ring-1 ring-line">{t('dashboard.empty')}</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg bg-panel ring-1 ring-line">
          <div className={`${rowGrid} board-label border-b border-line bg-panel-2 px-4 py-2.5 text-[11px] text-ink-soft max-md:hidden`}>
            <span>{t('dashboard.columns.person')}</span>
            <span>{t('dashboard.columns.shift')}</span>
            <span>{t('dashboard.columns.checkIn')}</span>
            <span className="text-right">{t('dashboard.columns.worked')}</span>
            <span className="text-right">{t('dashboard.columns.status')}</span>
          </div>
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {visible.map(({ person: p, worked, breakRemaining, breakOverrun }) => (
                <motion.li key={p.userId} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  <PersonRow person={p} worked={worked} breakRemaining={breakRemaining} breakOverrun={breakOverrun} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </>
  )
}

const rowGrid = 'md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_4.5rem_6.5rem_minmax(0,1.1fr)] md:items-center md:gap-4'

const tileText: Record<string, string> = {
  inside: 'text-signal',
  onBreak: 'text-pause',
  notArrived: 'text-overrun',
  late: 'text-overrun',
}

/** Pano sütunu: etiket ve kanatçıklı sayı. Seçiliyken altı sarı çizgili. */
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
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative min-w-0 px-3 py-4 text-left transition-colors sm:p-5 ${index > 0 ? 'border-l border-on-brand/10' : ''} ${selected ? 'bg-on-brand/[0.07]' : 'hover:bg-on-brand/[0.04]'}`}
    >
      <span className="board-label flex items-center gap-1.5 truncate text-[11px] text-on-brand/60 sm:gap-2 sm:text-xs">
        <span className={`size-2 shrink-0 ${tile.dot}`} />
        {t(`dashboard.tiles.${tile.key}`)}
      </span>
      <SplitFlap
        text={String(Math.min(99, count)).padStart(2, '0')}
        label={String(count)}
        className={`mt-3 text-[2rem] sm:text-[2.6rem] ${count > 0 ? (tileText[tile.key] ?? '') : 'text-on-brand/35'}`}
      />
      {selected && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-accent" />}
    </button>
  )
}

/** Bugün vardiyası olanların kaçı geldi: her kişi bir kutucuk. */
function AttendanceStrip({ people }: { people: LivePerson[] }) {
  const { t } = useTranslation()
  const expected = people.filter((p) => p.today.plan?.kind === 'Work')
  const arrived = expected.filter((p) => p.today.firstIn).length
  const percent = expected.length ? Math.round((arrived / expected.length) * 100) : 0

  return (
    <div className="p-5 sm:p-6">
      <h2 className="board-label text-xs text-on-brand/60">{t('dashboard.attendance')}</h2>
      <div className="mt-3 flex items-end gap-3">
        <SplitFlap text={String(arrived).padStart(2, '0')} className="text-[2.6rem]" />
        <span className="pb-1 font-display text-2xl font-semibold text-on-brand/40">/ {expected.length}</span>
        {expected.length > 0 && <span className="ml-auto pb-1 font-display text-2xl font-semibold text-accent">%{percent}</span>}
      </div>
      {expected.length > 0 ? (
        <div className="mt-4 flex gap-[3px]" aria-hidden="true">
          {expected.map((p) => (
            <span key={p.userId} title={p.name} className={`h-2.5 flex-1 ${p.today.firstIn ? 'bg-accent' : 'bg-on-brand/12'}`} />
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-sm text-on-brand/60">
        {expected.length ? t('dashboard.arrivedOf', { arrived, expected: expected.length }) : t('dashboard.noneExpected')}
      </p>
    </div>
  )
}

const toneText = {
  signal: 'text-signal',
  pause: 'text-pause',
  overrun: 'text-overrun',
  neutral: 'text-ink-soft',
  brand: 'text-ink',
} as const

/** Kalkış tablosu satırı: kişi, vardiya, giriş, çalışma süresi, durum. */
function PersonRow({
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
  const tone = p.state === 'OnBreak' ? (breakOverrun > 0 ? 'overrun' : 'pause') : statusTone[p.today.status]
  const lamp =
    p.today.status === 'NotArrived' || breakOverrun > 0 ? 'bg-overrun' : p.state === 'OnBreak' ? 'bg-pause' : p.state === 'Working' ? 'bg-signal' : 'bg-transparent'

  return (
    <div className={`relative px-4 py-3 ${rowGrid} max-md:grid max-md:grid-cols-[1fr_auto] max-md:gap-x-3 max-md:gap-y-1`}>
      <span aria-hidden="true" className={`absolute top-0 bottom-0 left-0 w-[3px] ${lamp}`} />

      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={p.name} size="sm" muted={p.today.status === 'Off' || !!leave} />
        <div className="min-w-0">
          <p className="truncate font-medium">{p.name}</p>
          {p.today.hasUnclosedSession && (
            <p className="flex items-center gap-1 text-xs text-pause">
              <AlertTriangle className="size-3" />
              {t('dashboard.unclosed')}
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0 text-sm text-ink-soft max-md:col-start-1 max-md:pl-11">
        {leave ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-1" style={{ backgroundColor: leaveColors[plan!.kind as keyof typeof leaveColors] }} />
            {t(`shifts.kinds.${plan!.kind}`)}
          </span>
        ) : plan ? (
          <span className="truncate">
            <span className="tabular font-display text-base font-semibold text-ink">{`${hhmm(plan.startTime)}–${hhmm(plan.endTime)}`}</span>
            {plan.name ? ` · ${plan.name}` : ''}
          </span>
        ) : (
          t('dashboard.noShift')
        )}
      </div>

      <div className="tabular font-display text-lg font-semibold max-md:hidden">
        {p.today.firstIn ? formatTime(p.today.firstIn) : <span className="text-ink-soft/50">--:--</span>}
      </div>

      <div className="tabular text-right font-display text-xl font-semibold max-md:col-start-2 max-md:row-start-1">
        {worked > 0 || p.state !== 'Out' ? formatClock(worked, true) : <span className="text-ink-soft/50">–</span>}
      </div>

      <div className="flex flex-col items-end gap-0.5 text-right max-md:col-start-2 max-md:row-start-2">
        <span className={`board-label text-sm ${toneText[tone]}`}>{statusLabel}</span>
        {p.state === 'OnBreak' ? (
          <span className={`tabular text-xs ${breakOverrun > 0 ? 'text-overrun' : 'text-pause'}`}>
            {breakOverrun > 0 ? t('dashboard.breakOver', { time: formatClock(breakOverrun) }) : t('dashboard.breakLeft', { time: formatClock(breakRemaining) })}
          </span>
        ) : p.today.lateMinutes > 0 ? (
          <span className="text-xs text-overrun">{t('dashboard.lateBy', { minutes: p.today.lateMinutes })}</span>
        ) : p.today.earlyLeaveMinutes > 0 ? (
          <span className="text-xs text-pause">{t('dashboard.earlyBy', { minutes: p.today.earlyLeaveMinutes })}</span>
        ) : p.today.lastOut && p.state === 'Out' ? (
          <span className="tabular text-xs text-ink-soft">{t('dashboard.checkOut', { time: formatTime(p.today.lastOut) })}</span>
        ) : null}
      </div>
    </div>
  )
}
