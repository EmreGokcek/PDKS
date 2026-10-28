import type { ReactNode } from 'react'

type Tone = 'neutral' | 'signal' | 'pause' | 'overrun' | 'brand'

const tones: Record<Tone, string> = {
  neutral: 'bg-panel-2 text-ink-soft ring-line',
  signal: 'bg-signal-soft text-signal ring-signal/20',
  pause: 'bg-pause-soft text-pause ring-pause/20',
  overrun: 'bg-overrun-soft text-overrun ring-overrun/20',
  brand: 'bg-ink/[0.06] text-ink ring-ink/10 dark:bg-ink/10',
}

export function Badge({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>
      {dot && <span className="size-1.5 bg-current" />}
      {children}
    </span>
  )
}
