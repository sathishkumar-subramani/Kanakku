import type { SplitType } from '@/api/types'
import { round2 } from './money'

export interface SplitRow {
  userId: string
  included: boolean
  value: number // rupees for exact, % for percent, share count for shares; ignored for equal
}

export interface SplitPreview {
  amounts: Record<string, number>
  valid: boolean
  message: string // "" when valid
  remaining: number // what is still unallocated (exact: rupees, percent: %, shares: n/a)
}

/**
 * Client-side mirror of the API's SplitCalculator so the form can show live amounts and block an invalid save.
 * Rounding remainder goes to the payer (or the first included row).
 */
export function previewSplit(amount: number, type: SplitType, rows: SplitRow[], paidBy: string): SplitPreview {
  const included = rows.filter((r) => r.included)
  const amounts: Record<string, number> = {}
  if (!(amount > 0)) return { amounts, valid: false, message: 'Enter an amount first.', remaining: 0 }
  if (included.length === 0) return { amounts, valid: false, message: 'Select at least one person.', remaining: amount }

  let message = ''
  let remaining = 0

  switch (type) {
    case 'equal': {
      const each = round2(amount / included.length)
      included.forEach((r) => (amounts[r.userId] = each))
      break
    }
    case 'exact': {
      const sum = round2(included.reduce((s, r) => s + (r.value || 0), 0))
      remaining = round2(amount - sum)
      included.forEach((r) => (amounts[r.userId] = round2(r.value || 0)))
      if (Math.abs(remaining) > 0.01) message = remaining > 0 ? `${remaining.toFixed(2)} left to allocate` : `${(-remaining).toFixed(2)} over the total`
      if (included.some((r) => r.value < 0)) message = 'Amounts cannot be negative.'
      break
    }
    case 'percent': {
      const sum = included.reduce((s, r) => s + (r.value || 0), 0)
      remaining = round2(100 - sum)
      included.forEach((r) => (amounts[r.userId] = round2((amount * (r.value || 0)) / 100)))
      if (Math.abs(remaining) > 0.01) message = remaining > 0 ? `${remaining}% left` : `${-remaining}% over 100%`
      if (included.some((r) => r.value < 0)) message = 'Percentages cannot be negative.'
      break
    }
    case 'shares': {
      const total = included.reduce((s, r) => s + (r.value || 0), 0)
      if (total <= 0 || included.some((r) => !(r.value > 0))) {
        message = 'Every included person needs at least 1 share.'
        included.forEach((r) => (amounts[r.userId] = 0))
      } else {
        included.forEach((r) => (amounts[r.userId] = round2((amount * r.value) / total)))
      }
      break
    }
  }

  if (!message) {
    const allocated = round2(Object.values(amounts).reduce((s, v) => s + v, 0))
    const diff = round2(amount - allocated)
    if (diff !== 0) {
      const target = included.find((r) => r.userId === paidBy) ?? included[0]
      amounts[target.userId] = round2((amounts[target.userId] ?? 0) + diff)
    }
  }

  return { amounts, valid: !message, message, remaining }
}
