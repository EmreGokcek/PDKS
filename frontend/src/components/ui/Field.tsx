import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const control =
  'rounded-xl border border-line bg-panel px-3.5 py-2.5 text-ink placeholder:text-ink-soft/60 transition-[border-color,box-shadow] duration-150 focus:border-ink focus:ring-2 focus:ring-accent/60 focus:outline-none aria-invalid:border-overrun aria-invalid:focus:ring-overrun/15'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}

/** Etiket, açıklama ve hata mesajını tek yerde toplayan form alanı sarmalayıcısı. */
export function Field({ label, hint, error, optional, children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-soft">{optional}</span>}
      </label>
      <div className="mt-1.5">
        {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': hint || error ? hintId : undefined })}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={hintId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-1.5 text-sm text-overrun"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <p key="hint" id={hintId} className="mt-1.5 text-sm text-ink-soft">
            {hint}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref,
) {
  return <input ref={ref} className={`w-full ${control} ${className}`} {...props} />
})

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${className.includes('w-') ? '' : 'w-full'} ${control} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%2394a8b9%22 stroke-width=%222%22><path d=%22M4 6l4 4 4-4%22/></svg>')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-10 ${className}`} {...props}>
      {children}
    </select>
  )
}
