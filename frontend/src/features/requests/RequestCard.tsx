import { CalendarOff, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '../../components/ui/Badge'
import { formatDay, formatRange, isoDate } from '../../lib/dates'
import { formatTime } from '../../lib/format'
import { leaveColors } from '../shifts/leave'
import type { RequestStatus, StaffRequest } from './api'

const statusTone: Record<RequestStatus, 'pause' | 'signal' | 'overrun' | 'neutral'> = {
  Pending: 'pause',
  Approved: 'signal',
  Rejected: 'overrun',
  Cancelled: 'neutral',
}

/** Talebin özeti: tür, ne istendiği, açıklama, durum ve varsa yönetici kararı. */
export function RequestCard({ request: r, showName, children }: { request: StaffRequest; showName?: boolean; children?: ReactNode }) {
  const { t } = useTranslation()
  const isLeave = r.type === 'Leave'
  const summary = isLeave
    ? `${t(`shifts.kinds.${r.leaveKind!}`)} · ${r.startDate === r.endDate ? formatDay(r.startDate!, { day: 'numeric', month: 'long' }) : formatRange(r.startDate!, r.endDate!)} · ${t('requests.dayCount', { count: r.dayCount ?? 1 })}`
    : `${t(`attendance.eventNames.${r.eventType!}`)} · ${formatDay(isoDate(new Date(r.eventAt!)), { weekday: 'long', day: 'numeric', month: 'long' })} ${formatTime(r.eventAt!)}`

  return (
    <article className="rounded-2xl bg-panel p-4 ring-1 ring-line">
      <header className="flex items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: isLeave ? `${leaveColors[r.leaveKind!]}22` : 'var(--color-pause-soft)', color: isLeave ? leaveColors[r.leaveKind!] : 'var(--color-pause)' }}
        >
          {isLeave ? <CalendarOff className="size-5" /> : <Wrench className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          {showName && <p className="font-semibold">{r.userName}</p>}
          <p className={showName ? 'text-sm' : 'font-medium'}>
            <span className="text-ink-soft">{t(`requests.types.${r.type}`)}: </span>
            <span className="first-letter:uppercase">{summary}</span>
          </p>
          <p className="mt-1.5 text-sm text-ink-soft">“{r.reason}”</p>
        </div>
        <Badge tone={statusTone[r.status]} dot>
          {t(`requests.statuses.${r.status}`)}
        </Badge>
      </header>

      {(r.reviewedBy || r.reviewNote) && (
        <div className="mt-3 rounded-xl bg-panel-2 px-3 py-2 text-sm ring-1 ring-line">
          {r.reviewNote && <p>{r.reviewNote}</p>}
          {r.reviewedBy && r.reviewedAt && (
            <p className="text-xs text-ink-soft">
              {t('requests.reviewed', { name: r.reviewedBy, date: formatDay(isoDate(new Date(r.reviewedAt)), { day: 'numeric', month: 'long' }) })}
            </p>
          )}
        </div>
      )}

      {children && <div className="mt-3">{children}</div>}

      <p className="mt-3 text-xs text-ink-soft">
        {t('requests.sentAt', { date: `${formatDay(isoDate(new Date(r.createdAt)), { day: 'numeric', month: 'long' })} ${formatTime(r.createdAt)}` })}
      </p>
    </article>
  )
}
