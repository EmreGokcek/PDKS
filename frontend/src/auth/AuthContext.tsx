import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, json, setUnauthorizedHandler, tokenStorage } from '../lib/api'
import type { LoginResponse, User } from './types'

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  /** Şifre değiştirme gibi yeni token dönen işlemlerden sonra oturumu günceller. */
  applyLogin: (response: LoginResponse) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => tokenStorage.get())

  // Kayıtlı token varsa sayfa yenilendiğinde kullanıcıyı sunucudan doğrula.
  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => api<User>('/auth/me'),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  })

  const logout = useCallback(() => {
    tokenStorage.clear()
    setToken(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const applyLogin = useCallback(
    (res: LoginResponse) => {
      tokenStorage.set(res.accessToken)
      queryClient.setQueryData(['me', res.accessToken], res.user)
      setToken(res.accessToken)
    },
    [queryClient],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<LoginResponse>('/auth/login', { method: 'POST', ...json({ email, password }) })
      applyLogin(res)
      return res.user
    },
    [applyLogin],
  )

  const value = useMemo<AuthState>(
    () => ({
      user: token ? (me.data ?? null) : null,
      isLoading: !!token && me.isPending,
      login,
      applyLogin,
      logout,
    }),
    [token, me.data, me.isPending, login, applyLogin, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı.')
  return ctx
}
