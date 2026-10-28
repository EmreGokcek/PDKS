import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Quote {
  text: string
  /** Atasözüyse kaynağı gösterilir. */
  proverb?: boolean
}

/** Panonun alt satırındaki duyuru: belirli aralıklarla değişen söz. Başlangıç sözü rastgele. */
export function QuoteRotator({ className = '', intervalMs = 9000, align = 'start' }: { className?: string; intervalMs?: number; align?: 'start' | 'center' }) {
  const { t } = useTranslation()
  const quotes = t('quotes.items', { returnObjects: true }) as unknown as Quote[]
  const [index, setIndex] = useState(() => Math.floor(Math.random() * quotes.length))

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % quotes.length), intervalMs)
    return () => clearInterval(id)
  }, [quotes.length, intervalMs])

  const quote = quotes[index % quotes.length]!

  return (
    <figure className={`flex items-start gap-4 border-t border-on-brand/15 pt-4 ${align === 'center' ? 'justify-center text-center' : ''} ${className}`} aria-live="polite">
      <span className="board-label mt-1 shrink-0 bg-accent px-1.5 py-0.5 text-xs text-on-accent">{t('quotes.label')}</span>
      <AnimatePresence mode="wait">
        <motion.blockquote
          key={quote.text}
          initial={{ opacity: 0, y: '40%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '-40%' }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="min-w-0"
        >
          <p className="font-display text-[clamp(1.25rem,2vw,1.6rem)] leading-tight font-medium text-balance">{quote.text}</p>
          {quote.proverb && <figcaption className="board-label mt-1 text-xs text-on-brand/45">{t('quotes.proverb')}</figcaption>}
        </motion.blockquote>
      </AnimatePresence>
    </figure>
  )
}
