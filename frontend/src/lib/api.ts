import type { TFunction } from 'i18next'

const TOKEN_KEY = 'pdks.token'

export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** API'nin döndüğü hata (ASP.NET ProblemDetails + "code"). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Oturum süresi dolduğunda AuthProvider bu fonksiyonu tetikler. */
let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const token = tokenStorage.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'network', 'Sunucuya ulaşılamadı.')
  }

  if (response.status === 401 && token) onUnauthorized?.()

  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    const code: string = problem?.code ?? (problem?.errors ? 'validation' : 'generic')
    throw new ApiError(response.status, code, problem?.title ?? `HTTP ${response.status}`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

/** Hatayı seçili dilde kullanıcıya gösterilecek metne çevirir. */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`
    const translated = t(key as never) as unknown as string
    return translated !== key ? translated : error.message
  }
  return t('errors.generic')
}
