import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Building2, Check, UserRound } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { afterLoginPath, type LoginResponse } from '../../auth/types'
import { LanguageMenu, ThemeSwitch } from '../../components/PreferencesControls'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { ApiError, api, errorMessage, json } from '../../lib/api'
import { NOTICE_VERSION } from '../privacy/notice'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Form {
  companyName: string
  branchName: string
  firstName: string
  lastName: string
  email: string
  password: string
}

const empty: Form = { companyName: '', branchName: '', firstName: '', lastName: '', email: '', password: '' }

/**
 * Firma kendi kendine kayıt: firma + ilk şube + yönetici hesabı.
 * Kayıttan sonra kişi doğrudan oturum açmış olur; profilini tamamlayıp panele geçer.
 */
export function RegisterPage() {
  const { t } = useTranslation()
  const { user, applyLogin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(empty)
  const [accepted, setAccepted] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Form | 'accepted', string>>>({})
  const [error, setError] = useState<string | null>(null)

  const register = useMutation({
    mutationFn: () =>
      api<LoginResponse>('/auth/register', {
        method: 'POST',
        ...json({ ...form, branchName: form.branchName.trim() || null, privacyNoticeVersion: NOTICE_VERSION }),
      }),
    onSuccess: (res) => {
      applyLogin(res)
      navigate(afterLoginPath(res.user), { replace: true })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'email_taken') setErrors({ email: errorMessage(err, t) })
      else setError(errorMessage(err, t))
    },
  })

  if (user) return <Navigate to={afterLoginPath(user)} replace />

  const set = (key: keyof Form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const rules = [
    { ok: form.password.length >= 8, label: t('changePassword.ruleLength') },
    { ok: /\p{L}/u.test(form.password), label: t('changePassword.ruleLetter') },
    { ok: /\d/.test(form.password), label: t('changePassword.ruleDigit') },
  ]

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const found: typeof errors = {}
    if (form.companyName.trim().length < 2) found.companyName = t('errors.required')
    if (!form.firstName.trim()) found.firstName = t('errors.required')
    if (!form.lastName.trim()) found.lastName = t('errors.required')
    if (!form.email.trim()) found.email = t('errors.required')
    else if (!EMAIL_RE.test(form.email.trim())) found.email = t('errors.email')
    if (!rules.every((r) => r.ok)) found.password = t('register.passwordRules')
    if (!accepted) found.accepted = t('register.acceptRequired')
    setErrors(found)
    if (Object.keys(found).length === 0) register.mutate()
  }

  return (
    <div className="relative min-h-dvh px-4 py-16 sm:py-20">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeSwitch />
        <LanguageMenu />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-xl"
      >
        <Link to="/giris" className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink">
          <ArrowLeft className="size-4" />
          {t('register.backToLogin')}
        </Link>

        <div className="mt-6 rounded-3xl bg-panel p-7 shadow-pop ring-1 ring-line sm:p-9">
          <img src="/favicon.svg" alt="" className="size-10 rounded-xl" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('register.title')}</h1>
          <p className="mt-2 text-ink-soft">{t('register.subtitle')}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8" noValidate>
            <Section icon={<Building2 className="size-4" />} title={t('register.companySection')}>
              <Field label={t('register.companyName')} error={errors.companyName}>
                {(p) => <Input {...p} autoComplete="organization" maxLength={200} value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />}
              </Field>
              <Field label={t('register.branchName')} hint={t('register.branchHint')} optional={t('common.optional')}>
                {(p) => <Input {...p} maxLength={200} placeholder={t('register.branchPlaceholder')} value={form.branchName} onChange={(e) => set('branchName', e.target.value)} />}
              </Field>
            </Section>

            <Section icon={<UserRound className="size-4" />} title={t('register.adminSection')} hint={t('register.adminHint')}>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('users.form.firstName')} error={errors.firstName}>
                  {(p) => <Input {...p} autoComplete="given-name" maxLength={100} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />}
                </Field>
                <Field label={t('users.form.lastName')} error={errors.lastName}>
                  {(p) => <Input {...p} autoComplete="family-name" maxLength={100} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />}
                </Field>
              </div>
              <Field label={t('login.email')} error={errors.email}>
                {(p) => <Input {...p} type="email" autoComplete="email" maxLength={256} value={form.email} onChange={(e) => set('email', e.target.value)} />}
              </Field>
              <Field label={t('login.password')} error={errors.password}>
                {(p) => <Input {...p} type="password" autoComplete="new-password" maxLength={200} value={form.password} onChange={(e) => set('password', e.target.value)} />}
              </Field>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {rules.map((r) => (
                  <li key={r.label} className={`flex items-center gap-2 transition-colors ${r.ok ? 'text-signal' : 'text-ink-soft'}`}>
                    <span className={`grid size-4 place-items-center rounded-full transition-colors ${r.ok ? 'bg-signal text-white' : 'ring-1 ring-line'}`}>
                      <AnimatePresence>
                        {r.ok && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 25 }}>
                            <Check className="size-3" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    {r.label}
                  </li>
                ))}
              </ul>
            </Section>

            <div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-signal)]"
                  checked={accepted}
                  onChange={(e) => {
                    setAccepted(e.target.checked)
                    if (errors.accepted) setErrors((x) => ({ ...x, accepted: undefined }))
                  }}
                />
                <span>
                  {t('register.accept')}{' '}
                  <Link to="/kvkk" target="_blank" className="text-signal underline underline-offset-4">
                    {t('register.acceptLink')}
                  </Link>
                </span>
              </label>
              {errors.accepted && <p className="mt-1.5 text-sm text-overrun">{errors.accepted}</p>}
            </div>

            {error && (
              <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-overrun-soft px-3.5 py-2.5 text-sm text-overrun">
                {error}
              </motion.p>
            )}

            <Button type="submit" className="w-full" loading={register.isPending}>
              {register.isPending ? t('register.submitting') : t('register.submit')}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-soft">{t('register.after')}</p>
      </motion.div>
    </div>
  )
}

function Section({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 flex items-center gap-2.5 font-medium">
        <span className="grid size-7 place-items-center rounded-lg bg-signal-soft text-signal">{icon}</span>
        {title}
      </legend>
      {hint && <p className="-mt-2 text-sm text-ink-soft">{hint}</p>}
      {children}
    </fieldset>
  )
}
