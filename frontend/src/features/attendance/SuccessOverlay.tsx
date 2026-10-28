import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { SplitFlap } from '../../components/SplitFlap'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { formatTime } from '../../lib/format'
import type { AttendanceAction } from './api'

const tones: Record<AttendanceAction, string> = {
  CheckIn: 'bg-signal',
  BreakEnd: 'bg-signal',
  BreakStart: 'bg-pause',
  CheckOut: 'bg-accent',
}
const texts: Record<AttendanceAction, string> = {
  CheckIn: 'text-signal',
  BreakEnd: 'text-signal',
  BreakStart: 'text-pause',
  CheckOut: 'text-accent',
}

/** Önce boş kanatçıklar görünür, ardından saat panodaki gibi döner. */
function FlipInTime({ time }: { time: string }) {
  const [text, setText] = useState('--:--')
  useEffect(() => {
    const id = setTimeout(() => setText(time), 250)
    return () => clearTimeout(id)
  }, [time])
  return <SplitFlap text={text} label={time} className="text-[clamp(4rem,18vw,7rem)]" />
}

/** Okutma başarılı olunca tam ekran onay: pano satırı gibi. Kendiliğinden kapanır. */
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
    const id = setTimeout(onDone, 2400)
    return () => clearTimeout(id)
  }, [result, onDone])

  return createPortal(
    <AnimatePresence>
      {result && (
        <motion.div
          className="dark fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-brand text-on-brand"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onDone}
          role="status"
        >
          <motion.span
            aria-hidden="true"
            className={`absolute inset-x-0 top-0 h-2 origin-left ${tones[result.action]}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2.3, ease: 'linear' }}
          />
          <p className={`board-label flex items-center gap-3 text-3xl ${texts[result.action]}`}>
            <span className={`size-4 ${tones[result.action]}`} />
            {t(`attendance.done.${result.action}`)}
          </p>
          <FlipInTime time={formatTime(result.at)} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
