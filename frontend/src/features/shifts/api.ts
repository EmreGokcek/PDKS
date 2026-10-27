import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role } from '../../auth/types'
import { api, json } from '../../lib/api'
import type { WeekDayName } from '../../lib/dates'
import type { ShiftKind } from './leave'

export interface ShiftTemplate {
  id: string
  name: string
  startTime: string
  endTime: string
  color: string
  durationMinutes: number
}

export interface Shift {
  id: string
  userId: string
  date: string
  kind: ShiftKind
  startTime: string
  endTime: string
  templateId: string | null
  templateName: string | null
  color: string
  note: string | null
  durationMinutes: number
  /** Boşsa çalışma kurallarındaki günlük mola geçerli. */
  breakMinutes: number | null
}

export interface Planner {
  from: string
  to: string
  weeklyWorkMinutes: number
  dailyBreakMinutes: number
  weekStartsOn: WeekDayName
  staff: { id: string; fullName: string; role: Role; isActive: boolean }[]
  shifts: Shift[]
}

export interface Cell {
  userId: string
  date: string
}

export type AssignInput = { cells: Cell[]; note?: string | null; breakMinutes?: number | null } & (
  | { kind?: 'Work'; templateId: string; startTime?: undefined; endTime?: undefined }
  | { kind?: 'Work'; templateId?: undefined; startTime: string; endTime: string }
  | { kind: Exclude<ShiftKind, 'Work'>; templateId?: undefined; startTime?: undefined; endTime?: undefined }
)

const plannerKey = (from: string) => ['planner', from] as const

export function usePlanner(from: string | null) {
  return useQuery({
    queryKey: plannerKey(from ?? ''),
    queryFn: () => api<Planner>(`/shifts?from=${from}&to=${addSix(from!)}`),
    enabled: !!from,
    placeholderData: (prev) => prev,
  })
}

function addSix(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d! + 6)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function useTemplates() {
  return useQuery({ queryKey: ['shift-templates'], queryFn: () => api<ShiftTemplate[]>('/shift-templates') })
}

const sameCell = (a: Cell, b: Cell) => a.userId === b.userId && a.date === b.date

/**
 * Atama ve silme işlemleri ekranda hemen görünür (iyimser güncelleme);
 * sunucu reddederse önceki hâle dönülür.
 */
export function useAssignShifts(from: string, templates: ShiftTemplate[]) {
  const qc = useQueryClient()
  const key = plannerKey(from)
  return useMutation({
    mutationFn: (input: AssignInput) => api<Shift[]>('/shifts/assign', { method: 'POST', ...json(input) }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Planner>(key)
      if (previous) {
        const kind = input.kind ?? 'Work'
        const tpl = input.templateId ? templates.find((t) => t.id === input.templateId) : undefined
        const start = kind === 'Work' ? (tpl?.startTime ?? input.startTime!) : '00:00:00'
        const end = kind === 'Work' ? (tpl?.endTime ?? input.endTime!) : '00:00:00'
        const optimistic: Shift[] = input.cells.map((c) => ({
          id: `tmp-${c.userId}-${c.date}`,
          userId: c.userId,
          date: c.date,
          kind,
          startTime: start,
          endTime: end,
          templateId: tpl?.id ?? null,
          templateName: tpl?.name ?? null,
          color: tpl?.color ?? '#64748b',
          note: input.note ?? null,
          durationMinutes: 0,
          breakMinutes: kind === 'Work' ? (input.breakMinutes ?? null) : null,
        }))
        qc.setQueryData<Planner>(key, {
          ...previous,
          shifts: [...previous.shifts.filter((s) => !input.cells.some((c) => sameCell(c, s))), ...optimistic],
        })
      }
      return { previous }
    },
    onError: (_err, _input, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
    onSuccess: (saved) => {
      qc.setQueryData<Planner>(key, (current) =>
        current && {
          ...current,
          shifts: [...current.shifts.filter((s) => !saved.some((n) => sameCell(n, s))), ...saved],
        },
      )
    },
  })
}

export function useClearShifts(from: string) {
  const qc = useQueryClient()
  const key = plannerKey(from)
  return useMutation({
    mutationFn: (cells: Cell[]) => api<void>('/shifts/clear', { method: 'POST', ...json({ cells }) }),
    onMutate: async (cells) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Planner>(key)
      if (previous)
        qc.setQueryData<Planner>(key, { ...previous, shifts: previous.shifts.filter((s) => !cells.some((c) => sameCell(c, s))) })
      return { previous }
    },
    onError: (_err, _cells, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
  })
}

export function useCopyWeek() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { fromWeekStart: string; toWeekStart: string; overwrite: boolean }) =>
      api<{ copied: number; skipped: number }>('/shifts/copy-week', { method: 'POST', ...json(input) }),
    onSuccess: (_r, input) => qc.invalidateQueries({ queryKey: plannerKey(input.toWeekStart) }),
  })
}

export function useSaveTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; startTime: string; endTime: string; color: string }) =>
      api<ShiftTemplate>(id ? `/shift-templates/${id}` : '/shift-templates', { method: id ? 'PUT' : 'POST', ...json(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-templates'] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/shift-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-templates'] }),
  })
}

export function useMyShifts(from: string, to: string) {
  return useQuery({ queryKey: ['my-shifts', from, to], queryFn: () => api<Shift[]>(`/me/shifts?from=${from}&to=${to}`) })
}
