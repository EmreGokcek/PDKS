export type Role = 'Admin' | 'Manager' | 'HumanResources' | 'Employee' | 'Kiosk'

/** Sunucudaki yetki adları (backend/src/Pdks.Domain/Security/Permissions.cs). Tablo: docs/YETKILER.md */
export type Permission =
  | 'attendance.self'
  | 'dashboard.view'
  | 'shifts.plan'
  | 'reports.view'
  | 'timesheet.view'
  | 'requests.review'
  | 'attendance.correct'
  | 'staff.view'
  | 'staff.manage'
  | 'rules.view'
  | 'rules.manage'
  | 'announcements.post'
  | 'audit.view'
  | 'leave.manage'
  | 'company.manage'
  | 'kiosk'

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
  /** İlk girişte istenen profil bilgileri (telefon, doğum tarihi, acil durum kişisi) dolu mu. */
  profileComplete: boolean
  /** Bu kullanıcının yetkileri; menü ve düğmeler buna göre gösterilir. */
  permissions: Permission[]
  /** Tüm firmanın verisini görür (yönetici, İK); değilse yalnızca kendi şubesini (müdür). */
  companyWide: boolean
}

export interface LoginResponse {
  accessToken: string
  expiresAt: string
  user: User
}

/** Her rolün sayfalarının adres öneki. */
export const basePath: Record<Role, string> = {
  Admin: '/admin',
  Manager: '/mudur',
  HumanResources: '/ik',
  Employee: '/personel',
  Kiosk: '/kiosk',
}

/** Girişten sonra her rolün açılacağı sayfa. */
export const roleHome: Record<Role, string> = {
  Admin: '/admin',
  Manager: '/mudur',
  HumanResources: '/ik',
  Employee: '/personel',
  Kiosk: '/kiosk',
}

/** Kullanıcı bu yetkiye sahip mi? */
export const can = (user: Pick<User, 'permissions'> | null | undefined, permission: Permission) =>
  !!user?.permissions.includes(permission)

/** Yetki gerektiren bir sayfanın adresi (rolün önekiyle). */
export const pathFor = (role: Role, segment: string) => `${basePath[role]}/${segment}`

/** Kendi giriş-çıkış sayfaları: personelde ana sayfa, panosu olanlarda "bugunum". */
export const myDayPath = (user: Pick<User, 'role' | 'permissions'>) =>
  can(user, 'dashboard.view') ? pathFor(user.role, 'bugunum') : basePath[user.role]

/** Personel eklerken / düzenlerken atanabilecek roller (sunucudaki kuralın aynısı; İK yönetici atayamaz). */
export function assignableRoles(role: Role | undefined): Exclude<Role, 'Kiosk'>[] {
  if (role === 'Admin') return ['Employee', 'Manager', 'HumanResources', 'Admin']
  if (role === 'HumanResources') return ['Employee', 'Manager', 'HumanResources']
  return []
}
