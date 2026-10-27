import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role } from '../../auth/types'
import { api, json } from '../../lib/api'

export type ManagedRole = Exclude<Role, 'Kiosk'>

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  employeeNumber: string | null
  role: ManagedRole
  branchId: string | null
  branchName: string | null
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  position: string | null
  hireDate: string | null
}

export interface StaffInput {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  employeeNumber: string | null
  role: ManagedRole
  branchId: string | null
  position: string | null
  hireDate: string | null
}

export interface StaffWithPassword {
  user: StaffMember
  temporaryPassword: string
}

export interface StaffFilters {
  search: string
  role: ManagedRole | 'all'
  status: 'active' | 'inactive' | 'all'
}

const keys = {
  all: ['users'] as const,
  list: (f: StaffFilters) => ['users', 'list', f] as const,
}

export function useStaffList(filters: StaffFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search.trim()) params.set('search', filters.search.trim())
      if (filters.role !== 'all') params.set('role', filters.role)
      if (filters.status !== 'all') params.set('isActive', String(filters.status === 'active'))
      const qs = params.toString()
      return api<StaffMember[]>(`/users${qs ? `?${qs}` : ''}`)
    },
    placeholderData: keepPreviousData,
  })
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => api<{ id: string; name: string }[]>('/branches'),
    staleTime: 5 * 60_000,
  })
}

function useInvalidateUsers() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: keys.all })
}

export function useCreateStaff() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: StaffInput) => api<StaffWithPassword>('/users', { method: 'POST', ...json(input) }),
    onSuccess: invalidate,
  })
}

export function useUpdateStaff() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StaffInput }) =>
      api<StaffMember>(`/users/${id}`, { method: 'PUT', ...json(input) }),
    onSuccess: invalidate,
  })
}

export function useSetStaffActive() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api<StaffMember>(`/users/${id}/${active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}

export function useResetStaffPassword() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: string) => api<StaffWithPassword>(`/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: invalidate,
  })
}
