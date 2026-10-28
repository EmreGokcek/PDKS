import { Building2, MonitorSmartphone, MoreHorizontal, Pencil, Pin, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '../../components/ui/Badge'
import { IconButton } from '../../components/ui/Button'
import { Menu } from '../../components/ui/Menu'
import { formatDay } from '../../lib/dates'
import { relativeTime } from '../../lib/format'
import type { Announcement } from './api'

export function AnnouncementCard({
  announcement: a,
  onEdit,
  onDelete,
  compact = false,
}: {
  announcement: Announcement
  onEdit?: () => void
  onDelete?: () => void
  compact?: boolean
}) {
  const { t } = useTranslation()
  return (
    <article className={`relative rounded-2xl bg-panel p-4 ring-1 sm:p-5 ${a.isPinned ? 'ring-signal/30' : 'ring-line'} ${a.isActive ? '' : 'opacity-60'}`}>
      {a.isPinned && <span aria-hidden="true" className="absolute top-4 bottom-4 left-0 w-1 rounded-r-full bg-signal" />}
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {a.isPinned && (
              <Badge tone="signal">
                <Pin className="size-3" />
                {t('announcements.pinned')}
              </Badge>
            )}
            {!a.isActive && <Badge>{t('announcements.expired')}</Badge>}
          </div>
          <h3 className={`font-semibold ${a.isPinned || !a.isActive ? 'mt-1.5' : ''} ${compact ? '' : 'text-lg leading-snug'}`}>{a.title}</h3>
        </div>
        {a.canEdit && onEdit && onDelete && (
          <Menu
            trigger={(p) => (
              <IconButton label={t('common.edit')} {...p} className="-mt-1 -mr-2">
                <MoreHorizontal className="size-5" />
              </IconButton>
            )}
            items={[
              { label: t('common.edit'), icon: <Pencil className="size-4" />, onSelect: onEdit },
              { label: t('announcements.delete'), icon: <Trash2 className="size-4" />, onSelect: onDelete, tone: 'danger' },
            ]}
          />
        )}
      </header>
      {a.body && (
        <p className={`mt-2 whitespace-pre-line text-ink-soft ${compact ? 'line-clamp-2 text-sm' : ''}`}>{a.body}</p>
      )}
      <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span>{t('announcements.by', { name: a.authorName, time: relativeTime(a.createdAt) })}</span>
        {!compact && (
          <>
            <span className="flex items-center gap-1">
              <Building2 className="size-3.5" />
              {a.companyWide ? t('announcements.companyWide') : t('announcements.branchOnly')}
            </span>
            {a.showOnKiosk && (
              <span className="flex items-center gap-1">
                <MonitorSmartphone className="size-3.5" />
                {t('announcements.onKiosk')}
              </span>
            )}
            {a.expiresOn && a.isActive && <span>{t('announcements.expires', { date: formatDay(a.expiresOn, { day: 'numeric', month: 'long' }) })}</span>}
          </>
        )}
      </footer>
    </article>
  )
}
