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
