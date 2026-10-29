import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PasswordRules, usePasswordRules } from '../../components/PasswordRules'
import { LanguageMenu, ThemeSwitch } from '../../components/PreferencesControls'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { api, errorMessage, json } from '../../lib/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Frame({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-16">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeSwitch />
        <LanguageMenu />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <Link to="/giris" className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink">
          <ArrowLeft className="size-4" />
          {t('register.backToLogin')}
        </Link>
        <div className="mt-6 rounded-3xl bg-panel p-7 shadow-pop ring-1 ring-line sm:p-9">
          <img src="/favicon.svg" alt="" className="size-10 rounded-xl" />
          {children}
        </div>
      </motion.div>
    </div>
  )
}

/** "Şifremi unuttum": e-posta adresine sıfırlama bağlantısı ister. Hesap olsun olmasın aynı yanıt gösterilir. */
export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const send = useMutation({
    mutationFn: (address: string) => api<void>('/auth/forgot-password', { method: 'POST', ...json({ email: address }) }),
    onSuccess: (_, address) => setSentTo(address),
    onError: (err) => setError(errorMessage(err, t)),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!EMAIL_RE.test(address)) return setError(t('errors.email'))
    setError(null)
    send.mutate(address)
  }

  if (sentTo) {
    return (
      <Frame>
        <span className="mt-6 grid size-12 place-items-center rounded-2xl bg-signal-soft text-signal">
          <MailCheck className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t('forgot.sentTitle')}</h1>
        <p className="mt-2 text-ink-soft">{t('forgot.sent', { email: sentTo })}</p>
        <ul className="mt-5 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>{t('forgot.tipSpam')}</li>
          <li>{t('forgot.tipExpiry')}</li>
          <li>{t('forgot.tipKiosk')}</li>
        </ul>
        <Button variant="secondary" className="mt-7 w-full" onClick={() => setSentTo(null)}>
          {t('forgot.again')}
        </Button>
      </Frame>
    )
  }

  return (
    <Frame>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('forgot.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('forgot.subtitle')}</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <Field label={t('login.email')} error={error ?? undefined}>
          {(p) => (
            <Input
              {...p}
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
            />
          )}
        </Field>
        <Button type="submit" className="w-full" loading={send.isPending} disabled={!email}>
          {t('forgot.submit')}
        </Button>
      </form>
    </Frame>
  )
}

/** E-postadaki bağlantının açtığı sayfa: yeni şifre belirlenir, sonra giriş ekranına dönülür. */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(!token)

  const reset = useMutation({
    mutationFn: () => api<void>('/auth/reset-password', { method: 'POST', ...json({ token, newPassword: password }) }),
    onSuccess: () => {
      toast.success(t('reset.done'))
      navigate('/giris', { replace: true })
    },
    onError: (err) => {
      if ((err as { code?: string }).code === 'invalid_reset_token') setExpired(true)
      else setError(errorMessage(err, t))
    },
  })

  const rules = usePasswordRules(password, confirm)
  const valid = rules.every((r) => r.ok)

  if (expired) {
    return (
      <Frame>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('reset.expiredTitle')}</h1>
        <p className="mt-2 text-ink-soft">{t('reset.expired')}</p>
        <Button className="mt-7 w-full" onClick={() => navigate('/sifremi-unuttum')}>
          {t('reset.newLink')}
        </Button>
      </Frame>
    )
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (valid) reset.mutate()
  }

  return (
    <Frame>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('reset.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('reset.subtitle')}</p>
      <form onSubmit={submit} noValidate className="mt-8 space-y-5">
        <Field label={t('changePassword.next')}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label={t('changePassword.confirm')}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <PasswordRules rules={rules} />
        {error && (
          <p role="alert" className="rounded-xl bg-overrun-soft px-3.5 py-2.5 text-sm text-overrun">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={!valid} loading={reset.isPending}>
          {t('reset.submit')}
        </Button>
      </form>
    </Frame>
  )
}
