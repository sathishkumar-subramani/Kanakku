import type { QueryClient } from '@tanstack/react-query';

import { ApiError, expensesApi, personalApi, settlementsApi } from '@/api';
import type { Category, DayString } from '@/api/types';
import { round2 } from '@/utils/money';
import type { InboxItem, SavedAs } from './store';

export type Choice =
  | { kind: 'personal'; description: string; category: Category; date: DayString; amount: number }
  | { kind: 'group'; groupId: string; splitWith: string[]; description: string; category: Category; date: DayString; amount: number }
  | { kind: 'settlement'; groupId: string; fromUserId: string; toUserId: string; date: DayString; amount: number };

/** Thrown when the server already has this payment (e.g. your roommate added it from their SMS first). */
export class AlreadyRecordedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AlreadyRecordedError';
  }
}

const SOURCE_NOTE: Record<string, string> = { sms: 'Added from bank SMS', notification: 'Added from UPI notification' };

/** Create the expense / payment for a captured item. The capture key goes along as `sourceRef` so it is never added twice. */
export async function saveCaptured(item: InboxItem, choice: Choice, meId: string, qc?: QueryClient): Promise<SavedAs> {
  const sourceRef = item.key;
  const amount = round2(choice.amount);
  try {
    let saved: SavedAs;
    if (choice.kind === 'personal') {
      const p = await personalApi.create({ description: choice.description, amount, category: choice.category, date: choice.date, notes: SOURCE_NOTE[item.source], sourceRef });
      saved = { kind: 'personal', id: p.id, groupId: null };
    } else if (choice.kind === 'group') {
      const e = await expensesApi.create(choice.groupId, {
        description: choice.description,
        amount,
        category: choice.category,
        date: choice.date,
        notes: SOURCE_NOTE[item.source],
        paidBy: meId,
        splitType: 'equal',
        splits: choice.splitWith.map((userId) => ({ userId, value: 0 })),
        sourceRef,
      });
      saved = { kind: 'expense', id: e.id, groupId: choice.groupId };
    } else {
      const s = await settlementsApi.create(choice.groupId, { fromUserId: choice.fromUserId, toUserId: choice.toUserId, amount, date: choice.date, note: 'UPI', sourceRef });
      saved = { kind: 'settlement', id: s.id, groupId: choice.groupId };
    }
    refresh(qc);
    return saved;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      refresh(qc);
      throw new AlreadyRecordedError(err.message);
    }
    throw err;
  }
}

/** Undo: delete what was created for this item. */
export async function unsaveCaptured(saved: SavedAs, qc?: QueryClient): Promise<void> {
  try {
    if (saved.kind === 'personal') await personalApi.remove(saved.id);
    else if (saved.kind === 'expense') await expensesApi.remove(saved.id);
    else await settlementsApi.remove(saved.id);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }
  refresh(qc);
}

function refresh(qc?: QueryClient) {
  if (!qc) return;
  for (const key of [['dashboard'], ['groups'], ['personal'], ['expenses'], ['reports']]) qc.invalidateQueries({ queryKey: key });
}
