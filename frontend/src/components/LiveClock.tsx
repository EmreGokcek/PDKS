import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNow } from '../hooks/useNow'
import { locale } from '../i18n'

/** Giriş ekranı ve kioskta görünen büyük saat. */
export function LiveClock({ className = '' }: { className?: string }) {
  const now = useNow()
  useTranslation() // dil değişince yeniden çizilsin
  const loc = locale()

  const formats = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false }),
      date: new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }),
    }),
    [loc],
  )

  const seconds = String(now.getSeconds()).padStart(2, '0')

  return (
    <div className={className}>
      <p className="tabular flex items-baseline font-semibold leading-none tracking-tight">
        <time dateTime={now.toISOString()} className="text-[clamp(4rem,11vw,9rem)]">
          {formats.time.format(now)}
        </time>
        <span className="ml-3 text-[clamp(1.25rem,3vw,2.5rem)] opacity-45">{seconds}</span>
      </p>
      <p className="mt-4 text-lg opacity-80 first-letter:uppercase">{formats.date.format(now)}</p>
    </div>
  )
}
