import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { roleHome } from '../auth/types'
import { LiveClock } from '../components/LiveClock'
import { ApiError } from '../lib/api'

/** Geliştirme ortamındaki demo hesaplar (seed). Üretim derlemesinde gösterilmez. */
const demoAccounts = [
  { label: 'Yönetici', email: 'admin@pdks.local' },
  { label: 'Müdür', email: 'mudur@pdks.local' },
  { label: 'Personel', email: 'personel@pdks.local' },
  { label: 'Kiosk', email: 'kiosk@pdks.local' },
]
const DEMO_PASSWORD = 'Pdks123!'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={roleHome[user.role]} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedIn = await login(email, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? roleHome[loggedIn.role], { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Giriş yapılamadı.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.2fr_1fr]">
      <section className="flex flex-col justify-between bg-ink px-6 py-8 text-paper sm:px-12 sm:py-12">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-9 rounded-lg ring-1 ring-paper/20" />
          <span className="text-lg font-semibold">PDKS</span>
        </div>
        <LiveClock className="my-10 lg:my-0" />
        <p className="max-w-sm text-paper/70">Giriş, çıkış ve molalar tek okutmayla kayıt altında.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Hesabına giriş yap</h1>
          <p className="mt-1 text-ink-soft">Yöneticinin sana verdiği e-posta ve şifreyi kullan.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                E-posta
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line bg-panel px-3 py-2.5 focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line bg-panel px-3 py-2.5 focus:border-signal focus:outline-none"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-overrun-soft px-3 py-2 text-sm text-overrun">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="w-full rounded-lg bg-signal px-4 py-2.5 font-semibold text-white hover:brightness-95 disabled:opacity-50"
            >
              {submitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-10 border-t border-line pt-6">
              <p className="text-sm text-ink-soft">Demo hesaplarla dene (şifre: {DEMO_PASSWORD})</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email)
                      setPassword(DEMO_PASSWORD)
                    }}
                    className="rounded-full border border-line bg-panel px-3 py-1 text-sm hover:border-ink-soft"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
