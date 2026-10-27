import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, json } from '../../lib/api'
import type { AttendanceAction } from '../attendance/api'

export interface EventDetail {
  id: string
  type: AttendanceAction
  occurredAt: string
  source: 'QrScan' | 'Manual'
  note: string | null
  recordedBy: string | null
}

const key = (userId: string, date: string) => ['corrections', userId, date] as const

export function useDayEvents(userId: string | null, date: string | null) {
  return useQuery({
    queryKey: key(userId ?? '', date ?? ''),
    queryFn: () => api<EventDetail[]>(`/staff/${userId}/attendance?date=${date}`),
    enabled: !!userId && !!date,
  })
}

/** Düzeltmeden sonra ilgili tüm görünümler (gün listesi, raporlar, pano) tazelenir. */
function useRefresh(userId: string, date: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: key(userId, date) })
    void qc.invalidateQueries({ queryKey: ['reports'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useCorrections(userId: string, date: string) {
  const refresh = useRefresh(userId, date)
  return {
    add: useMutation({
      mutationFn: (b: { type: AttendanceAction; date: string; time: string; reason: string }) =>
        api<EventDetail>(`/staff/${userId}/attendance`, { method: 'POST', ...json(b) }),
      onSuccess: refresh,
    }),
    change: useMutation({
      mutationFn: ({ id, ...b }: { id: string; date: string; time: string; reason: string }) =>
        api<EventDetail>(`/attendance/events/${id}`, { method: 'PUT', ...json(b) }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        api<void>(`/attendance/events/${id}/delete`, { method: 'POST', ...json({ reason }) }),
      onSuccess: refresh,
    }),
  }
}
