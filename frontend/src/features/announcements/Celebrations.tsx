import { AnimatePresence, motion } from 'motion/react'
import { Cake, Check, PartyPopper } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar } from '../../components/ui/Avatar'
import { errorMessage } from '../../lib/api'
import { formatDay } from '../../lib/dates'
import { useCongratulate, type Celebration } from './api'

const confettiColors = ['#1f9a76', '#e3a83c', '#c2410c', '#2f80ed', '#9b51e0', '#35c39b']

/** Kutla düğmesine basınca etrafa saçılan küçük konfetiler. */
function Confetti({ burst }: { burst: number }) {
  return (
    <AnimatePresence>
      {burst > 0 && (
        <span key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0">
          {Array.from({ length: 14 }, (_, i) => {
            const angle = (i / 14) * Math.PI * 2
            const distance = 34 + (i % 3) * 12
            return (
              <motion.span
                key={i}
                className="absolute top-1/2 left-1/2 size-1.5 rounded-[1px]"
                style={{ backgroundColor: confettiColors[i % confettiColors.length] }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance + 10, opacity: 0, rotate: 180 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            )
          })}
        </span>
      )}
    </AnimatePresence>
  )
}

export function CongratulateButton({ celebration: c }: { celebration: Celebration }) {
  const { t } = useTranslation()
  const congratulate = useCongratulate()
  const [burst, setBurst] = useState(0)

  if (c.isMe) return null
  const done = c.congratulatedByMe

  return (
    <span className="relative inline-flex">
      <Confetti burst={burst} />
      <motion.button
        type="button"
        disabled={done || congratulate.isPending}
        whileTap={{ scale: 0.94 }}
        onClick={async () => {
          setBurst((b) => b + 1)
          navigator.vibrate?.(30)
          try {
            await congratulate.mutateAsync({ userId: c.userId, kind: c.kind })
          } catch (err) {
            toast.error(errorMessage(err, t))
          }
        }}
        className={`relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors ${
          done ? 'bg-signal-soft text-signal' : 'bg-ink text-paper hover:bg-ink/85'
        }`}
      >
        {done ? <Check className="size-4" /> : <PartyPopper className="size-4" />}
        {done ? t('announcements.celebrations.congratulated') : t('announcements.celebrations.congratulate')}
      </motion.button>
    </span>
  )
}

/** Kutlama cümlesi. (Çeviri anahtarları çok olduğu için t gevşek tiplenir.) */
export function celebrationText(c: Celebration, t: (key: string, options?: Record<string, unknown>) => string) {
  if (c.isMe)
    return c.kind === 'Birthday' ? t('announcements.celebrations.meBirthday') : t('announcements.celebrations.meAnniversary', { years: c.years })
  return c.kind === 'Birthday'
    ? t('announcements.celebrations.birthdayToday')
    : t('announcements.celebrations.anniversaryToday', { years: c.years })
}

/** Bugünkü kutlama: büyük kart, kutla düğmesi ve kaç kişinin kutladığı. */
export function TodayCelebration({ celebration: c }: { celebration: Celebration }) {
  const { t } = useTranslation()
  const birthday = c.kind === 'Birthday'
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 rounded-2xl p-4 ring-1 ${birthday ? 'bg-pause-soft ring-pause/20' : 'bg-signal-soft ring-signal/20'}`}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-full bg-panel ${birthday ? 'text-pause' : 'text-signal'}`}>
        {birthday ? <Cake className="size-5" /> : <PartyPopper className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{c.isMe ? t('announcements.celebrations.you') : c.name}</p>
        <p className="text-sm text-ink-soft">{celebrationText(c, t as unknown as (key: string, options?: Record<string, unknown>) => string)}</p>
        {c.congratulationCount > 0 && (
          <p className="tabular mt-0.5 text-xs text-ink-soft">{t('announcements.celebrations.count', { count: c.congratulationCount })}</p>
        )}
      </div>
      <CongratulateButton celebration={c} />
    </motion.article>
  )
}

/** Yaklaşan kutlama: tek satır. */
export function UpcomingCelebration({ celebration: c }: { celebration: Celebration }) {
  const { t } = useTranslation()
  const birthday = c.kind === 'Birthday'
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={c.name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{c.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-ink-soft">
          {birthday ? <Cake className="size-3.5 text-pause" /> : <PartyPopper className="size-3.5 text-signal" />}
          {birthday ? t('announcements.celebrations.Birthday') : t('announcements.celebrations.WorkAnniversary', { years: c.years })}
        </p>
      </div>
      <span className="text-right text-sm text-ink-soft">
        <span className="block first-letter:uppercase">
          {c.daysUntil === 1 ? t('announcements.celebrations.tomorrow') : formatDay(c.date, { weekday: 'long' })}
        </span>
        <span className="tabular block text-xs">{formatDay(c.date, { day: 'numeric', month: 'long' })}</span>
      </span>
    </li>
  )
}
