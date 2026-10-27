import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, json } from '../../lib/api'

export type AttendanceState = 'Out' | 'Working' | 'OnBreak'
export type AttendanceAction = 'CheckIn' | 'BreakStart' | 'BreakEnd' | 'CheckOut'

export interface AttendanceStatus {
  state: AttendanceState
  serverNow: string
  sessionStartedAt: string | null
  breakStartedAt: string | null
  today: {
    date: string
    workedSeconds: number
    breakSeconds: number
    breakAllowanceSeconds: number
    breakRemainingSeconds: number
    breakOverrunSeconds: number
    breakUsed: boolean
  }
  week: {
    start: string
    workedSeconds: number
    targetSeconds: number
    overtimeSeconds: number
    days: { date: string; workedSeconds: number }[]
  }
  hasUnclosedSession: boolean
  events: { type: AttendanceAction; occurredAt: string }[]
}

export interface ScanResult {
  recorded: AttendanceAction
  occurredAt: string
  kioskName: string
  status: AttendanceStatus
}

export const attendanceKey = ['attendance', 'me'] as const

export function useAttendance() {
  return useQuery({
    queryKey: attendanceKey,
    queryFn: () => api<AttendanceStatus>('/me/attendance'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { qrToken: string; action: AttendanceAction }) =>
      api<ScanResult>('/attendance/scan', { method: 'POST', ...json(input) }),
    onSuccess: (result) => qc.setQueryData(attendanceKey, result.status),
  })
}

/** Mevcut duruma göre yapılabilecek işlemler. */
export function availableActions(status: AttendanceStatus): { action: AttendanceAction; disabled?: boolean }[] {
  switch (status.state) {
    case 'Out':
      return [{ action: 'CheckIn' }]
    case 'Working':
      return [{ action: 'BreakStart', disabled: status.today.breakUsed }, { action: 'CheckOut' }]
    case 'OnBreak':
      return [{ action: 'BreakEnd' }, { action: 'CheckOut' }]
  }
}

/** QR içeriğinden imzalı kodu çıkarır: hem ".../okut?k=KOD" bağlantısı hem düz kod kabul edilir. */
export function extractQrToken(raw: string): string {
  try {
    const url = new URL(raw)
    return url.searchParams.get('k') ?? raw
  } catch {
    return raw.trim()
  }
}
