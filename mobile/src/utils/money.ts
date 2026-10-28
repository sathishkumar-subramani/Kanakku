const SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SGD: 'S$',
};

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'INR', label: 'Indian rupee' },
  { code: 'USD', label: 'US dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British pound' },
  { code: 'AED', label: 'UAE dirham' },
  { code: 'SGD', label: 'Singapore dollar' },
];

const formatterCache = new Map<string, Intl.NumberFormat | null>();

function getFormatter(currency: string): Intl.NumberFormat | null {
  if (formatterCache.has(currency)) return formatterCache.get(currency) ?? null;
  let fmt: Intl.NumberFormat | null = null;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function') {
      fmt = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      // Sanity check: Hermes without ICU data may return a plain number.
      const probe = fmt.format(1234567.5);
      if (!/12,34,567/.test(probe) && !/1,234,567/.test(probe)) fmt = null;
    }
  } catch {
    fmt = null;
  }
  formatterCache.set(currency, fmt);
  return fmt;
}

/** Indian grouping fallback: 12,34,567.00 */
export function indianGroup(value: number, fractionDigits = 2): string {
  const abs = Math.abs(value);
  const fixed = abs.toFixed(fractionDigits);
  const [intPart, frac] = fixed.split('.');
  const int = intPart ?? '0';
  let grouped: string;
  if (int.length <= 3) {
    grouped = int;
  } else {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`;
  }
  return frac !== undefined && fractionDigits > 0 ? `${grouped}.${frac}` : grouped;
}

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `;
}

/** "₹1,250.50" — always a non-negative-looking string unless `signed` is requested. */
export function formatMoney(value: number, currency = 'INR', opts: { signed?: boolean; compact?: boolean } = {}): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n);
  const sign = opts.signed && n < 0 ? '-' : opts.signed && n > 0 ? '+' : '';
  const fmt = getFormatter(currency);
  let body: string;
  if (opts.compact && abs >= 100000) {
    body = `${currencySymbol(currency)}${(abs / 100000).toFixed(abs >= 1000000 ? 1 : 2).replace(/\.?0+$/, '')}L`;
  } else if (opts.compact && abs >= 10000) {
    body = `${currencySymbol(currency)}${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  } else if (fmt) {
    body = fmt.format(abs).replace(/ /g, '');
  } else {
    body = `${currencySymbol(currency)}${indianGroup(abs)}`;
  }
  return `${sign}${body}`;
}

/** Whole-rupee style for axis labels. */
export function formatMoneyShort(value: number, currency = 'INR'): string {
  const abs = Math.abs(value);
  const sym = currencySymbol(currency);
  if (abs >= 100000) return `${sym}${(abs / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1000) return `${sym}${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sym}${Math.round(abs)}`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Parse a user-typed amount; returns NaN when invalid. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^\d.]/g, '');
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export type BalanceTone = 'positive' | 'negative' | 'muted';

/** DESIGN.md: never show a raw minus sign for balances. */
export function describeBalance(
  balance: number,
  currency = 'INR',
  wording: 'you' | 'they' = 'you',
  name?: string,
): { text: string; tone: BalanceTone } {
  const b = round2(balance);
  if (Math.abs(b) < 0.005) return { text: 'settled up', tone: 'muted' };
  const amt = formatMoney(Math.abs(b), currency);
  if (wording === 'they') {
    const who = name ?? 'They';
    return b > 0 ? { text: `${who} gets back ${amt}`, tone: 'positive' } : { text: `${who} owes ${amt}`, tone: 'negative' };
  }
  return b > 0 ? { text: `you are owed ${amt}`, tone: 'positive' } : { text: `you owe ${amt}`, tone: 'negative' };
}
