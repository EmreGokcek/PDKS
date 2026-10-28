import { useState } from 'react'

/**
 * Kalkış panolarındaki gibi kanatçıklı tek karakter.
 * Karakter değişince üst yarı aşağı katlanır, yeni karakterin alt yarısı açılır.
 */
function FlapChar({ char }: { char: string }) {
  const [current, setCurrent] = useState(char)
  const [previous, setPrevious] = useState(char)
  // Prop değişince önceki karakteri sakla (render sırasında türetilmiş durum).
  if (char !== current) {
    setPrevious(current)
    setCurrent(char)
  }
  const flipping = previous !== current

  return (
    <span className="flap" aria-hidden="true">
      <span className="flap-half flap-top">
        <span>{current}</span>
      </span>
      <span className="flap-half flap-bottom">
        <span>{flipping ? previous : current}</span>
      </span>
      {flipping && (
        <>
          <span key={`t-${current}`} className="flap-half flap-top flap-fold-top">
            <span>{previous}</span>
          </span>
          <span key={`b-${current}`} className="flap-half flap-bottom flap-fold-bottom" onAnimationEnd={() => setPrevious(current)}>
            <span>{current}</span>
          </span>
        </>
      )}
    </span>
  )
}

/** Bir metni kanatçık kanatçık gösterir. `length` verilirse sağdan boşlukla doldurulur. */
export function SplitFlap({ text, length, className = '', label }: { text: string; length?: number; className?: string; label?: string }) {
  const chars = [...(length ? text.padEnd(length).slice(0, length) : text)]
  return (
    <span className={`flap-row ${className}`} role="text" aria-label={label ?? text}>
      {chars.map((c, i) =>
        c === ':' ? (
          <span key={i} aria-hidden="true" className="flap-sep">
            :
          </span>
        ) : (
          <FlapChar key={i} char={c === ' ' ? '\u00a0' : c} />
        ),
      )}
    </span>
  )
}
