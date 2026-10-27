import { locale } from '../i18n'

export type WeekDayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
const dayIndex: Record<WeekDayName, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
}

/** Yerel tarihi "YYYY-MM-DD" olarak yazar (UTC'ye çevirmeden). */
export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "YYYY-MM-DD" → yerel gece yarısı. */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function weekStartOf(iso: string, weekStartsOn: WeekDayName = 'Monday'): string {
  const d = parseDate(iso)
  const diff = (d.getDay() - dayIndex[weekStartsOn] + 7) % 7
  return addDays(iso, -diff)
}

export const todayIso = () => isoDate(new Date())

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale(), opts).format(parseDate(iso))
}

/** "26 Eki – 1 Kas 2026" */
export function formatRange(start: string, end: string) {
  const s = parseDate(start)
  const e = parseDate(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  const f1 = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  const f2 = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' })
  return `${f1.format(s)} – ${f2.format(e)}`
}

/** API'den gelen "08:00:00" → "08:00" */
export const hhmm = (time: string) => time.slice(0, 5)
/** "08:00" → "08:00:00" */
export const toApiTime = (time: string) => (time.length === 5 ? `${time}:00` : time)

export function shiftMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const a = sh! * 60 + sm!
  const b = eh! * 60 + em!
  return b > a ? b - a : 24 * 60 - (a - b)
}

export const isOvernight = (start: string, end: string) => hhmm(end) <= hhmm(start)
