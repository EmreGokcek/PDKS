import { useEffect, useState } from 'react'

const timeFormat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })
const secondFormat = new Intl.DateTimeFormat('tr-TR', { second: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** Giriş ekranındaki büyük saat. */
export function LiveClock({ className = '' }: { className?: string }) {
  const now = useNow()
  return (
    <div className={className}>
      <p className="tabular flex items-baseline font-semibold leading-none tracking-tight">
        <time dateTime={now.toISOString()} className="text-[clamp(4rem,11vw,9rem)]">
          {timeFormat.format(now)}
        </time>
        <span className="ml-3 text-[clamp(1.25rem,3vw,2.5rem)] opacity-50">
          {secondFormat.format(now).padStart(2, '0')}
        </span>
      </p>
      <p className="mt-4 text-lg first-letter:uppercase opacity-80">{dateFormat.format(now)}</p>
    </div>
  )
}
