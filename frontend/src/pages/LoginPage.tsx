import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { roleHome, type User } from '../auth/types'
import { DayProgress, Greeting, LiveClock } from '../components/LiveClock'
import { QuoteRotator } from '../components/QuoteRotator'
import { LanguageMenu, ThemeSwitch } from '../components/PreferencesControls'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { errorMessage } from '../lib/api'

/** Geliştirme ortamındaki demo hesaplar (seed). Üretim derlemesinde gösterilmez. */
const demoAccounts = [
  { role: 'Admin', email: 'admin@pdks.local' },
  { role: 'Manager', email: 'mudur@pdks.local' },
  { role: 'Employee', email: 'personel@pdks.local' },
  { role: 'Kiosk', email: 'kiosk@pdks.local' },
] as const
const DEMO_PASSWORD = 'Pdks123!'

/** Girişten sonra gidilecek yer: önce şifre belirleme, sonra aydınlatma metni, sonra istenen sayfa. */
function afterLogin(user: User, from?: string) {
  if (user.mustChangePassword) return '/sifre-degistir'
  if (!user.privacyNoticeAccepted) return '/aydinlatma'
  return from ?? roleHome[user.role]
}

const ease = [0.22, 1, 0.36, 1] as const

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shake, setShake] = useState(0)

  if (user) return <Navigate to={afterLogin(user)} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedIn = await login(email, password, rememberMe)
      const from = (location.state as { from?: string } | null)?.from
      navigate(afterLogin(loggedIn, from), { replace: true })
    } catch (err) {
      setError(errorMessage(err, t))
      setShake((s) => s + 1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <section className="relative flex flex-col justify-between gap-8 overflow-hidden bg-brand px-6 py-8 text-on-brand sm:px-12 sm:py-12 lg:min-h-[560px] lg:gap-10">
        {/* Arka planda yavaşça dolaşan iki ışık halesi */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 size-[34rem] rounded-full bg-signal/20 blur-3xl"
          animate={{ x: [0, 120, 40, 0], y: [0, 80, 160, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-48 -bottom-48 size-[30rem] rounded-full bg-[#2f80ed]/15 blur-3xl"
          animate={{ x: [0, -100, -20, 0], y: [0, -120, -40, 0] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Kart okutma çizgisini anımsatan ince tarama ışığı */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-signal/60 to-transparent"
          initial={{ top: '0%' }}
          animate={{ top: ['8%', '92%', '8%'] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="relative flex items-center gap-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <img src="/favicon.svg" alt="" className="size-9 rounded-xl ring-1 ring-on-brand/20" />
          <span className="text-lg font-semibold">PDKS</span>
        </motion.div>

        <motion.div className="relative" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1, ease }}>
          <Greeting className="mb-3 text-xl font-medium text-signal" />
          <LiveClock />
          <DayProgress className="mt-8 max-w-sm max-lg:hidden" />
        </motion.div>

        <motion.div className="relative max-w-lg max-lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}>
          <QuoteRotator />
          <p className="mt-8 text-sm text-on-brand/45">{t('login.tagline')}</p>
        </motion.div>
      </section>

      <section className="relative flex items-center justify-center px-4 py-14 sm:px-12">
        <div className="absolute top-4 right-4 flex items-center gap-2 sm:top-6 sm:right-6">
          <ThemeSwitch />
          <LanguageMenu />
        </div>

        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h1>
          <p className="mt-1.5 text-ink-soft">{t('login.subtitle')}</p>

          <motion.form
            key={shake}
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
            noValidate
            animate={shake ? { x: [0, -8, 7, -5, 3, 0] } : undefined}
            transition={{ duration: 0.4 }}
          >
            <Field label={t('login.email')}>
              {(p) => (
                <Input {...p} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
            <Field label={t('login.password')}>
              {(p) => (
                <Input
                  {...p}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-signal)]"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>
                {t('login.rememberMe')}
                <span className="block text-ink-soft">{t('login.rememberMeHint')}</span>
              </span>
            </label>

            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl bg-overrun-soft px-3.5 py-2.5 text-sm text-overrun"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" className="w-full" loading={submitting} disabled={!email || !password}>
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </motion.form>

          <p className="mt-6 text-xs text-ink-soft">
            <Link to="/kvkk" className="underline underline-offset-4 hover:text-ink">
              {t('privacy.link')}
            </Link>
          </p>

          {import.meta.env.DEV && (
            <div className="mt-10 border-t border-line pt-6">
              <p className="text-sm text-ink-soft">{t('login.demo', { password: DEMO_PASSWORD })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email)
                      setPassword(DEMO_PASSWORD)
                      setError(null)
                    }}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${email === acc.email ? 'border-signal bg-signal-soft text-signal' : 'border-line bg-panel hover:border-ink-soft'}`}
                  >
                    {t(`roles.${acc.role}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </section>
    </div>
  )
}
