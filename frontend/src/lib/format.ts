import { locale } from '../i18n'

/** "3 saat önce", "dün" gibi göreli zaman. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day')
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

/** 2700 → "45 sa" / "45 h", 2730 → "45 sa 30 dk". */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const unit = (value: number, u: 'hour' | 'minute') =>
    new Intl.NumberFormat(locale(), { style: 'unit', unit: u, unitDisplay: 'short' }).format(value)
  if (h && m) return `${unit(h, 'hour')} ${unit(m, 'minute')}`
  return h ? unit(h, 'hour') : unit(m, 'minute')
}

/** Dakikayı her zaman dakika olarak yazar: 90 → "90 dk." / "90 min". Mola, tolerans gibi kısa süreler için. */
export function formatMinutes(minutes: number): string {
  return new Intl.NumberFormat(locale(), { style: 'unit', unit: 'minute', unitDisplay: 'short' }).format(minutes)
}

/** 3725 → "1:02:05", 125 → "2:05". Canlı sayaçlar için. */
export function formatClock(totalSeconds: number, alwaysHours = false): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 || alwaysHours ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** Saniyeyi "7 sa. 45 dk." biçiminde yazar. */
export function formatSeconds(totalSeconds: number): string {
  return formatDuration(Math.floor(Math.max(0, totalSeconds) / 60))
}

export function formatTime(iso: string | Date): string {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

/** Panoda gösterilecek süre: her zaman SS:DD:ss, iki haneli saat. */
export function boardClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.min(99, Math.floor(s / 3600)))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
