import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { Check, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '../../auth/AuthContext'
import { roleHome, type LoginResponse } from '../../auth/types'
import { LanguageMenu, ThemeSwitch } from '../../components/PreferencesControls'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { api, errorMessage, json } from '../../lib/api'

export function ChangePasswordPage() {
  const { t } = useTranslation()
  const { user, applyLogin, logout } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const change = useMutation({
    mutationFn: () =>
      api<LoginResponse>('/auth/change-password', { method: 'POST', ...json({ currentPassword: current, newPassword: next }) }),
    onSuccess: (res) => {
      applyLogin(res)
      toast.success(t('changePassword.success'))
      navigate(roleHome[res.user.role], { replace: true })
    },
    onError: (err) => setError(errorMessage(err, t)),
  })

  if (!user) return <Navigate to="/giris" replace />

  const rules = [
    { ok: next.length >= 8, label: t('changePassword.ruleLength') },
    { ok: /\p{L}/u.test(next), label: t('changePassword.ruleLetter') },
    { ok: /\d/.test(next), label: t('changePassword.ruleDigit') },
    { ok: next.length > 0 && next === confirm, label: t('changePassword.ruleMatch') },
  ]
  const valid = current.length > 0 && rules.every((r) => r.ok)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (valid) change.mutate()
  }

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
        className="w-full max-w-md rounded-3xl bg-panel p-7 shadow-pop ring-1 ring-line sm:p-9"
      >
        <img src="/favicon.svg" alt="" className="size-10 rounded-xl" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('changePassword.title')}</h1>
        <p className="mt-2 text-ink-soft">
          {user.mustChangePassword ? t('changePassword.forcedSubtitle') : t('changePassword.subtitle')}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          <Field
            label={t('changePassword.current')}
            hint={user.mustChangePassword ? t('changePassword.currentHintTemp') : undefined}
          >
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
          </Field>
          <Field label={t('changePassword.next')}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
          </Field>
          <Field label={t('changePassword.confirm')}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>

          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {rules.map((r) => (
              <li key={r.label} className={`flex items-center gap-2 transition-colors ${r.ok ? 'text-signal' : 'text-ink-soft'}`}>
                <span className={`grid size-4 place-items-center rounded-sm transition-colors ${r.ok ? 'bg-signal text-white' : 'ring-1 ring-line'}`}>
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

          {error && (
            <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-overrun-soft px-3.5 py-2.5 text-sm text-overrun">
              {error}
            </motion.p>
          )}

          <Button type="submit" className="w-full" disabled={!valid} loading={change.isPending}>
            {t('changePassword.submit')}
          </Button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="mx-auto mt-6 flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          <LogOut className="size-4" />
          {t('nav.logout')}
        </button>
      </motion.div>
    </div>
  )
}
