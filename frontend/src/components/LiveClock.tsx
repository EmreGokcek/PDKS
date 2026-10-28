import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNow } from '../hooks/useNow'
import { locale } from '../i18n'
import { SplitFlap } from './SplitFlap'

/** Giriş ekranı ve kioskta görünen pano saati: rakamlar kanatçık kanatçık döner. */
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
        className={`tabular flex flex-nowrap items-end whitespace-nowrap ${align === 'center' ? 'justify-center' : ''}`}
      >
        <span className={`flex items-center ${size === 'lg' ? 'text-[clamp(4rem,10vw,8.5rem)]' : 'text-[clamp(3.25rem,6.5vw,6rem)]'}`}>
          <SplitFlap text={hh} />
          <span aria-hidden="true" className="clock-colon mx-[0.08em] flex flex-col gap-[0.16em]">
            <span className="size-[0.1em] bg-accent" />
            <span className="size-[0.1em] bg-accent" />
          </span>
          <SplitFlap text={mm} />
        </span>
        <span className={`ml-[0.4em] ${size === 'lg' ? 'text-[clamp(1.4rem,3vw,2.6rem)]' : 'text-[clamp(1.2rem,2vw,1.8rem)]'}`}>
          <SplitFlap text={ss} className="text-accent" />
        </span>
      </time>
      <p className={`board-label mt-5 text-lg text-on-brand/70 ${align === 'center' ? 'text-center' : ''}`}>{dateFormat.format(now)}</p>
    </div>
  )
}

/** Günün saatine göre selamlama. */
export function Greeting({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const h = useNow(60_000).getHours()
  const key = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night'
  return <p className={className}>{t(`login.greetings.${key}`)}</p>
}

/** Günü 24 saatlik bir şerit olarak gösterir: geçen saatler dolu, içinde bulunulan saat yarım. */
export function DayProgress({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const now = useNow(30_000)
  const hour = now.getHours()
  const percent = Math.floor(((hour * 60 + now.getMinutes()) / 1440) * 100)
  return (
    <div className={className}>
      <div className="flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 ${i < hour ? 'bg-accent' : i === hour ? 'bg-accent/45' : 'bg-on-brand/12'}`}
          />
        ))}
      </div>
      <div className="board-label mt-2 flex justify-between text-xs text-on-brand/50">
        <span>00</span>
        <span className="tabular text-on-brand/70">{t('login.dayProgress', { percent })}</span>
        <span>24</span>
      </div>
    </div>
  )
}
