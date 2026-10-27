import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role } from '../../auth/types'
import { api, json } from '../../lib/api'

export const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'] as const

export interface Profile {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: Role
  companyName: string
  branchName: string | null
  employeeNumber: string | null
  position: string | null
  hireDate: string | null
  phone: string | null
  address: string | null
  birthDate: string | null
  bloodType: string | null
  healthDataConsentAt: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
}

export interface ProfileInput {
  phone: string | null
  address: string | null
  birthDate: string | null
  bloodType: string | null
  healthDataConsent: boolean
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
}

export function useMyProfile() {
  return useQuery({ queryKey: ['profile', 'me'], queryFn: () => api<Profile>('/me/profile') })
}

export function useStaffProfile(id: string | null) {
  return useQuery({ queryKey: ['profile', id], queryFn: () => api<Profile>(`/users/${id}/profile`), enabled: !!id })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProfileInput) => api<Profile>('/me/profile', { method: 'PUT', ...json(input) }),
    onSuccess: (data) => qc.setQueryData(['profile', 'me'], data),
  })
}

/** Kan grubunu Türkçe yazımla gösterir: "A+" → "A Rh+". */
export const bloodLabel = (b: string) => b.replace('+', ' Rh+').replace('-', ' Rh-')

/** Kişinin kendi doldurabildiği alanların doluluk oranı. */
export function completeness(p: Profile) {
  const fields = [p.phone, p.address, p.birthDate, p.emergencyContactName, p.emergencyContactPhone]
  return Math.round((fields.filter(Boolean).length / fields.length) * 100)
}
