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
      <span className="tabular font-display text-[15px] leading-tight font-semibold text-ink">
        {hhmm(start)}–{hhmm(end)}
      </span>
      {name && !compact && <span className="truncate text-[11px] leading-tight text-ink-soft">{name}</span>}
    </span>
  )
}

export const templateColors = ['#2f80ed', '#1f9a76', '#9b51e0', '#e07a2f', '#d6455d', '#0ea5b7', '#b7791f', '#64748b']

/** İzin günü etiketi: çizgili arka plan, izin türünün adı. */
export function LeaveChip({ label, color, pending = false }: { label: string; color: string; pending?: boolean }) {
  return (
    <span
      className={`flex h-full w-full items-center rounded-lg px-2 text-[13px] font-medium text-ink transition-opacity ${pending ? 'opacity-60' : ''}`}
      style={{
        backgroundImage: `repeating-linear-gradient(135deg, ${color}26 0 6px, ${color}10 6px 12px)`,
        boxShadow: `inset 0 0 0 1px ${color}55`,
      }}
    >
      <span className="mr-1.5 size-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </span>
  )
}
