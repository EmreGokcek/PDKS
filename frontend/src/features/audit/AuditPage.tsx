import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronDown, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/AppShell'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { api, errorMessage } from '../../lib/api'
import { formatDay, isoDate } from '../../lib/dates'
import { formatTime } from '../../lib/format'

interface AuditItem {
  id: string
  at: string
  actorName: string | null
  action: string
  entityName: string
  entityId: string | null
  targetName: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  reason: string | null
}

const categories = ['all', 'users', 'security', 'attendance', 'requests', 'shifts', 'announcements', 'settings'] as const
type Category = (typeof categories)[number]

/** Denetim kaydı: kim, neyi, ne zaman, neden değiştirdi. Yalnızca yönetici. */
export function AuditPage() {
  const { t } = useTranslation()
  const [category, setCategory] = useState<Category>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const query = useInfiniteQuery({
    queryKey: ['audit', category, from, to],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ take: '50' })
      if (category !== 'all') p.set('category', category)
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      if (pageParam) p.set('before', pageParam)
      return api<{ items: AuditItem[]; nextCursor: string | null }>(`/audit?${p}`)
    },
    getNextPageParam: (last) => last.nextCursor,
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const byDay = new Map<string, AuditItem[]>()
  for (const it of items) {
    const day = isoDate(new Date(it.at))
    byDay.set(day, [...(byDay.get(day) ?? []), it])
  }

  return (
    <>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Field label={t('audit.category')}>
          {(p) => (
            <Select {...p} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {t(`audit.categories.${c}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('audit.from')}>{(p) => <Input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label={t('audit.to')}>{(p) => <Input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
      </div>

      {query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.isError ? (
        <p className="py-16 text-center text-ink-soft">{errorMessage(query.error, t)}</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-panel px-6 py-14 text-center ring-1 ring-line">
          <ScrollText className="size-6 text-ink-soft" />
          <p className="text-ink-soft">{t('audit.empty')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-medium text-ink-soft first-letter:uppercase">{formatDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
                {list.map((it) => (
                  <AuditRow key={it.id} item={it} />
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

/** Değişen alanlar: eski → yeni. */
function changes(item: AuditItem) {
  const keys = new Set([...Object.keys(item.oldValues ?? {}), ...Object.keys(item.newValues ?? {})])
  return [...keys].map((k) => ({ key: k, old: item.oldValues?.[k], next: item.newValues?.[k] }))
}

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function AuditRow({ item }: { item: AuditItem }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const key = `audit.actions.${item.action.replaceAll('.', '_')}`
  const label = t(key as never) as unknown as string
  const diff = changes(item)
  const hasDetail = diff.length > 0 || !!item.reason

  return (
    <li>
      <button
        type="button"
        disabled={!hasDetail}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-panel-2"
      >
        <span className="tabular w-12 shrink-0 text-sm text-ink-soft">{formatTime(item.at)}</span>
        <Avatar name={item.actorName ?? '?'} size="sm" muted={!item.actorName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">
            <span className="font-medium">{item.actorName ?? t('audit.system')}</span> · {label === key ? item.action : label}
          </span>
          {item.targetName && <span className="block truncate text-xs text-ink-soft">{t('audit.target', { name: item.targetName })}</span>}
        </span>
        {hasDetail && <ChevronDown className={`size-4 shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div className="space-y-2 bg-panel-2/60 px-4 py-3 pl-[4.75rem] text-sm">
          {item.reason && (
            <p>
              <span className="text-ink-soft">{t('audit.reason')}: </span>
              {item.reason}
            </p>
          )}
          {diff.length > 0 && (
            <table className="text-left">
              <tbody>
                {diff.map((d) => (
                  <tr key={d.key}>
                    <th className="pr-4 align-top font-normal text-ink-soft">{d.key}</th>
                    <td className="tabular">
                      {item.oldValues && <span className="text-overrun line-through decoration-overrun/40">{show(d.old)}</span>}
                      {item.oldValues && item.newValues && <span className="mx-2 text-ink-soft">→</span>}
                      {item.newValues && <span className="text-signal">{show(d.next)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </li>
  )
}
