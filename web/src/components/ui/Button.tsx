import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110 active:brightness-95 shadow-card',
  secondary: 'bg-surface border border-border text-ink hover:bg-surface2',
  ghost: 'bg-transparent text-muted hover:bg-surface2 hover:text-ink',
  danger: 'bg-negative-soft text-negative hover:brightness-95',
  soft: 'bg-accent-soft text-ink hover:brightness-95',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-10 px-4 text-[14px] gap-2 rounded-field',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-field',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, full, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-soft',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
})
