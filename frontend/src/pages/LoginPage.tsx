import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { roleHome } from '../auth/types'
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

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shake, setShake] = useState(0)

  if (user) return <Navigate to={user.mustChangePassword ? '/sifre-degistir' : roleHome[user.role]} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const loggedIn = await login(email, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(loggedIn.mustChangePassword ? '/sifre-degistir' : (from ?? roleHome[loggedIn.role]), { replace: true })
    } catch (err) {
      setError(errorMessage(err, t))
      setShake((s) => s + 1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <section className="dark relative flex flex-col justify-between gap-8 overflow-hidden bg-brand px-6 py-8 text-on-brand sm:px-12 sm:py-12 lg:min-h-[560px] lg:gap-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-9" />
            <span className="font-display text-2xl font-semibold tracking-wide">PDKS</span>
          </div>
          <span className="board-label hidden text-xs text-on-brand/45 sm:block">{t('login.boardTitle')}</span>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <Greeting className="board-label mb-4 text-xl text-accent" />
          <LiveClock />
          <DayProgress className="mt-10 max-w-md max-lg:hidden" />
        </motion.div>

        <div className="max-w-xl max-lg:hidden">
          <QuoteRotator />
          <p className="mt-6 text-sm text-on-brand/45">{t('login.tagline')}</p>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-4 py-14 sm:px-12">
        <div className="absolute top-4 right-4 flex items-center gap-2 sm:top-6 sm:right-6">
          <ThemeSwitch />
          <LanguageMenu />
        </div>

        <motion.div className="w-full max-w-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <span aria-hidden="true" className="mb-4 block h-1 w-10 bg-accent" />
          <h1 className="font-display text-[2.1rem] leading-none font-semibold">{t('login.title')}</h1>
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

            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="border-l-[3px] border-overrun bg-overrun-soft px-3.5 py-2.5 text-sm text-overrun"
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" className="w-full" loading={submitting} disabled={!email || !password}>
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </motion.form>

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
                    className={`rounded-sm border px-3 py-1 text-sm font-medium transition-colors ${email === acc.email ? 'border-ink bg-ink text-panel' : 'border-line bg-panel hover:border-ink-soft'}`}
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
