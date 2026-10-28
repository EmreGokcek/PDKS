import { UserRoundCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { roleHome, type User } from '../../auth/types'
import { LanguageMenu, ThemeSwitch } from '../../components/PreferencesControls'
import { PageSkeleton } from '../../components/ui/Skeleton'
import { api } from '../../lib/api'
import { formatDay } from '../../lib/dates'
import { useMyProfile } from './api'
import { EditForm } from './ProfilePage'

/**
 * İlk girişte profil tamamlama. Yöneticinin personeli eklerken girdiği bilgiler hazır gösterilir;
 * kişi eksik kalanları (telefon, doğum tarihi, acil durum kişisi vb.) doldurur.
 */
export function ProfileSetupPage() {
  const { t } = useTranslation()
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const profile = useMyProfile()

  if (!user) return <Navigate to="/giris" replace />
  if (user.profileComplete) return <Navigate to={roleHome[user.role]} replace />

  const p = profile.data
  const date = (iso: string | null) => (iso ? formatDay(iso, { day: 'numeric', month: 'long', year: 'numeric' }) : null)
  const known: [string, string | null][] = p
    ? [
        [t('profile.fields.fullName'), p.fullName],
        [t('profile.fields.email'), p.email],
        [t('profile.fields.employeeNumber'), p.employeeNumber],
        [t('profile.fields.position'), p.position],
        [t('profile.fields.branch'), p.branchName],
        [t('profile.fields.hireDate'), date(p.hireDate)],
      ]
    : []

  async function done() {
    const me = await api<User>('/auth/me')
    updateUser(me)
    navigate(roleHome[me.role], { replace: true })
  }

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

        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-signal-soft text-signal">
            <UserRoundCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">{t('profile.setup.title')}</h1>
            <p className="mt-1.5 text-ink-soft">{t('profile.setup.intro', { name: user.firstName })}</p>
          </div>
        </div>

        {!p ? (
          <div className="mt-8">
            <PageSkeleton variant="list" />
          </div>
        ) : (
          <>
            <section className="mt-8 rounded-2xl bg-panel p-5 ring-1 ring-line">
              <h2 className="text-sm font-semibold">{t('profile.setup.fromAdmin')}</h2>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {known
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 sm:block">
                      <dt className="text-ink-soft">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
              </dl>
              <p className="mt-3 text-xs text-ink-soft">{t('profile.setup.fromAdminHint')}</p>
            </section>

            <section className="mt-4 rounded-2xl bg-panel p-5 ring-1 ring-line sm:p-6">
              <EditForm profile={p} mode="setup" onDone={() => void done()} />
            </section>
          </>
        )}

        <button type="button" onClick={() => void logout()} className="mt-6 text-sm text-ink-soft underline underline-offset-4 hover:text-ink">
          {t('nav.logout')}
        </button>
      </div>
    </div>
  )
}
