import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, endSession, json, refreshSession, session } from '../lib/api'
import type { LoginResponse, User } from './types'

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string, rememberMe: boolean) => Promise<User>
  /** Şifre değiştirme gibi yeni token dönen işlemlerden sonra oturumu günceller. */
  applyLogin: (response: LoginResponse) => void
  /** Sunucudan dönen güncel kullanıcı bilgisini uygular (ör. KVKK onayı sonrası). */
  updateUser: (user: User) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Eski sürümlerde erişim anahtarı tarayıcı deposunda tutuluyordu; artık tutulmuyor. */
function removeLegacyToken() {
  try {
    localStorage.removeItem('pdks.token')
  } catch {
    // depolama kapalıysa yapılacak bir şey yok
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setLoading] = useState(true)

  // Oturum her değiştiğinde (giriş, sessiz yenileme, süre dolması) kullanıcıyı güncelle.
  useEffect(
    () =>
      session.subscribe((res) => {
        setUser(res?.user ?? null)
        if (!res) queryClient.clear()
      }),
    [queryClient],
  )

  // Sayfa açılınca çerezdeki oturumla devam etmeyi dene.
  useEffect(() => {
    removeLegacyToken()
    let cancelled = false
    void refreshSession().finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const applyLogin = useCallback((res: LoginResponse) => session.apply(res), [])

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    const res = await api<LoginResponse>('/auth/login', { method: 'POST', ...json({ email, password, rememberMe }) })
    session.apply(res)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    await endSession()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({ user, isLoading, login, applyLogin, updateUser: setUser, logout }),
    [user, isLoading, login, applyLogin, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı.')
  return ctx
}
