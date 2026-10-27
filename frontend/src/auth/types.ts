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
}

export interface LoginResponse {
  accessToken: string
  expiresAt: string
  user: User
}

export const roleLabels: Record<Role, string> = {
  Admin: 'Yönetici',
  Manager: 'Müdür',
  Employee: 'Personel',
  Kiosk: 'Giriş kiosku',
}

/** Girişten sonra her rolün açılacağı sayfa. */
export const roleHome: Record<Role, string> = {
  Admin: '/admin',
  Manager: '/mudur',
  Employee: '/personel',
  Kiosk: '/kiosk',
}
