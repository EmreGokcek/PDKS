import { AnimatePresence, motion } from 'motion/react'
import QrScanner from 'qr-scanner'
import { CameraOff, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../../components/ui/Spinner'
import { Sheet } from '../../components/ui/Overlay'
import { extractQrToken, type AttendanceAction } from './api'

type CameraState = 'starting' | 'ready' | 'denied' | 'unavailable' | 'insecure'

/** Kamerayı açıp kiosk QR'ını okuyan panel. Kod okununca onToken çağrılır. */
export function QrScannerSheet({
  action,
  busy,
  error,
  onToken,
  onClose,
}: {
  action: AttendanceAction | null
  busy: boolean
  error: string | null
  onToken: (token: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet
      open={!!action}
      onClose={onClose}
      closeLabel={t('common.close')}
      title={action ? t('attendance.scanTitle', { action: t(`attendance.actions.${action}`) }) : ''}
      description={t('attendance.scanHint')}
    >
      {action && <Camera busy={busy} error={error} onToken={onToken} />}
    </Sheet>
  )
}

function Camera({ busy, error, onToken }: { busy: boolean; error: string | null; onToken: (token: string) => void }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState<CameraState>(() => (window.isSecureContext ? 'starting' : 'insecure'))
  const onTokenRef = useRef(onToken)
  useEffect(() => {
    onTokenRef.current = onToken
  })
  const lastRef = useRef<{ token: string; at: number } | null>(null)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!window.isSecureContext || !videoRef.current) return
    let disposed = false
    let retries = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const token = extractQrToken(result.data)
        // Aynı kodu art arda göndermemek için kısa bir bekleme
        const last = lastRef.current
        if (last && last.token === token && Date.now() - last.at < 4000) return
        lastRef.current = { token, at: Date.now() }
        onTokenRef.current(token)
      },
      { preferredCamera: 'environment', highlightScanRegion: false, maxScansPerSecond: 8, returnDetailedScanResult: true },
    )

    // Bir önceki okutmadan sonra kamera birkaç yüz milisaniye "meşgul" kalabiliyor
    // (özellikle telefonlarda). Bu durumda kısa aralıklarla yeniden denenir.
    const start = () => {
      scanner
        .start()
        .then(() => !disposed && setCamera('ready'))
        .catch((err: unknown) => {
          if (disposed) return
          const message = err instanceof Error ? `${err.name} ${err.message}` : String(err)
          if (/NotAllowed|Permission|denied/i.test(message)) return setCamera('denied')
          if (retries < 4) {
            retries += 1
            retryTimer = setTimeout(start, 350 * retries)
            return
          }
          setCamera('unavailable')
        })
    }
    // Panelin açılış animasyonu ve önceki kameranın kapanması için kısa bekleme
    retryTimer = setTimeout(start, 200)

    return () => {
      disposed = true
      clearTimeout(retryTimer)
      scanner.stop()
      scanner.destroy()
    }
  }, [attempt])

  const problem =
    camera === 'denied' ? t('attendance.cameraDenied')
    : camera === 'unavailable' ? t('attendance.cameraUnavailable')
    : camera === 'insecure' ? t('attendance.cameraInsecure')
    : null

  return (
    <div className="space-y-4">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-brand">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />

        {/* Hedef çerçevesi ve tarama çizgisi */}
        {camera === 'ready' && (
          <div className="pointer-events-none absolute inset-[14%]">
            {['top-0 left-0 border-t-4 border-l-4', 'top-0 right-0 border-t-4 border-r-4', 'bottom-0 left-0 border-b-4 border-l-4', 'right-0 bottom-0 border-r-4 border-b-4'].map((c) => (
              <span key={c} className={`absolute size-10 border-accent ${c}`} />
            ))}
            <motion.span
              className="absolute inset-x-3 h-0.5 bg-accent/80"
              animate={{ top: ['8%', '92%', '8%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}

        {(camera === 'starting' || busy) && (
          <div className="absolute inset-0 grid place-items-center bg-brand/60 text-on-brand">
            <div className="flex items-center gap-3">
              <Spinner />
              {busy ? t('attendance.sending') : t('attendance.cameraStarting')}
            </div>
          </div>
        )}

        {problem && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-brand p-8 text-center text-on-brand">
            <CameraOff className="size-10 opacity-70" />
            <p>{problem}</p>
            {camera === 'unavailable' && (
              <button
                type="button"
                onClick={() => {
                  setCamera('starting')
                  setAttempt((a) => a + 1)
                }}
                className="mt-2 rounded-xl bg-on-brand/15 px-4 py-2 text-sm font-medium ring-1 ring-on-brand/25 hover:bg-on-brand/20"
              >
                {t('common.retry')}
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            key={error}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border-l-[3px] border-overrun bg-overrun-soft px-4 py-3 text-sm text-overrun"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Smartphone className="size-4 shrink-0" />
        {t('attendance.nativeHint')}
      </p>
    </div>
  )
}
