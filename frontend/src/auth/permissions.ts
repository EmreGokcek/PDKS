import type { Role, User } from './types'

/**
 * Kişi bazlı kurallar (sunucudaki AccessScope ile aynı). Sayfa yetkileri types.ts'teki can() ile,
 * "bu kişinin kaydını düzeltebilir mi" gibi kişiye bağlı kurallar burada. Arayüz yalnızca düğmeyi gizler,
 * asıl kontrol sunucudadır. Tablo: docs/YETKILER.md
 */
export function canEditRecordsOf(viewer: User, target: { userId: string; role: Role }): boolean {
  if (viewer.id === target.userId || !viewer.permissions.includes('attendance.correct')) return false
  switch (viewer.role) {
    case 'Admin':
      return true
    case 'HumanResources':
      return target.role === 'Employee' || target.role === 'Manager'
    case 'Manager':
      return target.role === 'Employee'
    default:
      return false
  }
}
