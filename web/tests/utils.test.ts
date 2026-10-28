import { describe, expect, it } from 'vitest'
import { describeBalance, money, moneyCompact, round2 } from '@/utils/money'
import { previewSplit } from '@/utils/split'
import { dayLabel, monthLabel, shiftMonth, todayKey } from '@/utils/dates'

describe('money', () => {
  it('formats with Indian grouping', () => {
    expect(money(1234567.5)).toBe('₹12,34,567.50')
    expect(money(0)).toBe('₹0.00')
    expect(moneyCompact(1500)).toBe('₹1,500')
    expect(moneyCompact(1500.25)).toBe('₹1,500.25')
  })
  it('describes balances without a minus sign', () => {
    expect(describeBalance(400)).toEqual({ text: 'you are owed ₹400.00', tone: 'positive' })
    expect(describeBalance(-120)).toEqual({ text: 'you owe ₹120.00', tone: 'negative' })
    expect(describeBalance(0.004)).toEqual({ text: 'settled up', tone: 'muted' })
    expect(describeBalance(-50, 'INR', 'Arun').text).toBe('Arun owes ₹50.00')
    expect(describeBalance(50, 'INR', 'Arun').text).toBe('Arun is owed ₹50.00')
  })
  it('rounds to 2dp', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(100 / 3)).toBe(33.33)
  })
})

describe('split preview', () => {
  const rows = (vals: Record<string, number>, included = Object.keys(vals)) => Object.entries(vals).map(([userId, value]) => ({ userId, value, included: included.includes(userId) }))

  it('splits equally and gives the remainder to the payer', () => {
    const p = previewSplit(100, 'equal', rows({ a: 0, b: 0, c: 0 }), 'a')
    expect(p.valid).toBe(true)
    expect(p.amounts).toEqual({ a: 33.34, b: 33.33, c: 33.33 })
    expect(Object.values(p.amounts).reduce((s, v) => s + v, 0)).toBeCloseTo(100, 2)
  })
  it('gives the remainder to the first person when the payer is not in the split', () => {
    const p = previewSplit(100, 'equal', rows({ a: 0, b: 0, c: 0 }, ['b', 'c']), 'a')
    expect(p.amounts).toEqual({ b: 50, c: 50 })
    const q = previewSplit(10, 'equal', rows({ a: 0, b: 0, c: 0 }, ['b', 'c', 'a']).filter((r) => r.userId !== 'a'), 'a')
    expect(q.amounts).toEqual({ b: 5, c: 5 })
  })
  it('validates exact amounts', () => {
    expect(previewSplit(100, 'exact', rows({ a: 60, b: 30 }), 'a')).toMatchObject({ valid: false, message: '10.00 left to allocate', remaining: 10 })
    expect(previewSplit(100, 'exact', rows({ a: 60, b: 50 }), 'a')).toMatchObject({ valid: false, message: '10.00 over the total' })
    expect(previewSplit(100, 'exact', rows({ a: 60, b: 40 }), 'a')).toMatchObject({ valid: true, amounts: { a: 60, b: 40 } })
  })
  it('validates percentages and shares', () => {
    expect(previewSplit(100, 'percent', rows({ a: 50, b: 25 }), 'a').valid).toBe(false)
    expect(previewSplit(100, 'percent', rows({ a: 50, b: 50 }), 'a').amounts).toEqual({ a: 50, b: 50 })
    expect(previewSplit(100, 'shares', rows({ a: 2, b: 1 }), 'b').amounts).toEqual({ a: 66.67, b: 33.33 })
    expect(previewSplit(100, 'shares', rows({ a: 0, b: 1 }), 'b').valid).toBe(false)
  })
  it('rejects empty selections and zero amounts', () => {
    expect(previewSplit(0, 'equal', rows({ a: 0 }), 'a').valid).toBe(false)
    expect(previewSplit(10, 'equal', rows({ a: 0 }, []), 'a').message).toBe('Select at least one person.')
  })
})

describe('dates', () => {
  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(monthLabel('2026-10')).toBe('October 2026')
  })
  it('labels today', () => {
    expect(dayLabel(todayKey())).toBe('Today')
  })
})
