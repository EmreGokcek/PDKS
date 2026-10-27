import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, json } from '../../lib/api'
import type { AttendanceAction } from '../attendance/api'
import type { LeaveKind } from '../shifts/leave'

export type RequestType = 'Correction' | 'Leave'
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

export interface StaffRequest {
  id: string
  userId: string
  userName: string
  type: RequestType
  status: RequestStatus
  eventType: AttendanceAction | null
  eventAt: string | null
  leaveKind: LeaveKind | null
  startDate: string | null
  endDate: string | null
  dayCount: number | null
  reason: string
  createdAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

export type NewRequest =
  | { type: 'Correction'; eventType: AttendanceAction; date: string; time: string; reason: string }
  | { type: 'Leave'; leaveKind: LeaveKind; startDate: string; endDate: string; reason: string }

export function useMyRequests() {
  return useQuery({ queryKey: ['requests', 'mine'], queryFn: () => api<StaffRequest[]>('/me/requests') })
}

export function useCreateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NewRequest) => api<StaffRequest>('/me/requests', { method: 'POST', ...json(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

export function useCancelRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<StaffRequest>(`/me/requests/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

export function useTeamRequests(status: RequestStatus | null) {
  return useQuery({
    queryKey: ['requests', 'team', status],
    queryFn: () => api<StaffRequest[]>(`/requests${status ? `?status=${status}` : ''}`),
  })
}

export function usePendingCount(enabled: boolean) {
  return useQuery({
    queryKey: ['requests', 'pending-count'],
    queryFn: () => api<number>('/requests/pending-count'),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note: string }) =>
      api<StaffRequest>(`/requests/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', ...json({ note: note || null }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['requests'] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['planner'] })
    },
  })
}
