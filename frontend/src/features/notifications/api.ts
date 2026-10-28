import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, json } from '../../lib/api'

export type NotificationType =
  | 'ShiftWeekPublished'
  | 'ShiftChanged'
  | 'RequestCreated'
  | 'RequestApproved'
  | 'RequestRejected'
  | 'RecordCorrected'
  | 'AnnouncementPublished'
  | 'Congratulated'
  | 'SwapRequested'
  | 'SwapUpdated'
  | 'SwapNeedsApproval'

export interface AppNotification {
  id: string
  type: NotificationType
  data: Record<string, unknown> | null
  createdAt: string
  isRead: boolean
}

const key = ['notifications'] as const

export function useNotifications() {
  return useQuery({
    queryKey: key,
    queryFn: () => api<{ unreadCount: number; items: AppNotification[] }>('/me/notifications?take=30'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[] | null) => api<void>('/me/notifications/read', { method: 'POST', ...json({ ids }) }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key })
      qc.setQueryData<{ unreadCount: number; items: AppNotification[] }>(key, (cur) => {
        if (!cur) return cur
        const items = cur.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, isRead: true } : n))
        return { unreadCount: items.filter((n) => !n.isRead).length, items }
      })
    },
  })
}
