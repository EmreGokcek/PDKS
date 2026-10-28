import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { roleHome, type User } from '../../auth/types'
import { LanguageMenu, ThemeSwitch } from '../../components/PreferencesControls'
import { Button } from '../../components/ui/Button'
import { api, errorMessage, json } from '../../lib/api'
import { NOTICE_VERSION } from './notice'
import { PrivacyNoticeBody } from './PrivacyNotice'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-9 rounded-xl" />
            <span className="text-lg font-semibold">PDKS</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitch compact />
            <LanguageMenu />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Herkese açık aydınlatma metni (giriş ekranından bağlantı). */
export function PrivacyNoticePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  return (
    <Frame>
      <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{t('privacy.title')}</h1>
      <p className="mt-1.5 mb-8 text-ink-soft">{t('privacy.version', { version: NOTICE_VERSION })}</p>
      <PrivacyNoticeBody company={user?.companyName ?? null} />
      <p className="mt-10">
        <Link to={user ? roleHome[user.role] : '/giris'} className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          {t('privacy.back')}
        </Link>
      </p>
    </Frame>
  )
}

/** İlk girişte (ve metin güncellenince) aydınlatma metninin okunduğunun onaylanması. */
export function PrivacyConsentPage() {
  const { t } = useTranslation()
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [read, setRead] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return <Navigate to="/giris" replace />
  if (user.privacyNoticeAccepted) return <Navigate to={roleHome[user.role]} replace />

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const updated = await api<User>('/auth/privacy-notice', { method: 'POST', ...json({ version: NOTICE_VERSION }) })
      updateUser(updated)
      navigate(updated.profileComplete ? roleHome[updated.role] : '/profil-tamamla', { replace: true })
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-signal-soft text-signal">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{t('privacy.title')}</h1>
          <p className="mt-1.5 text-ink-soft">{t('privacy.consentIntro', { name: user.firstName })}</p>
        </div>
      </div>

      <div className="mt-8 max-h-[55dvh] overflow-y-auto rounded-2xl bg-panel p-5 ring-1 ring-line sm:p-6">
        <PrivacyNoticeBody company={user.companyName} />
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--color-signal)]" checked={read} onChange={(e) => setRead(e.target.checked)} />
        <span>{t('privacy.acknowledge')}</span>
      </label>
      {error && <p role="alert" className="mt-4 rounded-xl bg-overrun-soft px-4 py-3 text-sm text-overrun">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => void logout()} className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          {t('nav.logout')}
        </button>
        <Button onClick={accept} disabled={!read} loading={busy}>
          {t('privacy.continue')}
        </Button>
      </div>
      <p className="mt-6 text-xs text-ink-soft">{t('privacy.note')}</p>
    </Frame>
  )
}
