import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, json } from '../../lib/api'

export interface BranchSettings {
  id: string
  name: string
  timeZone: string
  isActive: boolean
  staffCount: number
  kioskCount: number
}

export interface KioskInfo {
  id: string
  name: string
  branchId: string
  branchName: string | null
  email: string
  isActive: boolean
  lastLoginAt: string | null
  lastSeenAt: string | null
}

export interface CompanySettings {
  id: string
  name: string
  branches: BranchSettings[]
  kiosks: KioskInfo[]
}

export interface KioskWithPassword {
  kiosk: KioskInfo
  password: string
}

const key = ['company'] as const

export function useCompany() {
  return useQuery({ queryKey: key, queryFn: () => api<CompanySettings>('/company') })
}

function useCompanyMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key })
      // Şube adı / listesi başka sayfalarda da kullanılıyor.
      void qc.invalidateQueries({ queryKey: ['branches'] })
    },
  })
}

export const useRenameCompany = () =>
  useCompanyMutation((name: string) => api<void>('/company', { method: 'PUT', ...json({ name }) }))

export const useSaveBranch = () =>
  useCompanyMutation((v: { id?: string; name: string; timeZone: string; isActive: boolean }) =>
    v.id
      ? api<BranchSettings>(`/company/branches/${v.id}`, { method: 'PUT', ...json(v) })
      : api<BranchSettings>('/company/branches', { method: 'POST', ...json(v) }),
  )

export const useCreateKiosk = () =>
  useCompanyMutation((v: { name: string; branchId: string }) => api<KioskWithPassword>('/company/kiosks', { method: 'POST', ...json(v) }))

export const useUpdateKiosk = () =>
  useCompanyMutation((v: { id: string; name: string; branchId: string }) =>
    api<KioskInfo>(`/company/kiosks/${v.id}`, { method: 'PUT', ...json({ name: v.name, branchId: v.branchId }) }),
  )

export const useResetKiosk = () =>
  useCompanyMutation((id: string) => api<KioskWithPassword>(`/company/kiosks/${id}/reset-password`, { method: 'POST' }))

export const useToggleKiosk = () =>
  useCompanyMutation((v: { id: string; active: boolean }) =>
    api<KioskInfo>(`/company/kiosks/${v.id}/${v.active ? 'activate' : 'deactivate'}`, { method: 'POST' }),
  )
