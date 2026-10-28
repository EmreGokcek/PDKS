import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Quote {
  text: string
  /** Atasözüyse kaynağı gösterilir. */
  proverb?: boolean
}

/** Belirli aralıklarla değişen söz. Sözler seçili dilde; başlangıç sözü rastgele. */
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
    <figure className={`relative ${className}`} aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.blockquote
          key={quote.text}
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={align === 'center' ? 'text-center' : ''}
        >
          <p className="text-[clamp(1.25rem,2.2vw,1.75rem)] leading-snug font-medium text-balance">
            <span aria-hidden="true" className="mr-1 text-signal">
              “
            </span>
            {quote.text}
            <span aria-hidden="true" className="ml-0.5 text-signal">
              ”
            </span>
          </p>
          {quote.proverb && <figcaption className="mt-2 text-sm text-on-brand/50">— {t('quotes.proverb')}</figcaption>}
        </motion.blockquote>
      </AnimatePresence>

      {/* Hangi sözde olunduğunu gösteren küçük noktalar */}
      <div className={`mt-5 flex gap-1.5 ${align === 'center' ? 'justify-center' : ''}`} aria-hidden="true">
        {quotes.map((q, i) => (
          <span
            key={q.text}
            className={`h-1 rounded-full transition-all duration-500 ${i === index % quotes.length ? 'w-5 bg-signal' : 'w-1 bg-on-brand/25'}`}
          />
        ))}
      </div>
    </figure>
  )
}
