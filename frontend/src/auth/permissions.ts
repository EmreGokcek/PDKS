import type { Role, User } from './types'

/**
 * Arayüzdeki yetki kuralları. Sunucudaki kuralların (AccessScope) aynısıdır; arayüz yalnızca
 * izin verilmeyen düğmeleri gizler, asıl kontrol sunucudadır. Tablo: docs/YETKILER.md
 */
export const can = {
  /** Kayıt düzeltme: yönetici kendisi dışında herkesi, müdür yalnızca şubesindeki personeli. */
  editRecordsOf: (viewer: User, target: { userId: string; role: Role }) =>
    viewer.id !== target.userId && (viewer.role === 'Admin' || (viewer.role === 'Manager' && target.role === 'Employee')),
  manageStaff: (viewer: User) => viewer.role === 'Admin',
  changeWorkRules: (viewer: User) => viewer.role === 'Admin',
  planShifts: (viewer: User) => viewer.role === 'Admin' || viewer.role === 'Manager',
  postAnnouncements: (viewer: User) => viewer.role === 'Admin' || viewer.role === 'Manager',
  viewAuditLog: (viewer: User) => viewer.role === 'Admin',
}
