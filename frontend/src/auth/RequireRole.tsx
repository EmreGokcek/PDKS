import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { roleHome, type Role } from './types'

/** Sayfayı sadece izin verilen rollere açar; diğerlerini kendi ana sayfasına gönderir. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <FullPageMessage text="Oturum kontrol ediliyor…" />
  if (!user) return <Navigate to="/giris" replace state={{ from: location.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to={roleHome[user.role]} replace />

  return children
}

export function FullPageMessage({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-ink-soft" role="status">
      {text}
    </div>
  )
}
