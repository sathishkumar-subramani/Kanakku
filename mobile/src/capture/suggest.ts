import type { CaptureRule, Category, Group, GroupMember } from '@/api/types';
import { normalizeName, ruleKeysFor, type ParsedTxn } from './parser';

/** What Kanakku thinks a captured payment is. The user always gets to change it. */
export type Suggestion =
  | { kind: 'personal'; category: Category; description: string; rule?: CaptureRule }
  | { kind: 'group'; groupId: string; splitWith: string[]; category: Category; description: string; rule?: CaptureRule }
  | { kind: 'settlement'; groupId: string; otherUserId: string; fromUserId: string; toUserId: string; rule?: CaptureRule }
  | { kind: 'ignore'; reason: string; rule?: CaptureRule };

const SHARED_CATEGORIES: Category[] = ['groceries', 'utilities', 'rent', 'household'];

/** A real person/shop name, not just the VPA. */
export function displayName(t: Pick<ParsedTxn, 'counterparty' | 'vpa'>): string | null {
  if (t.counterparty && t.counterparty !== t.vpa) return t.counterparty;
  return t.counterparty ?? t.vpa ?? null;
}

export function findRule(t: Pick<ParsedTxn, 'counterparty' | 'vpa'>, rules: CaptureRule[]): CaptureRule | undefined {
  const keys = ruleKeysFor(t);
  for (const k of keys) {
    const r = rules.find((x) => x.key === k);
    if (r) return r;
  }
  const name = t.counterparty && t.counterparty !== t.vpa ? normalizeName(t.counterparty) : null;
  return name ? rules.find((x) => x.label && normalizeName(x.label) === name) : undefined;
}

/**
 * Is the other side of this payment one of my roommates? Matches the payee name against member
 * names ("ARUN KUMAR" ↔ "Arun") and the VPA against names / email ids ("arun.k@okicici" ↔ arun.k@gmail.com).
 */
export function findRoommate(t: Pick<ParsedTxn, 'counterparty' | 'vpa'>, groups: Group[], meId: string): { group: Group; member: GroupMember } | null {
  const name = t.counterparty && t.counterparty !== t.vpa ? normalizeName(t.counterparty) : null;
  const vpaLocal = t.vpa ? t.vpa.split('@')[0].toLowerCase() : null;
  const vpaLetters = vpaLocal?.replace(/[^a-z]/g, '') ?? '';

  const hits: { group: Group; member: GroupMember; score: number }[] = [];
  for (const g of groups) {
    for (const m of g.members) {
      if (m.userId === meId) continue;
      const full = normalizeName(m.name);
      const first = full.split(' ')[0] ?? '';
      const emailLocal = m.email.split('@')[0]?.toLowerCase() ?? '';
      let score = 0;
      if (name) {
        if (name === full) score = 3;
        else if (first.length >= 3 && (name === first || name.startsWith(`${first} `) || full.startsWith(`${name} `))) score = 2;
      }
      if (!score && vpaLocal) {
        if (emailLocal && vpaLocal === emailLocal) score = 3;
        else if (first.length >= 3 && vpaLetters.startsWith(first)) score = 1;
      }
      if (score) hits.push({ group: g, member: m, score });
    }
  }
  if (hits.length === 0) return null;
  // Best match; on a tie prefer a group where money is actually owed.
  hits.sort((a, b) => b.score - a.score || Math.abs(b.group.myBalance) - Math.abs(a.group.myBalance));
  return { group: hits[0].group, member: hits[0].member };
}

export function suggestFor(t: ParsedTxn, ctx: { rules: CaptureRule[]; groups: Group[]; meId: string }): Suggestion {
  const name = displayName(t) ?? (t.direction === 'debit' ? 'UPI payment' : 'Money received');
  const rule = findRule(t, ctx.rules);

  if (rule) {
    const group = rule.groupId ? ctx.groups.find((g) => g.id === rule.groupId) : undefined;
    if (rule.kind === 'ignore') return { kind: 'ignore', reason: 'You chose to skip this payee', rule };
    if (rule.kind === 'settlement' && group && rule.counterpartyUserId) {
      const other = rule.counterpartyUserId;
      return t.direction === 'debit'
        ? { kind: 'settlement', groupId: group.id, otherUserId: other, fromUserId: ctx.meId, toUserId: other, rule }
        : { kind: 'settlement', groupId: group.id, otherUserId: other, fromUserId: other, toUserId: ctx.meId, rule };
    }
    if (t.direction === 'debit') {
      const category = (rule.category ?? t.categoryGuess) as Category;
      const description = rule.description || name;
      if (rule.kind === 'group' && group) {
        const members = group.members.map((m) => m.userId);
        const splitWith = rule.splitWith.filter((u) => members.includes(u));
        return { kind: 'group', groupId: group.id, splitWith: splitWith.length ? splitWith : members, category, description, rule };
      }
      if (rule.kind === 'personal') return { kind: 'personal', category, description, rule };
    }
  }

  const mate = findRoommate(t, ctx.groups, ctx.meId);
  if (mate) {
    const other = mate.member.userId;
    return t.direction === 'debit'
      ? { kind: 'settlement', groupId: mate.group.id, otherUserId: other, fromUserId: ctx.meId, toUserId: other }
      : { kind: 'settlement', groupId: mate.group.id, otherUserId: other, fromUserId: other, toUserId: ctx.meId };
  }

  if (t.direction === 'credit') return { kind: 'ignore', reason: 'Money received' };
  if (t.method === 'atm') return { kind: 'ignore', reason: 'Cash withdrawal' };

  const category = t.categoryGuess as Category;
  const group = [...ctx.groups].sort((a, b) => b.monthSpent - a.monthSpent)[0];
  if (group && SHARED_CATEGORIES.includes(category)) {
    return { kind: 'group', groupId: group.id, splitWith: group.members.map((m) => m.userId), category, description: name };
  }
  return { kind: 'personal', category, description: name };
}

export function describeSuggestion(s: Suggestion, groups: Group[], meId: string): string {
  const g = 'groupId' in s ? groups.find((x) => x.id === s.groupId) : undefined;
  switch (s.kind) {
    case 'personal':
      return 'Personal';
    case 'group':
      return `${g ? `${g.emoji} ${g.name}` : 'Group'} · split ${s.splitWith.length}`;
    case 'settlement': {
      const other = g?.members.find((m) => m.userId === s.otherUserId)?.name ?? 'roommate';
      return s.fromUserId === meId ? `You paid ${other} back` : `${other} paid you back`;
    }
    case 'ignore':
      return s.reason;
  }
}
