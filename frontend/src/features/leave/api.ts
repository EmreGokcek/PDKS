import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, json } from '../../lib/api'
import type { LeaveKind } from '../shifts/leave'

export interface LeaveBalance {
  userId: string
  name: string
  hireDate: string | null
  serviceYears: number
  earned: number
  adjustments: number
  used: number
  pending: number
  remaining: number
  available: number
  nextEarnedOn: string | null
  nextDays: number | null
}

export interface Holiday {
  id: string
  date: string
  name: string
  isHalfDay: boolean
}

export interface LeaveCalendar {
  from: string
  to: string
  holidays: Holiday[]
  people: { userId: string; name: string; days: { date: string; kind: LeaveKind; pending: boolean }[] }[]
}

export interface Adjustment {
  id: string
  days: number
  reason: string
  createdBy: string | null
  createdAt: string
}

export function useMyLeaveBalance(enabled = true) {
  return useQuery({ queryKey: ['leave', 'me'], queryFn: () => api<LeaveBalance>('/me/leave-balance'), enabled })
}

/** İzin formunda: düşülecek gün, kullanılabilir bakiye, aynı günlerde izinli ekip arkadaşı sayısı. */
export function useLeavePreview(kind: LeaveKind, from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['leave', 'preview', kind, from, to],
    queryFn: () => api<{ days: number; available: number | null; overlap: number }>(`/me/leave-preview?kind=${kind}&from=${from}&to=${to}`),
    enabled: enabled && !!from && !!to && to >= from,
    placeholderData: keepPreviousData,
  })
}

export function useLeaveBalances() {
  return useQuery({ queryKey: ['leave', 'balances'], queryFn: () => api<LeaveBalance[]>('/leave/balances') })
}

export function useLeaveCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['leave', 'calendar', from, to],
    queryFn: () => api<LeaveCalendar>(`/leave/calendar?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  })
}

export function useHolidays(year: number) {
  return useQuery({ queryKey: ['holidays', year], queryFn: () => api<Holiday[]>(`/holidays?year=${year}`), staleTime: 60 * 60_000 })
}

export function useSaveHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; date: string; name: string; isHalfDay: boolean }) =>
      api<Holiday>(id ? `/holidays/${id}` : '/holidays', { method: id ? 'PUT' : 'POST', ...json(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['holidays'] })
      void qc.invalidateQueries({ queryKey: ['leave'] })
    },
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/holidays/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['holidays'] })
      void qc.invalidateQueries({ queryKey: ['leave'] })
    },
  })
}

export function useAdjustments(userId: string | null) {
  return useQuery({
    queryKey: ['leave', 'adjustments', userId],
    queryFn: () => api<Adjustment[]>(`/leave/adjustments?userId=${userId}`),
    enabled: !!userId,
  })
}

export function useAddAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId: string; days: number; reason: string }) => api<Adjustment>('/leave/adjustments', { method: 'POST', ...json(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leave'] }),
  })
}
