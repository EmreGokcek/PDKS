import type { DayStatus } from './api'

/** Durumların renkleri (durum renkleri tüm uygulamada aynı anlamı taşır). */
export const statusTone: Record<DayStatus, 'signal' | 'pause' | 'overrun' | 'neutral' | 'brand'> = {
  InProgress: 'signal',
  Present: 'neutral',
  NotArrived: 'overrun',
  Absent: 'overrun',
  Upcoming: 'neutral',
  OnLeave: 'brand',
  Off: 'neutral',
  Unplanned: 'pause',
}
