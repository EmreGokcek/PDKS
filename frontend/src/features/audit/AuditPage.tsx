import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/AppShell'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Segmented } from '../../components/ui/Segmented'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { api, errorMessage } from '../../lib/api'
import { formatDay, isoDate } from '../../lib/dates'
import { formatTime } from '../../lib/format'

interface AuditEntry {
  id: string
  at: string
  actorName: string | null
  action: string
  entityName: string
  entityId: string | null
  subjectName: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  reason: string | null
}

const areas = ['all', 'user', 'attendance', 'shift', 'request', 'announcement', 'leave', 'work_rule'] as const
type Area = (typeof areas)[number]

/** Denetim kaydı: kim, neyi, ne zaman, neden değiştirdi. Yalnızca okunur. */
export function AuditPage() {
  const { t } = useTranslation()
  const [area, setArea] = useState<Area>('all')
  const query = useInfiniteQuery({
    queryKey: ['audit', area],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ take: '50' })
      if (area !== 'all') p.set('area', area)
      if (pageParam) p.set('before', pageParam)
      return api<{ items: AuditEntry[]; nextBefore: string | null }>(`/audit?${p}`)
    },
    getNextPageParam: (last) => last.nextBefore,
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const days = new Map<string, AuditEntry[]>()
  for (const e of items) {
    const d = isoDate(new Date(e.at))
    days.set(d, [...(days.get(d) ?? []), e])
  }

  return (
    <>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />

      <div className="mb-5 overflow-x-auto">
        <Segmented<Area>
          label={t('audit.area')}
          value={area}
          onChange={setArea}
          options={areas.map((a) => ({ value: a, label: t(`audit.areas.${a}`) }))}
        />
      </div>

      {query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <p className="py-12 text-center text-ink-soft">{errorMessage(query.error, t)}</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-panel p-10 text-center text-ink-soft ring-1 ring-line">{t('audit.empty')}</p>
      ) : (
        <div className="space-y-6">
          {[...days].map(([day, entries]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm text-ink-soft first-letter:uppercase">{formatDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
                {entries.map((e) => (
                  <Entry key={e.id} entry={e} />
                ))}
              </ul>
            </section>
          ))}
          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage}>
                {t('audit.more')}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Entry({ entry: e }: { entry: AuditEntry }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const key = `audit.actions.${e.action}`
  const label = i18n.exists(key) ? t(key as never) : e.action
  const changes = diff(e.oldValues, e.newValues)
  const expandable = changes.length > 0

  return (
    <li>
      <button
        type="button"
        disabled={!expandable}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        className="flex w-full items-start gap-3 px-4 py-3 text-left enabled:hover:bg-panel-2"
      >
        <span className="tabular w-12 shrink-0 pt-0.5 text-sm text-ink-soft">{formatTime(e.at)}</span>
        <Avatar name={e.actorName ?? '?'} size="sm" muted={!e.actorName} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm">
            <span className="font-medium">{e.actorName ?? t('audit.system')}</span> · {label}
            {e.subjectName && e.subjectName !== e.actorName && <span className="text-ink-soft"> — {e.subjectName}</span>}
          </span>
          {e.reason && <span className="mt-0.5 block text-sm text-ink-soft">{t('audit.reason', { reason: e.reason })}</span>}
        </span>
        {expandable && <ChevronDown className={`mt-1 size-4 shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <dl className="mx-4 mb-3 grid gap-1 rounded-xl bg-panel-2 p-3 text-sm ring-1 ring-line sm:grid-cols-[auto_1fr] sm:gap-x-4">
          {changes.map(([field, before, after]) => (
            <div key={field} className="contents">
              <dt className="text-ink-soft">{i18n.exists(`audit.fields.${field}`) ? t(`audit.fields.${field}` as never) : field}</dt>
              <dd className="break-words">
                {before !== undefined && <span className="text-overrun line-through decoration-overrun/50">{show(before)}</span>}
                {before !== undefined && after !== undefined && ' → '}
                {after !== undefined && <span className="text-signal">{show(after)}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}

/** Eski ve yeni değerlerden değişen alanlar. Yalnızca biri varsa (ekleme / silme) olduğu gibi gösterilir. */
function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null): [string, unknown, unknown][] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const rows: [string, unknown, unknown][] = []
  for (const k of keys) {
    const b = before?.[k]
    const a = after?.[k]
    if (before && after && JSON.stringify(b) === JSON.stringify(a)) continue
    rows.push([k, before ? b : undefined, after ? a : undefined])
  }
  return rows
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return `${formatDay(isoDate(new Date(v)), { day: 'numeric', month: 'short' })} ${formatTime(v)}`
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
