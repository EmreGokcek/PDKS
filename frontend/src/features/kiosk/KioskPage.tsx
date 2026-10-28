import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { WifiOff } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/AuthContext'
import { Greeting, LiveClock } from '../../components/LiveClock'
import { QuoteRotator } from '../../components/QuoteRotator'
import { SplitFlap } from '../../components/SplitFlap'
import i18n from '../../i18n'
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
}

const eventText: Record<AttendanceAction, string> = {
  CheckIn: 'text-signal',
  BreakEnd: 'text-signal',
  BreakStart: 'text-pause',
  CheckOut: 'text-on-brand/55',
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
  const link = data ? `${window.location.origin}/okut?k=${encodeURIComponent(data.qrToken)}` : null
  const [svg, setSvg] = useState<string | null>(null)
  useEffect(() => {
    if (!link) return
    let cancelled = false
    QRCode.toString(link, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#141517', light: '#ffffff' } })
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

  const [latest, ...older] = data?.recent ?? []

  return (
    <div className="dark relative flex min-h-dvh flex-col bg-brand text-on-brand">
      <header className="flex items-center justify-between gap-4 border-b border-on-brand/10 px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-9" />
          <div className="leading-tight">
            <p className="font-display text-xl font-semibold tracking-wide uppercase">{data?.kioskName ?? 'PDKS'}</p>
            {data?.branchName && <p className="board-label text-xs text-on-brand/50">{data.branchName}</p>}
          </div>
        </div>
        <LanguageMenu tone="onBrand" />
      </header>

      <main className="grid flex-1 items-center gap-10 px-6 py-8 sm:px-10 lg:grid-cols-[1fr_auto_1fr]">
        <div className="text-center lg:text-left">
          <Greeting className="board-label mb-4 text-xl text-accent" />
          <LiveClock size="md" className="[&_time]:max-lg:justify-center" align="start" />
          <p className="mt-8 font-display text-3xl leading-tight font-semibold">{t('kiosk.instruction')}</p>
          <p className="mt-2 max-w-sm text-on-brand/60 max-lg:mx-auto">{t('kiosk.steps')}</p>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative rounded-md bg-white p-5 ring-4 ring-accent">
            <div className="grid size-[min(72vw,340px)] place-items-center">
              <AnimatePresence mode="popLayout">
                {svg ? (
                  <motion.div
                    key={data!.qrToken}
                    className="size-full [&_svg]:size-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                ) : (
                  <Spinner className="size-8 text-[#141517]" />
                )}
              </AnimatePresence>
            </div>
            {offline && (
              <div className="absolute inset-0 grid place-items-center bg-white/92 p-6 text-center text-[#141517]">
                <div>
                  <WifiOff className="mx-auto size-8" />
                  <p className="mt-3 text-sm">{t('kiosk.offline')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Yenilenme: her saniye bir kutucuk söner */}
          <div className="w-full max-w-[380px]">
            <div className="flex gap-[3px]" aria-hidden="true">
              {Array.from({ length: data?.windowSeconds ?? 30 }, (_, i) => (
                <span key={i} className={`h-2 flex-1 transition-colors duration-200 ${i < Math.ceil(fraction * (data?.windowSeconds ?? 30)) ? 'bg-accent' : 'bg-on-brand/12'}`} />
              ))}
            </div>
            <p className="tabular board-label mt-2 text-center text-xs text-on-brand/50">
              {t('kiosk.refreshesIn', { seconds: Math.ceil(secondsLeft) })}
            </p>
          </div>
        </div>

        {/* Son okutmalar: kalkış tablosu */}
        <aside className="w-full lg:w-[23rem] lg:justify-self-end">
          <h2 className="board-label text-xs text-on-brand/50">{t('kiosk.lastScan')}</h2>
          <div className="mt-2 rounded-md bg-flap-2 p-3 ring-1 ring-on-brand/10">
            {latest ? (
              <>
                <SplitFlap text={latest.name.toLocaleUpperCase(i18n.language)} length={16} className="text-[clamp(1.1rem,1.6vw,1.45rem)]" />
                <div className="mt-2 flex items-center justify-between">
                  <span className={`board-label text-sm ${eventText[latest.type]}`}>{t(`attendance.eventNames.${latest.type}`)}</span>
                  <span className="tabular font-display text-xl font-semibold">{formatTime(latest.occurredAt)}</span>
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-sm text-on-brand/50">{t('kiosk.recentEmpty')}</p>
            )}
          </div>

          {older.length > 0 && (
            <table className="mt-5 w-full text-left">
              <thead>
                <tr className="board-label text-[11px] text-on-brand/40">
                  <th className="pb-2 font-semibold">{t('kiosk.columns.time')}</th>
                  <th className="pb-2 font-semibold">{t('kiosk.columns.person')}</th>
                  <th className="pb-2 text-right font-semibold">{t('kiosk.columns.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-on-brand/10">
                {older.map((r) => (
                  <tr key={r.occurredAt + r.name + r.type} className="text-on-brand/80">
                    <td className="tabular w-16 py-2 font-display text-lg font-semibold text-accent">{formatTime(r.occurredAt)}</td>
                    <td className="max-w-0 truncate py-2 pr-2">{r.name}</td>
                    <td className={`board-label py-2 text-right text-sm ${eventText[r.type]}`}>{t(`attendance.eventNames.${r.type}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </aside>
      </main>

      <div className="mx-auto w-full max-w-3xl px-6 pb-5">
        <QuoteRotator intervalMs={12000} />
      </div>

      <footer className="px-6 pb-5 text-center">
        <button type="button" onClick={logout} className="text-xs text-on-brand/35 underline underline-offset-4 hover:text-on-brand/70">
          {t('kiosk.signOut')}
        </button>
      </footer>
    </div>
  )
}
