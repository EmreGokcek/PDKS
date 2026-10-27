import { hhmm } from '../../lib/dates'

/** Renkli vardiya etiketi. Renk şablondan gelir; arka plan rengin açık tonu. */
export function ShiftChip({
  start,
  end,
  name,
  color,
  compact = false,
  pending = false,
}: {
  start: string
  end: string
  name?: string | null
  color: string
  compact?: boolean
  pending?: boolean
}) {
  return (
    <span
      className={`flex h-full w-full flex-col justify-center rounded-lg border-l-[3px] px-2 text-left transition-opacity ${compact ? 'py-1' : 'py-1.5'} ${pending ? 'opacity-60' : ''}`}
      style={{ borderColor: color, backgroundColor: `${color}1f` }}
    >
      <span className="tabular text-[13px] leading-tight font-semibold text-ink">
        {hhmm(start)}–{hhmm(end)}
      </span>
      {name && !compact && <span className="truncate text-[11px] leading-tight text-ink-soft">{name}</span>}
    </span>
  )
}

export const templateColors = ['#2f80ed', '#1f9a76', '#9b51e0', '#e07a2f', '#d6455d', '#0ea5b7', '#b7791f', '#64748b']
