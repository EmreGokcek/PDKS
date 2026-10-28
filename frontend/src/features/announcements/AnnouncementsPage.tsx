import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Megaphone, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthContext'
import { PageHeader } from '../../components/AppShell'
import { Button } from '../../components/ui/Button'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { errorMessage } from '../../lib/api'
import { ConfirmDialog } from '../users/Dialogs'
import { AnnouncementCard } from './AnnouncementCard'
import { AnnouncementSheet } from './AnnouncementSheet'
import { TodayCelebration, UpcomingCelebration } from './Celebrations'
import { useAnnouncementList, useDeleteAnnouncement, useFeed, type Announcement } from './api'

/** Duyurular: kutlamalar ve duyuru listesi. Yönetici ve müdür buradan duyuru yazar. */
export function AnnouncementsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const feed = useFeed()
  const canPost = feed.data?.canPost ?? false
  const all = useAnnouncementList(canPost)
  const remove = useDeleteAnnouncement()

  const [sheet, setSheet] = useState<{ editing: Announcement | null } | null>(null)
  const [deleting, setDeleting] = useState<Announcement | null>(null)
  const [showExpired, setShowExpired] = useState(false)

  if (feed.isPending) {
    return (
      <>
        <PageHeader title={t('announcements.title')} subtitle={t('announcements.subtitle')} />
        <PageSkeleton variant="list" />
      </>
    )
  }
  if (feed.isError) {
    return (
      <>
        <PageHeader title={t('announcements.title')} />
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-ink-soft">{errorMessage(feed.error, t)}</p>
          <Button variant="secondary" size="sm" onClick={() => feed.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </>
    )
  }

  const data = feed.data
  const today = data.celebrations.filter((c) => c.daysUntil === 0)
  const upcoming = data.celebrations.filter((c) => c.daysUntil > 0)
  const expired = (all.data ?? []).filter((a) => !a.isActive)

  const edit = (a: Announcement) => setSheet({ editing: a })

  return (
    <>
      <PageHeader
        title={t('announcements.title')}
        subtitle={t('announcements.subtitle')}
        actions={
          canPost && (
            <Button onClick={() => setSheet({ editing: null })}>
              <Plus className="size-4" />
              {t('announcements.new')}
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        {/* Duyurular */}
        <section className="space-y-3">
          {data.announcements.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-panel px-6 py-14 text-center ring-1 ring-line">
              <span className="grid size-12 place-items-center rounded-full bg-panel-2 text-ink-soft">
                <Megaphone className="size-5" />
              </span>
              <p className="font-medium">{t('announcements.empty')}</p>
              {canPost && <p className="max-w-sm text-sm text-ink-soft">{t('announcements.emptyCanPost')}</p>}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {data.announcements.map((a) => (
                <motion.div key={a.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <AnnouncementCard announcement={a} onEdit={() => edit(a)} onDelete={() => setDeleting(a)} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {canPost && expired.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowExpired((s) => !s)}
                className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
                aria-expanded={showExpired}
              >
                <ChevronDown className={`size-4 transition-transform ${showExpired ? 'rotate-180' : ''}`} />
                {t('announcements.expiredSection', { count: expired.length })}
              </button>
              {showExpired && (
                <div className="mt-3 space-y-3">
                  {expired.map((a) => (
                    <AnnouncementCard key={a.id} announcement={a} onEdit={() => edit(a)} onDelete={() => setDeleting(a)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Kutlamalar */}
        <aside className="space-y-3">
          <h2 className="font-semibold">{t('announcements.celebrations.title')}</h2>
          {today.map((c) => (
            <TodayCelebration key={c.userId + c.kind} celebration={c} />
          ))}
          <div className="rounded-2xl bg-panel p-4 ring-1 ring-line">
            <h3 className="text-sm text-ink-soft">{t('announcements.celebrations.upcoming')}</h3>
            {upcoming.length === 0 ? (
              <p className="py-4 text-sm text-ink-soft">{t('announcements.celebrations.none')}</p>
            ) : (
              <ul className="mt-1 divide-y divide-line">
                {upcoming.map((c) => (
                  <UpcomingCelebration key={c.userId + c.kind} celebration={c} />
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-ink-soft">{t('announcements.celebrations.hint')}</p>
        </aside>
      </div>

      <AnnouncementSheet
        open={!!sheet}
        editing={sheet?.editing ?? null}
        companyWide={user?.role === 'Admin'}
        onClose={() => setSheet(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t('announcements.deleteTitle')}
        body={t('announcements.deleteBody', { title: deleting?.title ?? '' })}
        confirmLabel={t('announcements.delete')}
        tone="danger"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id)
            toast.success(t('announcements.deleted'))
            setDeleting(null)
          } catch (err) {
            toast.error(errorMessage(err, t))
          }
        }}
      />
    </>
  )
}
