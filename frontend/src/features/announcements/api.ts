import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, json } from '../../lib/api'

export type CelebrationKind = 'Birthday' | 'WorkAnniversary'

export interface Announcement {
  id: string
  title: string
  body: string | null
  isPinned: boolean
  showOnKiosk: boolean
  expiresOn: string | null
  companyWide: boolean
  authorName: string
  createdAt: string
  updatedAt: string | null
  isActive: boolean
  canEdit: boolean
}

export interface Celebration {
  userId: string
  name: string
  kind: CelebrationKind
  date: string
  daysUntil: number
  years: number | null
  congratulationCount: number
  congratulatedByMe: boolean
  isMe: boolean
}

export interface Feed {
  today: string
  canPost: boolean
  announcements: Announcement[]
  celebrations: Celebration[]
}

export interface AnnouncementInput {
  title: string
  body: string | null
  isPinned: boolean
  showOnKiosk: boolean
  expiresOn: string | null
}

const feedKey = ['announcements', 'feed'] as const

export function useFeed() {
  return useQuery({
    queryKey: feedKey,
    queryFn: () => api<Feed>('/announcements/feed'),
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  })
}

/** Yönetim listesi (süresi dolanlar dahil). Yalnızca yönetici ve müdür. */
export function useAnnouncementList(enabled: boolean) {
  return useQuery({ queryKey: ['announcements', 'all'], queryFn: () => api<Announcement[]>('/announcements'), enabled })
}

export function useSaveAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AnnouncementInput }) =>
      api<Announcement>(id ? `/announcements/${id}` : '/announcements', { method: id ? 'PUT' : 'POST', ...json(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })
}

/** Kutla: sonuç beklenmeden ekranda işaretlenir; hata olursa geri alınır. */
export function useCongratulate() {
  const qc = useQueryClient()
  const patch = (userId: string, kind: CelebrationKind, fn: (c: Celebration) => Celebration) =>
    qc.setQueryData<Feed>(feedKey, (cur) =>
      cur && { ...cur, celebrations: cur.celebrations.map((c) => (c.userId === userId && c.kind === kind ? fn(c) : c)) },
    )
  return useMutation({
    mutationFn: ({ userId, kind }: { userId: string; kind: CelebrationKind }) =>
      api<{ congratulationCount: number }>('/celebrations/congratulate', { method: 'POST', ...json({ userId, kind }) }),
    onMutate: async ({ userId, kind }) => {
      await qc.cancelQueries({ queryKey: feedKey })
      const previous = qc.getQueryData<Feed>(feedKey)
      patch(userId, kind, (c) => ({ ...c, congratulatedByMe: true, congratulationCount: c.congratulationCount + 1 }))
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(feedKey, ctx.previous),
    onSuccess: (r, { userId, kind }) => patch(userId, kind, (c) => ({ ...c, congratulationCount: r.congratulationCount })),
  })
}

/** Panoda öne çıkacak duyurular: sabitlenenler ve son 3 günde yayınlananlar. */
export function highlighted(feed: Feed, now = Date.now()) {
  const recent = now - 3 * 24 * 3600 * 1000
  return feed.announcements.filter((a) => a.isPinned || new Date(a.createdAt).getTime() >= recent)
}
