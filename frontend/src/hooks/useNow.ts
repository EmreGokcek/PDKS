import { useEffect, useState } from 'react'

/** Her saniye (veya verilen aralıkta) güncellenen şimdiki zaman. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
