import type { TFunction } from 'i18next'

import type { LoginResponse } from '../auth/types'

/**
 * Oturum: kısa ömürlü erişim anahtarı yalnızca bellekte tutulur (sayfa betikleri dışında hiçbir yere yazılmaz).
 * Yenileme anahtarı sunucunun koyduğu HttpOnly çerezdedir; JavaScript onu göremez.
 * Erişim anahtarının süresi dolmadan ya da bir istek 401 alınca /auth/refresh ile sessizce yenisi alınır.
 */
let accessToken: string | null = null
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let refreshing: Promise<LoginResponse | null> | null = null
const listeners = new Set<(res: LoginResponse | null) => void>()

export const session = {
  get token() {
    return accessToken
  },
  /** Oturum değişince (giriş, yenileme, çıkış) haber alır. */
  subscribe(listener: (res: LoginResponse | null) => void) {
    listeners.add(listener)
    return () => void listeners.delete(listener)
  },
  apply(res: LoginResponse) {
    accessToken = res.accessToken
    clearTimeout(refreshTimer)
    // Süresi dolmadan bir dakika önce yenile (setTimeout en fazla ~24 gün bekleyebildiği için üst sınır bir gün).
    const wait = new Date(res.expiresAt).getTime() - Date.now() - 60_000
    refreshTimer = setTimeout(() => void refreshSession(), Math.min(Math.max(wait, 10_000), 86_400_000))
    listeners.forEach((l) => l(res))
  },
  clear() {
    accessToken = null
    clearTimeout(refreshTimer)
    listeners.forEach((l) => l(null))
  },
}

/** Çerezdeki yenileme anahtarıyla yeni erişim anahtarı ister. Aynı anda gelen çağrılar tek isteği paylaşır. */
export function refreshSession(): Promise<LoginResponse | null> {
  refreshing ??= (async () => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } })
      if (!response.ok) {
        // Sunucuya ulaşılamadıysa (5xx) oturum kapatılmaz; yalnızca anahtar geçersizse kapatılır.
        if (response.status === 401 || response.status === 403) session.clear()
        return null
      }
      const res = (await response.json()) as LoginResponse
      session.apply(res)
      return res
    } catch {
      return null
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

/** Sunucudaki oturumu kapatır (çerezdeki anahtar iptal edilir). */
export async function endSession() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
  } catch {
    // Ağ yoksa da yerel oturum kapanır.
  }
  session.clear()
}

/** API'nin döndüğü hata (ASP.NET ProblemDetails + "code"). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Sunucunun döndüğü ProblemDetails (ek alanlar dahil, ör. "missing"). */
  readonly details: Record<string, unknown> | null

  constructor(status: number, code: string, message: string, details: Record<string, unknown> | null = null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Yenileme gerektirmeyen (kendisi oturum açan) uç noktalar. */
const sessionEndpoints = ['/auth/login', '/auth/refresh', '/auth/logout']

/** İsteği gönderir; erişim anahtarının süresi dolmuşsa bir kez yenileyip tekrar dener. */
async function send(path: string, init: RequestInit, accept: string | null): Promise<Response> {
  const attempt = async () => {
    const headers = new Headers(init.headers)
    if (accept) headers.set('Accept', accept)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    try {
      return await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' })
    } catch {
      throw new ApiError(0, 'network', 'Sunucuya ulaşılamadı.')
    }
  }

  let response = await attempt()
  if (response.status === 401 && !sessionEndpoints.includes(path)) {
    if (await refreshSession()) response = await attempt()
    else session.clear()
  }
  return response
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init, 'application/json')

  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    const code: string = problem?.code ?? (problem?.errors ? 'validation' : 'generic')
    throw new ApiError(response.status, code, problem?.title ?? `HTTP ${response.status}`, problem)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

/** Hatayı seçili dilde kullanıcıya gösterilecek metne çevirir. */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`
    // Hata ayrıntıları (ör. "minutes") metne değişken olarak verilir.
    const translated = t(key as never, (error.details ?? {}) as never) as unknown as string
    return translated !== key ? translated : error.message
  }
  return t('errors.generic')
}

/** Dosya indirir (ör. Excel). Token başlıkta gönderildiği için doğrudan bağlantı yerine fetch kullanılır. */
export async function download(path: string, fallbackName: string) {
  const response = await send(path, {}, null)
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new ApiError(response.status, problem?.code ?? 'generic', problem?.title ?? `HTTP ${response.status}`, problem)
  }

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await response.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = decodeURIComponent(name)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
