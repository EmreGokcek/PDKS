import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { ComingSoon, PageHeader } from '../components/AppShell'
import { LiveClock } from '../components/LiveClock'
import { LanguageMenu } from '../components/PreferencesControls'

export function ManagerHomePage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('nav.dashboard')} />
      <ComingSoon items={t('placeholder.manager', { returnObjects: true }) as unknown as string[]} />
    </>
  )
}

export function EmployeeHomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  return (
    <>
      <PageHeader title={t('placeholder.hello', { name: user?.firstName ?? '' })} />
      <ComingSoon items={t('placeholder.employee', { returnObjects: true }) as unknown as string[]} />
    </>
  )
}

/** Kiosk ekranı: Adım 3'te burada 30 saniyede bir yenilenen QR kod gösterilecek. */
export function KioskPage() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-10 bg-brand px-4 text-on-brand">
      <div className="absolute top-4 right-4">
        <LanguageMenu tone="onBrand" />
      </div>
      <LiveClock className="text-center" />
      <motion.div
        className="grid size-64 place-items-center rounded-3xl border-2 border-dashed border-on-brand/25 text-center text-on-brand/60"
        animate={{ borderColor: ['rgba(242,245,247,0.15)', 'rgba(53,195,155,0.6)', 'rgba(242,245,247,0.15)'] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {t('kiosk.qrSoon')}
      </motion.div>
      <button type="button" onClick={logout} className="text-sm text-on-brand/50 underline underline-offset-4 hover:text-on-brand/80">
        {t('kiosk.signOut')}
      </button>
    </div>
  )
}
