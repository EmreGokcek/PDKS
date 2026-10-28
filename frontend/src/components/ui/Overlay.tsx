import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { IconButton } from './Button'

/** Açıkken Escape ile kapanma, sayfa kaydırmayı kilitleme ve odağı içeri alma. */
function useOverlayBehavior(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = setTimeout(() => {
      const root = ref.current
      const target =
        root?.querySelector<HTMLElement>('[data-autofocus]') ??
        root?.querySelector<HTMLElement>('input:not(.sr-only), select, textarea') ??
        root?.querySelector<HTMLElement>('button')
      target?.focus()
    }, 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      clearTimeout(focusTimer)
      previous?.focus?.()
    }
  }, [open, onClose])
  return ref
}

const Backdrop = ({ onClick }: { onClick: () => void }) => (
  <motion.div
    className="fixed inset-0 z-40 bg-black/45"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    onClick={onClick}
  />
)

/** Ortada açılan pencere. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  maxWidth?: string
}) {
  const ref = useOverlayBehavior(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Backdrop onClick={onClose} />
          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              className={`pointer-events-auto w-full ${maxWidth} rounded-2xl bg-panel p-6 shadow-pop ring-1 ring-line`}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              <h2 className="font-display text-2xl leading-tight font-semibold">{title}</h2>
              <div className="mt-3">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Sağdan kayarak açılan panel (mobilde alttan). Formlar için. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  closeLabel: string
}) {
  const ref = useOverlayBehavior(open, onClose)
  const desktop = useMediaQuery('(min-width: 640px)')
  const hidden = desktop ? { x: '100%' } : { y: '100%' }
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Backdrop onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-panel shadow-pop ring-1 ring-line sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl"
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={hidden}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-6 pb-4">
              <div>
                <h2 className="font-display text-2xl leading-tight font-semibold">{title}</h2>
                {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
              </div>
              <IconButton label={closeLabel} onClick={onClose} className="-mt-1 -mr-2">
                <X className="size-5" />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
