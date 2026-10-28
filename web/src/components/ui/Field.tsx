import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

interface LabelProps {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}

export function FieldWrap({ label, hint, error, children, className }: LabelProps) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-[12px] text-negative">{error}</span> : hint ? <span className="mt-1 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  )
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  hint?: string
  error?: string
  prefix?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, hint, error, prefix, className, ...rest }, ref) {
  return (
    <FieldWrap label={label} hint={hint} error={error} className={className}>
      <span className="relative block">
        {prefix && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">{prefix}</span>}
        <input ref={ref} className={clsx('field', prefix && 'pl-9', error && '!border-negative')} {...rest} />
      </span>
    </FieldWrap>
  )
})

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField({ label, hint, error, className, children, ...rest }, ref) {
  return (
    <FieldWrap label={label} hint={hint} error={error} className={className}>
      <select ref={ref} className={clsx('field appearance-none pr-9 bg-no-repeat', error && '!border-negative')} style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236c6f7c\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'m6 9 6 6 6-6\'/></svg>")', backgroundPosition: 'right 12px center' }} {...rest}>
        {children}
      </select>
    </FieldWrap>
  )
})

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ label, hint, error, className, ...rest }, ref) {
  return (
    <FieldWrap label={label} hint={hint} error={error} className={className}>
      <textarea ref={ref} className={clsx('field min-h-[80px] resize-y', error && '!border-negative')} {...rest} />
    </FieldWrap>
  )
})

/** Big amount input used on the expense forms. */
export function AmountInput({ value, onChange, currency, autoFocus }: { value: string; onChange: (v: string) => void; currency: string; autoFocus?: boolean }) {
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency
  return (
    <div className="flex items-end gap-2 rounded-card bg-surface2 px-4 py-3">
      <span className="money text-[26px] text-muted pb-0.5">{symbol}</span>
      <input
        autoFocus={autoFocus}
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        className="money w-full bg-transparent outline-none text-[34px] leading-none placeholder:text-muted/50"
      />
    </div>
  )
}
