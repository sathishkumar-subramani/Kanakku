import { addMonths, format, isToday, isYesterday, parse, parseISO } from 'date-fns'

/** Today as "YYYY-MM-DD" in the user's local time. */
export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Current month as "YYYY-MM" in the user's local time. */
export function currentMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

export function monthKeyOf(day: string): string {
  return day.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const d = parse(month, 'yyyy-MM', new Date())
  return format(addMonths(d, delta), 'yyyy-MM')
}

/** "October 2026" */
export function monthLabel(month: string): string {
  const d = parse(month, 'yyyy-MM', new Date())
  return format(d, 'MMMM yyyy')
}

/** "Oct 2026" */
export function monthLabelShort(month: string): string {
  const d = parse(month, 'yyyy-MM', new Date())
  return format(d, 'MMM yyyy')
}

export function dayFromKey(day: string): Date {
  return parse(day, 'yyyy-MM-dd', new Date())
}

/** "Today", "Yesterday", "Tue, 21 Oct" or "21 Oct 2025" for other years. */
export function dayLabel(day: string): string {
  const d = dayFromKey(day)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return d.getFullYear() === new Date().getFullYear() ? format(d, 'EEE, d MMM') : format(d, 'd MMM yyyy')
}

/** "21 Oct" */
export function dayShort(day: string): string {
  return format(dayFromKey(day), 'd MMM')
}

/** For ISO timestamps (createdAt): "21 Oct, 7:45 pm" */
export function timestampLabel(iso: string): string {
  const d = parseISO(iso)
  return format(d, 'd MMM, h:mm a')
}

export function isFutureMonth(month: string): boolean {
  return month > currentMonthKey()
}
