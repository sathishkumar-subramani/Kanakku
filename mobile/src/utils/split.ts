/**
 * Split maths mirroring the "Balance rules" in docs/API.md:
 *  - all money rounded to 2 dp
 *  - rounding remainders (±0.01) go to the payer's own split, so splits always sum to the amount
 *  - exact: values must sum to amount; percent: must sum to 100; shares: positive integers
 */
import type { SplitInput, SplitType } from '@/api/types';
import { round2 } from './money';

export type ComputedSplit = { userId: string; value: number; amount: number };

export type SplitValidation = {
  ok: boolean;
  /** Message to show under the split editor when not ok. */
  message?: string;
  /** Live indicator, e.g. "₹120.00 remaining" or "15% left" (raw numbers, UI formats). */
  remaining: number;
  splits: ComputedSplit[];
};

const toCents = (n: number) => Math.round(n * 100);

/**
 * Compute per-member amounts for a split. `values` holds the user-entered value per userId
 * (ignored for equal). Members not present in `values` are not part of the split.
 */
export function computeSplits(
  type: SplitType,
  amount: number,
  values: Record<string, number>,
  payerId: string,
): SplitValidation {
  const userIds = Object.keys(values);
  const totalCents = toCents(amount);
  const empty: SplitValidation = { ok: false, remaining: amount, splits: [] };

  if (!(amount > 0)) return { ...empty, message: 'Enter an amount first.' };
  if (userIds.length === 0) return { ...empty, message: 'Pick at least one person to split with.' };

  // Who absorbs the rounding remainder: the payer if included, else the first member.
  const remainderTarget = userIds.includes(payerId) ? payerId : userIds[0]!;

  const finish = (cents: Record<string, number>): ComputedSplit[] => {
    const sum = userIds.reduce((s, id) => s + (cents[id] ?? 0), 0);
    const diff = totalCents - sum;
    if (diff !== 0) cents[remainderTarget] = (cents[remainderTarget] ?? 0) + diff;
    return userIds.map((id) => ({ userId: id, value: values[id] ?? 0, amount: (cents[id] ?? 0) / 100 }));
  };

  switch (type) {
    case 'equal': {
      const base = Math.floor(totalCents / userIds.length);
      const cents: Record<string, number> = {};
      for (const id of userIds) cents[id] = base;
      return { ok: true, remaining: 0, splits: finish(cents) };
    }
    case 'exact': {
      const cents: Record<string, number> = {};
      let sum = 0;
      for (const id of userIds) {
        const v = values[id] ?? 0;
        if (v < 0) return { ...empty, message: 'Amounts cannot be negative.' };
        cents[id] = toCents(v);
        sum += cents[id] ?? 0;
      }
      const remaining = (totalCents - sum) / 100;
      if (sum !== totalCents) {
        return {
          ok: false,
          remaining,
          message: remaining > 0 ? `${round2(remaining)} still to assign.` : `Over by ${round2(-remaining)}.`,
          splits: userIds.map((id) => ({ userId: id, value: values[id] ?? 0, amount: (cents[id] ?? 0) / 100 })),
        };
      }
      return { ok: true, remaining: 0, splits: finish(cents) };
    }
    case 'percent': {
      let pct = 0;
      for (const id of userIds) {
        const v = values[id] ?? 0;
        if (v < 0) return { ...empty, message: 'Percentages cannot be negative.' };
        pct += v;
      }
      const pctRounded = Math.round(pct * 100) / 100;
      const remaining = round2(100 - pctRounded);
      if (Math.abs(remaining) > 0.004) {
        return {
          ok: false,
          remaining,
          message: remaining > 0 ? `${remaining}% left.` : `Over by ${-remaining}%.`,
          splits: userIds.map((id) => ({
            userId: id,
            value: values[id] ?? 0,
            amount: Math.floor((totalCents * (values[id] ?? 0)) / 100) / 100,
          })),
        };
      }
      const cents: Record<string, number> = {};
      for (const id of userIds) cents[id] = Math.floor((totalCents * (values[id] ?? 0)) / 100);
      return { ok: true, remaining: 0, splits: finish(cents) };
    }
    case 'shares': {
      let total = 0;
      for (const id of userIds) {
        const v = values[id] ?? 0;
        if (!Number.isInteger(v) || v < 0) return { ...empty, message: 'Shares must be whole numbers.' };
        total += v;
      }
      if (total <= 0) return { ...empty, message: 'Give at least one share.' };
      const cents: Record<string, number> = {};
      for (const id of userIds) cents[id] = Math.floor((totalCents * (values[id] ?? 0)) / total);
      return { ok: true, remaining: 0, splits: finish(cents) };
    }
    default:
      return empty;
  }
}

/** Convert a validated split into the API body shape. */
export function toSplitInputs(type: SplitType, splits: ComputedSplit[]): SplitInput[] {
  return splits.map((s) => ({ userId: s.userId, value: type === 'equal' ? 0 : s.value }));
}

/** Default value per member when switching split type, so the editor starts balanced. */
export function defaultValuesFor(type: SplitType, memberIds: string[], amount: number): Record<string, number> {
  const out: Record<string, number> = {};
  const n = memberIds.length || 1;
  for (const id of memberIds) {
    switch (type) {
      case 'exact':
        out[id] = round2(amount / n);
        break;
      case 'percent':
        out[id] = round2(100 / n);
        break;
      case 'shares':
        out[id] = 1;
        break;
      default:
        out[id] = 0;
    }
  }
  // Fix the drift so defaults validate: top up the first member.
  if (memberIds.length > 0 && type !== 'equal' && type !== 'shares') {
    const target = type === 'exact' ? amount : 100;
    const sum = memberIds.reduce((s, id) => s + (out[id] ?? 0), 0);
    const first = memberIds[0]!;
    out[first] = round2((out[first] ?? 0) + (target - sum));
  }
  return out;
}
