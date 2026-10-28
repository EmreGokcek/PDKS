import { ArrowRight, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useNow } from '../../hooks/useNow'
import { AnnouncementCard } from './AnnouncementCard'
import { TodayCelebration } from './Celebrations'
import { highlighted, useFeed } from './api'

/**
 * Bugünüm ve Genel bakış ekranlarının üstündeki kısa pano:
 * bugünkü kutlamalar ve öne çıkan (sabit ya da yeni) duyurular. Gösterecek bir şey yoksa hiç görünmez.
 */
export function FeedPanel({ allHref }: { allHref: string }) {
  const { t } = useTranslation()
  const feed = useFeed()
  const now = useNow(60_000)
  if (!feed.data) return null

  const today = feed.data.celebrations.filter((c) => c.daysUntil === 0)
  const news = highlighted(feed.data, now.getTime()).slice(0, 2)
  if (today.length === 0 && news.length === 0) return null

  return (
    <section className="space-y-3" aria-label={t('announcements.title')}>
      {today.length > 0 && (
        <div className={`grid gap-3 ${today.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {today.map((c) => (
            <TodayCelebration key={c.userId + c.kind} celebration={c} />
          ))}
        </div>
      )}
      {news.length > 0 && (
        <div className={`grid gap-3 ${news.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {news.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} compact />
          ))}
        </div>
      )}
      <Link to={allHref} className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <Megaphone className="size-4" />
        {t('announcements.all')}
        <ArrowRight className="size-3.5" />
      </Link>
    </section>
  )
}
