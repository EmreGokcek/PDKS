import { useNow } from '../../hooks/useNow'
import type { AttendanceStatus } from './api'

/**
 * Sunucudan gelen anlık görüntüyü saniye saniye ilerletir.
 * Çalışırken çalışma süresi, moladayken mola süresi artar. Sunucu her dakika yeniden doğrular.
 */
export function useLiveStatus(status: AttendanceStatus | undefined, fetchedAt: number) {
  const now = useNow(1000)
  if (!status) return null

  const elapsed = Math.max(0, Math.floor((now.getTime() - fetchedAt) / 1000))
  const working = status.state === 'Working' ? elapsed : 0
  const onBreak = status.state === 'OnBreak' ? elapsed : 0

  const breakSeconds = status.today.breakSeconds + onBreak
  const allowance = status.today.breakAllowanceSeconds
  const weekWorked = status.week.workedSeconds + working

  return {
    workedToday: status.today.workedSeconds + working,
    breakSeconds,
    breakRemaining: Math.max(0, allowance - breakSeconds),
    breakOverrun: Math.max(0, breakSeconds - allowance),
    weekWorked,
    overtime: Math.max(0, weekWorked - status.week.targetSeconds),
    todayLiveExtra: working,
  }
}
