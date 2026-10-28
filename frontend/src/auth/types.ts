export type Role = 'Admin' | 'Manager' | 'Employee' | 'Kiosk'

export interface User {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: Role
  companyId: string
  companyName: string
  branchId: string | null
  branchName: string | null
  mustChangePassword: boolean
  /** Güncel KVKK aydınlatma metni onaylandı mı. */
  privacyNoticeAccepted: boolean
}

export interface LoginResponse {
  accessToken: string
  expiresAt: string
  user: User
}

/** Girişten sonra her rolün açılacağı sayfa. */
export const roleHome: Record<Role, string> = {
  Admin: '/admin/pano',
  Manager: '/mudur',
  Employee: '/personel',
  Kiosk: '/kiosk',
}
