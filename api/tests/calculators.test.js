import { describe, expect, it } from 'vitest'
import { computeSplits, memberTotals, pairwiseDebts, simplifyDebts } from '../src/services/calculators.js'
import { money, monthRange, parseDay, round2 } from '../src/lib/util.js'

const A = 'a'
const B = 'b'
const C = 'c'
const sumOf = (splits) => round2(splits.reduce((t, s) => t + s.amount, 0))

describe('computeSplits', () => {
  it('splits equally and gives the rounding remainder to the payer', () => {
    const s = computeSplits(100, 'equal', A, [{ userId: A }, { userId: B }, { userId: C }])
    expect(s.map((x) => x.amount)).toEqual([33.34, 33.33, 33.33])
    expect(sumOf(s)).toBe(100)
  })
  it('gives the remainder to the first split when the payer is not included', () => {
    const s = computeSplits(100, 'equal', A, [{ userId: B }, { userId: C }, { userId: 'd' }])
    expect(s.map((x) => x.amount)).toEqual([33.34, 33.33, 33.33])
  })
  it('validates exact amounts', () => {
    expect(() => computeSplits(100, 'exact', A, [{ userId: A, value: 60 }, { userId: B, value: 30 }])).toThrow(/add up to 90.00/)
    expect(computeSplits(100, 'exact', A, [{ userId: A, value: 60 }, { userId: B, value: 40 }]).map((x) => x.amount)).toEqual([60, 40])
  })
  it('validates percentages and shares', () => {
    expect(() => computeSplits(100, 'percent', A, [{ userId: A, value: 50 }, { userId: B, value: 25 }])).toThrow(/100%/)
    expect(computeSplits(100, 'percent', A, [{ userId: A, value: 50 }, { userId: B, value: 50 }]).map((x) => x.amount)).toEqual([50, 50])
    const shares = computeSplits(100, 'shares', B, [{ userId: A, value: 2 }, { userId: B, value: 1 }])
    expect(shares.map((x) => x.amount)).toEqual([66.67, 33.33])
    expect(() => computeSplits(100, 'shares', B, [{ userId: A, value: 0 }])).toThrow(/greater than 0/)
  })
  it('rejects duplicates and empty splits', () => {
    expect(() => computeSplits(10, 'equal', A, [])).toThrow(/at least one/)
    expect(() => computeSplits(10, 'equal', A, [{ userId: A }, { userId: A }])).toThrow(/twice/)
  })
  it('always sums to the total for awkward amounts', () => {
    for (const amount of [0.01, 0.02, 1, 7.77, 999.99, 123456.78]) {
      for (const n of [1, 2, 3, 6, 7]) {
        const s = computeSplits(amount, 'equal', A, Array.from({ length: n }, (_, i) => ({ userId: `u${i}` })))
        expect(sumOf(s)).toBe(round2(amount))
      }
    }
  })
})

describe('balances', () => {
  // A pays 1500 equal 3-way; B pays 900 equal 3-way; C pays 600 exact A=200, C=400
  const expenses = [
    { paidBy: A, amount: 1500, splits: computeSplits(1500, 'equal', A, [{ userId: A }, { userId: B }, { userId: C }]) },
    { paidBy: B, amount: 900, splits: computeSplits(900, 'equal', B, [{ userId: A }, { userId: B }, { userId: C }]) },
    { paidBy: C, amount: 600, splits: computeSplits(600, 'exact', C, [{ userId: A, value: 200 }, { userId: C, value: 400 }]) },
  ]

  it('computes paid / share / balance per member', () => {
    const t = memberTotals([A, B, C], expenses, [])
    expect(t.get(A)).toEqual({ paid: 1500, share: 1000, balance: 500 })
    expect(t.get(B)).toEqual({ paid: 900, share: 800, balance: 100 })
    expect(t.get(C)).toEqual({ paid: 600, share: 1200, balance: -600 })
  })

  it('simplifies debts: C→A 500, C→B 100', () => {
    const t = memberTotals([A, B, C], expenses, [])
    const net = new Map([...t].map(([id, v]) => [id, v.balance]))
    expect(simplifyDebts(net)).toEqual([
      { fromUserId: C, toUserId: A, amount: 500 },
      { fromUserId: C, toUserId: B, amount: 100 },
    ])
  })

  it('pairwise debts net both directions', () => {
    const debts = pairwiseDebts(expenses, [])
    const find = (f, t) => debts.find((d) => d.fromUserId === f && d.toUserId === t)?.amount
    expect(find(C, A)).toBe(300)
    expect(find(C, B)).toBe(300)
    expect(find(B, A)).toBe(200)
    expect(debts).toHaveLength(3)
  })

  it('applies settlements', () => {
    const t = memberTotals([A, B, C], expenses, [{ fromUserId: C, toUserId: A, amount: 500 }])
    expect(t.get(A).balance).toBe(0)
    expect(t.get(B).balance).toBe(100)
    expect(t.get(C).balance).toBe(-100)
    const net = new Map([...t].map(([id, v]) => [id, v.balance]))
    expect(simplifyDebts(net)).toEqual([{ fromUserId: C, toUserId: B, amount: 100 }])
  })

  it('simplify reduces A→B→C chains to a single transfer', () => {
    // A owes B 100, B owes C 100 → net A −100, B 0, C +100
    const net = new Map([
      [A, -100],
      [B, 0],
      [C, 100],
    ])
    expect(simplifyDebts(net)).toEqual([{ fromUserId: A, toUserId: C, amount: 100 }])
  })
})

describe('util', () => {
  it('parses calendar days as UTC midnight and rejects bad ones', () => {
    expect(parseDay('2026-10-28').toISOString()).toBe('2026-10-28T00:00:00.000Z')
    expect(parseDay('2026-10-28T18:30:00.000Z').toISOString()).toBe('2026-10-28T00:00:00.000Z')
    expect(() => parseDay('28/10/2026')).toThrow(/YYYY-MM-DD/)
    expect(() => parseDay('2026-02-30')).toThrow(/does not exist/)
  })
  it('builds month ranges', () => {
    const r = monthRange('2026-12')
    expect(r.start.toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(r.end.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(r.key).toBe('2026-12')
    expect(() => monthRange('2026-13')).toThrow()
  })
  it('formats money with Indian grouping', () => {
    expect(money(1234567.5)).toBe('₹12,34,567.50')
    expect(money(-120)).toBe('-₹120.00')
    expect(money(99.5, 'USD')).toBe('$99.50')
  })
})
