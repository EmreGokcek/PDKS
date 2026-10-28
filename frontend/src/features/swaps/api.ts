import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, json } from '../../lib/api'
import type { ShiftKind } from '../shifts/leave'

export type SwapStatus = 'PendingPeer' | 'PendingManager' | 'Approved' | 'Rejected' | 'Declined' | 'Cancelled' | 'Expired'

export interface SwapShift {
  kind: ShiftKind
  startTime: string
  endTime: string
  templateName: string | null
}

export interface ShiftSwap {
  id: string
  date: string
  status: SwapStatus
  requesterId: string
  requesterName: string
  requesterShift: SwapShift | null
  targetUserId: string
  targetName: string
  targetShift: SwapShift | null
  note: string | null
  reviewedBy: string | null
  reviewNote: string | null
  createdAt: string
}

export interface SwapCandidate {
  userId: string
  name: string
  shift: SwapShift | null
  available: boolean
  reason: 'on_leave' | 'same_shift' | 'already_requested' | 'overlap' | null
}

export const isOpen = (s: ShiftSwap) => s.status === 'PendingPeer' || s.status === 'PendingManager'

export function useMySwaps() {
  return useQuery({ queryKey: ['swaps', 'mine'], queryFn: () => api<ShiftSwap[]>('/me/swaps') })
}

export function useSwapCandidates(shiftId: string | null) {
  return useQuery({
    queryKey: ['swaps', 'candidates', shiftId],
    queryFn: () => api<SwapCandidate[]>(`/me/swaps/candidates?shiftId=${shiftId}`),
    enabled: !!shiftId,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['swaps'] })
    void qc.invalidateQueries({ queryKey: ['my-shifts'] })
  }
}

export function useCreateSwap() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: (body: { shiftId: string; targetUserId: string; note: string | null }) => api<ShiftSwap>('/me/swaps', { method: 'POST', ...json(body) }),
    onSuccess: done,
  })
}

export function useSwapAction() {
  const done = useInvalidate()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accept' | 'decline' | 'cancel' }) => api<ShiftSwap>(`/me/swaps/${id}/${action}`, { method: 'POST' }),
    onSuccess: done,
  })
}

export function useTeamSwaps(pendingOnly: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['swaps', 'team', pendingOnly],
    queryFn: () => api<ShiftSwap[]>(`/swaps?pendingOnly=${pendingOnly}`),
    enabled,
  })
}

export function useReviewSwap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note: string | null }) =>
      api<ShiftSwap>(`/swaps/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', ...json({ note }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['swaps'] })
      void qc.invalidateQueries({ queryKey: ['planner'] })
    },
  })
}
