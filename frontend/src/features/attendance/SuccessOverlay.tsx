import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { formatTime } from '../../lib/format'
import type { AttendanceAction } from './api'

const tones: Record<AttendanceAction, string> = {
  CheckIn: 'bg-signal',
  BreakEnd: 'bg-signal',
  BreakStart: 'bg-pause',
  CheckOut: 'bg-brand',
}

/** Okutma başarılı olunca tam ekran onay animasyonu. Kendiliğinden kapanır. */
export function SuccessOverlay({
  result,
  onDone,
}: {
  result: { action: AttendanceAction; at: string } | null
  onDone: () => void
}) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!result) return
    navigator.vibrate?.(60)
    const id = setTimeout(onDone, 2200)
    return () => clearTimeout(id)
  }, [result, onDone])

  return createPortal(
    <AnimatePresence>
      {result && (
        <motion.div
          className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 text-white ${tones[result.action]}`}
          initial={{ clipPath: 'circle(0% at 50% 60%)' }}
          animate={{ clipPath: 'circle(150% at 50% 60%)' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          onClick={onDone}
          role="status"
        >
          <svg viewBox="0 0 52 52" className="size-28" aria-hidden="true">
            <motion.circle
              cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.4"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
            />
            <motion.path
              d="M15 27l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.55 }}
            />
          </svg>
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-3xl font-semibold tracking-tight">{t(`attendance.done.${result.action}`)}</p>
            <p className="tabular mt-2 text-5xl font-semibold opacity-90">{formatTime(result.at)}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
