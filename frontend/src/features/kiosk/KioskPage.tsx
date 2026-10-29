import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { WifiOff } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext'
import { Greeting, LiveClock } from '../../components/LiveClock'
import { KioskFeed } from './KioskFeed'
import { LanguageMenu } from '../../components/PreferencesControls'
import { Spinner } from '../../components/ui/Spinner'
import { useNow } from '../../hooks/useNow'
import { api } from '../../lib/api'
import { formatTime } from '../../lib/format'
import type { AttendanceAction } from '../attendance/api'

interface KioskState {
  kioskName: string
  branchName: string | null
  qrToken: string
  expiresAt: string
  windowSeconds: number
  serverNow: string
  recent: { name: string; type: AttendanceAction; occurredAt: string }[]
  /** Sunucuda ayarlanmış genel adres (App__PublicUrl); boşsa bu ekranın adresi kullanılır. */
  publicUrl: string | null
}

const eventTone: Record<AttendanceAction, string> = {
  CheckIn: 'bg-signal',
  BreakEnd: 'bg-signal',
  BreakStart: 'bg-pause',
  CheckOut: 'bg-on-brand/40',
}

/**
 * Girişteki tablette tam ekran açık kalan sayfa.
 * Birkaç saniyede bir sunucudan güncel QR'ı ve son okutmaları alır.
 */
export function KioskPage() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const state = useQuery({
    queryKey: ['kiosk-state'],
    queryFn: () => api<KioskState>('/kiosk/state'),
    // En geç 3 sn'de bir; kodun süresi dolmak üzereyse tam o anda yenile.
    refetchInterval: (q) => {
      const d = q.state.data
      if (!d) return 3000
      const left = new Date(d.expiresAt).getTime() - new Date(d.serverNow).getTime() - (Date.now() - q.state.dataUpdatedAt)
      return Math.max(250, Math.min(3000, left + 150))
    },
    refetchIntervalInBackground: true,
    retry: true,
  })
  const data = state.data

  // Bağlantı: telefonun kendi kamerasıyla okutulunca doğrudan uygulamanın okutma sayfası açılır.
  const link = data ? `${data.publicUrl ?? window.location.origin}/okut?k=${encodeURIComponent(data.qrToken)}` : null
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    if (!link) return
    let cancelled = false
    QRCode.toString(link, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#16324a', light: '#ffffff' } })
      .then((s) => !cancelled && setSvg(s))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [link])

  // Sunucu saati ile tablet saati arasındaki farkı düzelterek kalan süre.
  const now = useNow(250)
  const skew = data ? new Date(data.serverNow).getTime() - state.dataUpdatedAt : 0
  const secondsLeft = data ? Math.max(0, (new Date(data.expiresAt).getTime() - (now.getTime() + skew)) / 1000) : 0
  const fraction = data ? secondsLeft / data.windowSeconds : 0
  const offline = state.isError && !state.isFetching

  return (
    <div className="relative flex min-h-dvh flex-col bg-brand text-on-brand">
      <header className="flex items-center justify-between px-6 pt-6 sm:px-10">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-9 rounded-xl ring-1 ring-on-brand/20" />
          <div className="leading-tight">
            <p className="font-semibold">{data?.kioskName ?? 'PDKS'}</p>
            {data?.branchName && <p className="text-sm text-on-brand/60">{data.branchName}</p>}
          </div>
        </div>
        <LanguageMenu tone="onBrand" />
      </header>

      <main className="grid flex-1 items-center gap-10 px-6 py-8 sm:px-10 lg:grid-cols-[1fr_auto_1fr]">
        <div className="text-center lg:text-left">
          <Greeting className="mb-3 text-xl font-medium text-signal" />
          <LiveClock size="md" className="[&_time]:max-lg:justify-center" />
          <p className="mt-8 text-2xl font-semibold">{t('kiosk.instruction')}</p>
          <p className="mt-2 max-w-sm text-on-brand/65 max-lg:mx-auto">{t('kiosk.steps')}</p>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="relative rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="grid size-[min(72vw,340px)] place-items-center">
              <AnimatePresence mode="popLayout">
                {svg ? (
                  <motion.div
                    key={data!.qrToken}
                    className="size-full [&_svg]:size-full"
                    initial={{ opacity: 0, scale: 0.94, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.03, filter: 'blur(6px)' }}
                    transition={{ duration: 0.35 }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <Spinner className="size-8 text-[#16324a]" />
                )}
              </AnimatePresence>
            </div>
            {offline && (
              <div className="absolute inset-0 grid place-items-center rounded-[2rem] bg-white/90 p-6 text-center text-[#16324a]">
                <div>
                  <WifiOff className="mx-auto size-8" />
                  <p className="mt-3 text-sm">{t('kiosk.offline')}</p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full max-w-[340px]">
            <div className="h-1.5 overflow-hidden rounded-full bg-on-brand/15">
              <div
                className="h-full rounded-full bg-signal transition-[width] duration-300 ease-linear"
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </div>
            <p className="tabular mt-2 text-center text-sm text-on-brand/55">
              {t('kiosk.refreshesIn', { seconds: Math.ceil(secondsLeft) })}
            </p>
          </div>
        </div>

        <aside className="lg:justify-self-end">
          <h2 className="text-sm text-on-brand/60">{t('kiosk.recent')}</h2>
          <ul className="mt-3 w-full space-y-2 lg:w-80">
            <AnimatePresence initial={false}>
              {data?.recent.length ? (
                data.recent.map((r, i) => (
                  <motion.li
                    key={r.occurredAt + r.name + r.type}
                    layout
                    initial={{ opacity: 0, x: 24, scale: 0.96 }}
                    animate={{ opacity: i === 0 ? 1 : 0.75, x: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${i === 0 ? 'bg-on-brand/12 ring-1 ring-on-brand/15' : 'bg-on-brand/5'}`}
                  >
                    <span className={`size-2.5 shrink-0 rounded-full ${eventTone[r.type]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block text-sm text-on-brand/60">{t(`attendance.eventNames.${r.type}`)}</span>
                    </span>
                    <span className="tabular text-on-brand/70">{formatTime(r.occurredAt)}</span>
                  </motion.li>
                ))
              ) : (
                <li className="rounded-2xl border border-dashed border-on-brand/20 px-4 py-6 text-center text-sm text-on-brand/50">
                  {t('kiosk.recentEmpty')}
                </li>
              )}
            </AnimatePresence>
          </ul>
        </aside>
      </main>

      <div className="mx-auto w-full max-w-2xl px-6 pb-6">
        <KioskFeed />
      </div>

      <footer className="px-6 pb-5 text-center">
        <button type="button" onClick={logout} className="text-xs text-on-brand/35 underline underline-offset-4 hover:text-on-brand/70">
          {t('kiosk.signOut')}
        </button>
      </footer>
    </div>
  )
}
