import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-[1.05] active:brightness-95',
  secondary: 'border border-line bg-panel text-ink hover:bg-panel-2',
  ghost: 'text-ink-soft hover:bg-panel-2 hover:text-ink',
  danger: 'bg-overrun text-white hover:brightness-[1.06] active:brightness-95',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-10 gap-2 rounded-xl px-4',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[filter,background-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
})

/** Yalnızca ikondan oluşan buton; erişilebilirlik için label zorunlu. */
export function IconButton({
  label,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-panel-2 hover:text-ink ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
