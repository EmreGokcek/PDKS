import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface MenuItem {
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger'
}

/** Küçük açılır menü (satır işlemleri vb.). */
export function Menu({
  trigger,
  items,
  align = 'end',
  children,
}: {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode
  items?: MenuItem[]
  align?: 'start' | 'end'
  children?: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={ref} className="relative">
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -2 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: align === 'end' ? 'top right' : 'top left' }}
            className={`absolute top-full z-30 mt-2 min-w-52 rounded-xl bg-panel p-1.5 shadow-pop ring-1 ring-line ${align === 'end' ? 'right-0' : 'left-0'}`}
          >
            {children?.(close)}
            {items?.map((item, i) => (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  close()
                  item.onSelect()
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-panel-2 ${item.tone === 'danger' ? 'text-overrun' : 'text-ink'}`}
              >
                {item.icon && <span className="opacity-80">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
