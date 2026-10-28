import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNow } from '../hooks/useNow'
import { locale } from '../i18n'

/** Değişen rakam yukarı kayarak çıkar, yenisi aşağıdan gelir. */
function RollingDigit({ value }: { value: string }) {
  return (
    <span className="relative inline-block overflow-hidden align-baseline" style={{ width: '0.62em', height: '1em' }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="absolute inset-0 text-center"
          initial={{ y: '70%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-70%', opacity: 0, filter: 'blur(4px)' }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function Rolling({ text }: { text: string }) {
  return (
    <>
      {[...text].map((ch, i) => (
        <RollingDigit key={i} value={ch} />
      ))}
    </>
  )
}

/** Giriş ekranı ve kioskta görünen büyük saat: kayan rakamlar, nefes alan iki nokta. */
export function LiveClock({ className = '', align = 'start', size = 'lg' }: { className?: string; align?: 'start' | 'center'; size?: 'lg' | 'md' }) {
  const now = useNow()
  useTranslation() // dil değişince yeniden çizilsin
  const loc = locale()
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }), [loc])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  return (
    <div className={className}>
      <time
        dateTime={now.toISOString()}
        aria-label={`${hh}:${mm}`}
        className={`tabular flex flex-nowrap items-baseline leading-none font-semibold tracking-tight whitespace-nowrap ${align === 'center' ? 'justify-center' : ''}`}
      >
        <span className={size === 'lg' ? 'text-[clamp(4rem,11vw,9rem)]' : 'text-[clamp(3.5rem,7vw,6.5rem)]'}>
          <Rolling text={hh} />
          <motion.span
            className="inline-block px-[0.02em] align-baseline"
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            :
          </motion.span>
          <Rolling text={mm} />
        </span>
        <span className={`ml-3 opacity-45 ${size === 'lg' ? 'text-[clamp(1.25rem,3vw,2.5rem)]' : 'text-[clamp(1.1rem,2vw,1.75rem)]'}`}>
          <Rolling text={ss} />
        </span>
      </time>
      <p className="mt-4 text-lg opacity-80 first-letter:uppercase">{dateFormat.format(now)}</p>
    </div>
  )
}

/** Günün saatine göre selamlama. */
export function Greeting({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const h = useNow(60_000).getHours()
  const key = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night'
  return (
    <AnimatePresence mode="wait">
      <motion.p key={key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={className}>
        {t(`login.greetings.${key}`)}
      </motion.p>
    </AnimatePresence>
  )
}

/** Günün ne kadarının geçtiğini gösteren ince çubuk. */
export function DayProgress({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const now = useNow(30_000)
  const percent = Math.floor(((now.getHours() * 60 + now.getMinutes()) / 1440) * 100)
  return (
    <div className={className}>
      <div className="h-1 overflow-hidden rounded-full bg-on-brand/15">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-signal/60 to-signal"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="tabular mt-2 text-sm text-on-brand/55">{t('login.dayProgress', { percent })}</p>
    </div>
  )
}
