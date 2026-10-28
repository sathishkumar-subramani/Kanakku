import { type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { describeBalance, money } from '@/utils/money'
import { isFutureMonth, monthLabel, shiftMonth } from '@/utils/dates'
import { categoryMeta } from '@/theme/tokens'

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function Avatar({ name, color, size = 36, className }: { name: string; color: string; size?: number; className?: string }) {
  return (
    <span
      className={clsx('inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 select-none', className)}
      style={{ width: size, height: size, background: color, fontSize: Math.max(10, size * 0.38) }}
      title={name}
    >
      {initials(name) || '?'}
    </span>
  )
}

export function AvatarStack({ people, size = 28, max = 4 }: { people: { name: string; avatarColor: string }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="inline-flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.name + i} name={p.name} color={p.avatarColor} size={size} className={clsx('ring-2 ring-surface', i > 0 && '-ml-2')} />
      ))}
      {extra > 0 && (
        <span className="-ml-2 inline-flex items-center justify-center rounded-full bg-surface2 text-muted font-semibold ring-2 ring-surface" style={{ width: size, height: size, fontSize: size * 0.38 }}>
          +{extra}
        </span>
      )}
    </span>
  )
}

export function Money({ amount, currency = 'INR', className, tone }: { amount: number; currency?: string; className?: string; tone?: 'positive' | 'negative' | 'muted' }) {
  return <span className={clsx('money', tone === 'positive' && 'text-positive', tone === 'negative' && 'text-negative', tone === 'muted' && 'text-muted', className)}>{money(amount, currency)}</span>
}

/** "you are owed ₹400" in green, "you owe ₹120" in red, "settled up" muted. */
export function BalanceText({ balance, currency = 'INR', subject = 'you', className }: { balance: number; currency?: string; subject?: string; className?: string }) {
  const { text, tone } = describeBalance(balance, currency, subject)
  return <span className={clsx('font-medium', tone === 'positive' && 'text-positive', tone === 'negative' && 'text-negative', tone === 'muted' && 'text-muted', className)}>{text}</span>
}

export function MonthPicker({ month, onChange, allowAll, isAll, onAll }: { month: string; onChange: (m: string) => void; allowAll?: boolean; isAll?: boolean; onAll?: () => void }) {
  const next = shiftMonth(month, 1)
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
      <button onClick={() => onChange(shiftMonth(month, -1))} className="p-1.5 rounded-full hover:bg-surface2 text-muted" aria-label="Previous month">
        <ChevronLeft size={16} />
      </button>
      <button onClick={onAll} className={clsx('min-w-[118px] text-center text-[14px] font-semibold px-1', isAll && 'text-muted')} title={allowAll ? 'Click for all months' : undefined}>
        {isAll ? 'All time' : monthLabel(month)}
      </button>
      <button onClick={() => onChange(next)} disabled={isFutureMonth(next)} className="p-1.5 rounded-full hover:bg-surface2 text-muted disabled:opacity-30" aria-label="Next month">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export function CategoryBadge({ category, size = 36 }: { category: string; size?: number }) {
  const meta = categoryMeta(category)
  return (
    <span className="inline-flex items-center justify-center rounded-[12px] shrink-0" style={{ width: size, height: size, background: meta.color + '22', fontSize: size * 0.5 }} title={meta.label}>
      {meta.emoji}
    </span>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {body && <p className="text-[13px] text-muted mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-field bg-surface2', className)} />
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[16px] font-bold">{children}</h2>
      {right}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface2 p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={clsx('px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition', value === o.value ? 'bg-surface shadow-card text-ink' : 'text-muted hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Pill({ children, tone = 'muted', className }: { children: ReactNode; tone?: 'muted' | 'positive' | 'negative' | 'accent'; className?: string }) {
  const tones = {
    muted: 'bg-surface2 text-muted',
    positive: 'bg-positive-soft text-positive',
    negative: 'bg-negative-soft text-negative',
    accent: 'bg-accent-soft text-ink',
  }
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold', tones[tone], className)}>{children}</span>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return <div className="rounded-field bg-negative-soft text-negative text-[13px] px-3.5 py-2.5">{children}</div>
}
