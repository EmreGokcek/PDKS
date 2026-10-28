import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from './AuthContext'
import { roleHome, type Role } from './types'

/**
 * Sayfayı sadece izin verilen rollere açar; diğerlerini kendi ana sayfasına gönderir.
 * Geçici şifreyle giriş yapan kullanıcı önce şifre değiştirme ekranına yönlendirilir.
 */
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageLoader />
  if (!user) return <Navigate to="/giris" replace state={{ from: location.pathname + location.search }} />

  if (user.mustChangePassword && location.pathname !== '/sifre-degistir')
    return <Navigate to="/sifre-degistir" replace />

  // Şifre belirlendikten sonra, güncel aydınlatma metni okunmadıysa önce o gösterilir.
  if (!user.mustChangePassword && !user.privacyNoticeAccepted && location.pathname !== '/aydinlatma')
    return <Navigate to="/aydinlatma" replace />

  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome[user.role]} replace />

  return children
}

export function FullPageLoader() {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-dvh place-items-center text-ink-soft" role="status">
      <div className="flex items-center gap-3">
        <Spinner />
        {t('common.loading')}
      </div>
    </div>
  )
}
