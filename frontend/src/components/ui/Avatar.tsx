// İsimden sabit bir renk seçilir; aynı kişi her zaman aynı renkte görünür.
const tones = [
  'bg-[#dbeafe] text-[#1e3a8a] dark:bg-[#1e3a5f] dark:text-[#bfdbfe]',
  'bg-[#dcfce7] text-[#14532d] dark:bg-[#173d2b] dark:text-[#bbf7d0]',
  'bg-[#fef3c7] text-[#78350f] dark:bg-[#43361a] dark:text-[#fde68a]',
  'bg-[#fce7f3] text-[#831843] dark:bg-[#4a2238] dark:text-[#fbcfe8]',
  'bg-[#ede9fe] text-[#4c1d95] dark:bg-[#33275a] dark:text-[#ddd6fe]',
  'bg-[#ccfbf1] text-[#134e4a] dark:bg-[#123f3c] dark:text-[#99f6e4]',
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
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${tone} ${size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm'}`}
    >
      {initials}
    </span>
  )
}
