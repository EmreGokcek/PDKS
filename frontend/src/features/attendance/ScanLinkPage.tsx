import { motion } from 'motion/react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { roleHome } from '../../auth/types'
import { LanguageMenu, ThemeSwitch } from '../../components/PreferencesControls'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { ApiError, errorMessage } from '../../lib/api'
import { formatClock } from '../../lib/format'
import { availableActions, useAttendance, useScan, type AttendanceAction } from './api'
import { SuccessOverlay } from './SuccessOverlay'
import { actionIcons } from './TodayPage'
import { useLiveStatus } from './useLiveStatus'

/**
 * Telefonun kendi kamerasıyla kiosk QR'ı okutulunca açılan sayfa (/okut?k=...).
 * Personel yalnızca işlemini seçer; kod bağlantının içinde gelir.
 */
export function ScanLinkPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('k') ?? ''
  const query = useAttendance()
  const live = useLiveStatus(query.data, query.dataUpdatedAt)
  const scan = useScan()
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [success, setSuccess] = useState<{ action: AttendanceAction; at: string } | null>(null)

  const home = user?.role === 'Manager' ? '/mudur/bugunum' : user ? roleHome[user.role] : '/'
  const finish = useCallback(() => navigate(home, { replace: true }), [navigate, home])

  async function run(action: AttendanceAction) {
    setError(null)
    try {
      const result = await scan.mutateAsync({ qrToken: token, action })
      setSuccess({ action: result.recorded, at: result.occurredAt })
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'qr_expired' || err.code === 'invalid_qr')) setExpired(true)
      setError(errorMessage(err, t))
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeSwitch />
        <LanguageMenu />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-panel p-7 shadow-pop ring-1 ring-line"
      >
        {!query.data || !live ? (
          <div className="grid place-items-center py-16 text-ink-soft">
            <Spinner />
          </div>
        ) : expired ? (
          <>
            <p role="alert" className="rounded-xl bg-overrun-soft px-4 py-3 text-overrun">{error ?? t('attendance.linkExpired')}</p>
            <Button className="mt-6 w-full" variant="secondary" onClick={finish}>
              {t('attendance.backHome')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-soft">{t(`attendance.states.${query.data.state}`)}</p>
            <p className="tabular mt-1 text-4xl font-semibold tracking-tight">{formatClock(live.workedToday, true)}</p>
            <p className="text-sm text-ink-soft">{t('attendance.workedToday')}</p>

            <h1 className="mt-8 text-xl font-semibold tracking-tight">{t('attendance.linkTitle')}</h1>
            <div className="mt-4 space-y-3">
              {availableActions(query.data).map(({ action, disabled }, i) => (
                <Button
                  key={action}
                  variant={i === 0 ? 'primary' : 'secondary'}
                  className="h-14 w-full text-lg"
                  disabled={disabled || scan.isPending}
                  loading={scan.isPending && scan.variables?.action === action}
                  onClick={() => run(action)}
                >
                  {actionIcons[action]}
                  {t(`attendance.actions.${action}`)}
                </Button>
              ))}
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-overrun-soft px-4 py-3 text-sm text-overrun">{error}</p>
            )}
            <button type="button" onClick={finish} className="mx-auto mt-6 block text-sm text-ink-soft hover:text-ink">
              {t('attendance.backHome')}
            </button>
          </>
        )}
      </motion.div>

      <SuccessOverlay result={success} onDone={finish} />
    </div>
  )
}
