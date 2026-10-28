import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Cake, Megaphone, PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QuoteRotator } from '../../components/QuoteRotator'
import { api } from '../../lib/api'

interface FeedItem {
  kind: 'birthday' | 'anniversary' | 'announcement'
  text: string
  detail: string | null
  years: number | null
}

/**
 * Kiosk ekranının alt bölümü: bugünkü doğum günleri, iş yıl dönümleri ve kioskta gösterilecek duyurular sırayla döner.
 * Gösterecek bir şey yoksa sözler döner.
 */
export function KioskFeed({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const { t } = useTranslation()
  const feed = useQuery({
    queryKey: ['kiosk-feed'],
    queryFn: () => api<FeedItem[]>('/kiosk/feed'),
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: true,
    retry: true,
  })
  const items = feed.data ?? []
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (items.length < 2) return
    const id = setInterval(() => setIndex((i) => i + 1), intervalMs)
    return () => clearInterval(id)
  }, [items.length, intervalMs])

  if (items.length === 0) return <QuoteRotator align="center" intervalMs={12000} />

  const item = items[index % items.length]!
  const celebration = item.kind !== 'announcement'

  return (
    <div aria-live="polite" className="text-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${item.kind}-${item.text}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
              celebration ? 'bg-pause/20 text-pause' : 'bg-signal/15 text-signal'
            }`}
          >
            {item.kind === 'birthday' ? <Cake className="size-4" /> : item.kind === 'anniversary' ? <PartyPopper className="size-4" /> : <Megaphone className="size-4" />}
            {item.kind === 'birthday'
              ? t('kiosk.birthday')
              : item.kind === 'anniversary'
                ? t('kiosk.anniversary', { years: item.years })
                : t('announcements.title')}
          </p>
          <p className="mt-3 text-[clamp(1.4rem,2.6vw,2rem)] leading-snug font-semibold text-balance">{item.text}</p>
          {celebration ? (
            <p className="mt-1 text-on-brand/70">{item.kind === 'birthday' ? t('kiosk.birthdayWish') : t('kiosk.anniversaryWish')}</p>
          ) : (
            item.detail && <p className="mx-auto mt-1 line-clamp-2 max-w-xl text-on-brand/70">{item.detail}</p>
          )}
        </motion.div>
      </AnimatePresence>
      {items.length > 1 && (
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {items.map((it, i) => (
            <span key={`${it.kind}-${it.text}`} className={`h-1 rounded-full transition-all duration-500 ${i === index % items.length ? 'w-5 bg-signal' : 'w-1 bg-on-brand/25'}`} />
          ))}
        </div>
      )}
    </div>
  )
}
