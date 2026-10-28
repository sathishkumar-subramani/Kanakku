/**
 * Calendar-day helpers. The API uses "YYYY-MM-DD" for expense dates and "YYYY-MM" for months.
 * We always format from LOCAL date parts — never `toISOString()` (IST midnight would become the previous UTC day).
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local Date → "YYYY-MM-DD" */
export function toDayString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local Date → "YYYY-MM" */
export function toMonthString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function todayString(): string {
  return toDayString(new Date());
}

export function currentMonth(): string {
  return toMonthString(new Date());
}

/** "YYYY-MM-DD" (or any ISO string) → local Date at midnight of that calendar day. */
export function parseDay(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(day);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** "YYYY-MM" → { year, month(1-12) } */
export function parseMonth(month: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})/.exec(month);
  if (!m) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function shiftMonth(month: string, delta: number): string {
  const { year, month: mo } = parseMonth(month);
  const d = new Date(year, mo - 1 + delta, 1);
  return toMonthString(d);
}

export function isFutureMonth(month: string): boolean {
  return month > currentMonth();
}

/** "2026-10" → "Oct 2026" */
export function formatMonthLabel(month: string, long = false): string {
  const { year, month: mo } = parseMonth(month);
  return `${(long ? MONTHS_LONG : MONTHS_SHORT)[mo - 1]} ${year}`;
}

/** "2026-10-28" → "Tue, 28 Oct" (adds year when not current year). */
export function formatDay(day: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = parseDay(day);
  const now = new Date();
  const parts: string[] = [];
  if (opts.weekday) parts.push(`${DAYS_SHORT[d.getDay()]},`);
  parts.push(`${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`);
  if (opts.year || d.getFullYear() !== now.getFullYear()) parts.push(String(d.getFullYear()));
  return parts.join(' ');
}

/** Group header style: "Today", "Yesterday", or "Tue, 28 Oct". */
export function formatDayHeading(day: string): string {
  const today = todayString();
  if (day === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (day === toDayString(y)) return 'Yesterday';
  return formatDay(day, { weekday: true });
}

/** Relative time for activity rows from an ISO timestamp. */
export function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDay(toDayString(new Date(t)));
}

/** Day-of-month from "YYYY-MM-DD". */
export function dayOfMonth(day: string): number {
  return parseDay(day).getDate();
}

/** Group a list by its calendar day, preserving input order (expects newest first). */
export function groupByDay<T>(items: T[], getDay: (item: T) => string): { day: string; items: T[] }[] {
  const out: { day: string; items: T[] }[] = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const day = getDay(item).slice(0, 10);
    const i = index.get(day);
    if (i === undefined) {
      index.set(day, out.length);
      out.push({ day, items: [item] });
    } else {
      out[i]?.items.push(item);
    }
  }
  return out;
}
