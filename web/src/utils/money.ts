const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string) {
  let f = formatters.get(currency)
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 2 })
    } catch {
      f = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    formatters.set(currency, f)
  }
  return f
}

/** ₹12,34,567.50 (Indian grouping). */
export function money(amount: number, currency = 'INR'): string {
  return formatter(currency).format(amount)
}

/** Same as money() but drops ".00" when the number is whole – for big tiles. */
export function moneyCompact(amount: number, currency = 'INR'): string {
  const s = money(amount, currency)
  return s.endsWith('.00') ? s.slice(0, -3) : s
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function isZero(n: number): boolean {
  return Math.abs(n) < 0.005
}

export type BalanceTone = 'positive' | 'negative' | 'muted'

/** "you are owed ₹400" / "you owe ₹120" / "settled up" — never a raw minus sign. */
export function describeBalance(balance: number, currency = 'INR', subject = 'you'): { text: string; tone: BalanceTone } {
  if (isZero(balance)) return { text: 'settled up', tone: 'muted' }
  const isYou = subject === 'you'
  if (balance > 0) return { text: `${subject} ${isYou ? 'are' : 'is'} owed ${money(balance, currency)}`, tone: 'positive' }
  return { text: `${subject} owe${isYou ? '' : 's'} ${money(-balance, currency)}`, tone: 'negative' }
}

export function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : 0
}
