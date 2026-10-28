import { motion } from 'motion/react'
import { useId, type ReactNode } from 'react'

interface Option<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

/** Kayan arka plan vurgusuyla seçim çubuğu (filtreler, tema seçimi). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  label: string
  size?: 'sm' | 'md'
}) {
  const layoutId = useId()
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-panel-2 p-1 ring-1 ring-line">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative flex items-center gap-1.5 rounded-lg font-medium transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${active ? 'text-panel' : 'text-ink-soft hover:text-ink'}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-ink"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
