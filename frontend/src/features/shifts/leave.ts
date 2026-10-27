import type { ShiftTemplate } from './api'

export type ShiftKind = 'Work' | 'WeeklyOff' | 'AnnualLeave' | 'SickLeave' | 'ExcusedLeave'
export type LeaveKind = Exclude<ShiftKind, 'Work'>

export const leaveKinds: LeaveKind[] = ['WeeklyOff', 'AnnualLeave', 'SickLeave', 'ExcusedLeave']

export const leaveColors: Record<LeaveKind, string> = {
  WeeklyOff: '#8796a8',
  AnnualLeave: '#0ea5b7',
  SickLeave: '#d6455d',
  ExcusedLeave: '#b7791f',
}

export const isLeave = (kind: ShiftKind): kind is LeaveKind => kind !== 'Work'

/** Şablona bağlı olmayan eski kayıtlarda saatler bir şablonla aynıysa o şablonun adını göster. */
export function matchTemplate(start: string, end: string, templates: ShiftTemplate[]) {
  return templates.find((t) => t.startTime.slice(0, 5) === start.slice(0, 5) && t.endTime.slice(0, 5) === end.slice(0, 5))
}

/** Planlanan net çalışma: vardiya süresinden günlük mola düşülür (vardiya moladan kısaysa düşülmez). */
export function netWorkMinutes(grossMinutes: number, dailyBreak: number) {
  return grossMinutes > dailyBreak ? grossMinutes - dailyBreak : grossMinutes
}
