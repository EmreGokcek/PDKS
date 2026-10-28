// İsimden sabit bir renk seçilir; aynı kişi her zaman aynı renkte görünür.
const tones = [
  'bg-[#e9dfb8] text-[#4d3d00] dark:bg-[#3a3320] dark:text-[#f3dd8a]',
  'bg-[#d6e6da] text-[#174a2c] dark:bg-[#1f3a2a] dark:text-[#a9e4bf]',
  'bg-[#e8d9cc] text-[#5a2c08] dark:bg-[#3e2c1e] dark:text-[#f4c49a]',
  'bg-[#d9dde4] text-[#24324a] dark:bg-[#272e3a] dark:text-[#bcc8dc]',
  'bg-[#e4d7d7] text-[#5a1f1f] dark:bg-[#3d2626] dark:text-[#efb6b0]',
  'bg-[#dcdcd4] text-[#33332c] dark:bg-[#30302b] dark:text-[#d8d7cc]',
]

export function Avatar({ name, muted = false, size = 'md' }: { name: string; muted?: boolean; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase('tr'))
    .join('')
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const tone = muted ? 'bg-panel-2 text-ink-soft' : tones[hash % tones.length]
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-md font-display font-semibold tracking-wide ${tone} ${size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm'}`}
    >
      {initials}
    </span>
  )
}
