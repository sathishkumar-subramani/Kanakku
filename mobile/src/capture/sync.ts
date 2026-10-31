import type { QueryClient } from '@tanstack/react-query';

import { captureApi } from '@/api';
import type { CaptureRule, Group } from '@/api/types';
import { dayOf, parseMessage, type ParsedTxn, type RawMessage, type SmsTemplate } from './parser';
import { drainNotifications, hasSmsPermission, readSms } from './native';
import { saveCaptured, AlreadyRecordedError, type Choice } from './save';
import { useCaptureStore } from './store';
import { suggestFor, type Suggestion } from './suggest';

export type SyncContext = {
  meId: string;
  rules: CaptureRule[];
  groups: Group[];
  templates: SmsTemplate[];
  qc?: QueryClient;
};

const FIRST_SCAN_DAYS = 30;
const OVERLAP_MS = 10 * 60_000;
let running: Promise<SyncResult> | null = null;

export type SyncResult = { added: number; autoSaved: number; ignored: number };

/**
 * Pull new bank SMS + caught notifications, parse them on the phone, drop anything the server already
 * has (e.g. a roommate recorded the same UPI payment), then apply the user's "save automatically" rules.
 */
export function syncCapture(ctx: SyncContext, opts: { sms?: boolean } = {}): Promise<SyncResult> {
  if (running) return running;
  running = run(ctx, opts).finally(() => {
    running = null;
  });
  return running;
}

async function run(ctx: SyncContext, opts: { sms?: boolean }): Promise<SyncResult> {
  const store = useCaptureStore.getState();
  if (!store.hydrated) return { added: 0, autoSaved: 0, ignored: 0 };
  const templates = [...store.localTemplates, ...ctx.templates];
  const raw: RawMessage[] = [];

  if (opts.sms !== false && store.settings.smsEnabled && hasSmsPermission()) {
    const now = Date.now();
    const since = store.settings.lastSmsScan > 0 ? store.settings.lastSmsScan - OVERLAP_MS : now - FIRST_SCAN_DAYS * 86_400_000;
    const sms = await readSms(since, 800);
    raw.push(...sms);
    const newest = sms.reduce((mx, m) => Math.max(mx, m.timestamp), 0);
    // next time, start from here (minus a small overlap; duplicates are dropped by key)
    useCaptureStore.getState().setSettings({ lastSmsScan: Math.max(newest, now) });
  }
  raw.push(...drainNotifications());

  const parsed = raw.map((m) => parseMessage(m, templates)).filter((t): t is ParsedTxn => t != null);
  const added = parsed.length ? useCaptureStore.getState().ingest(parsed) : [];

  await markRecorded();

  // Rules the user set up: "always skip" and "save automatically".
  let autoSaved = 0;
  let ignored = 0;
  for (const key of added) {
    const item = useCaptureStore.getState().items[key];
    if (!item || item.status !== 'pending') continue;
    const s = suggestFor(item, ctx);
    if (!s.rule) continue;
    if (s.kind === 'ignore') {
      useCaptureStore.getState().setStatus(key, 'ignored');
      ignored++;
      continue;
    }
    if (!s.rule.autoSave) continue;
    const choice = choiceFrom(item, s);
    if (!choice) continue;
    try {
      const saved = await saveCaptured(item, choice, ctx.meId, ctx.qc);
      useCaptureStore.getState().setStatus(key, 'saved', { ...saved, auto: true });
      autoSaved++;
    } catch (err) {
      if (err instanceof AlreadyRecordedError) useCaptureStore.getState().setStatus(key, 'recorded');
      // network error → leave it in the inbox; the user can save it by hand
    }
  }
  return { added: added.length, autoSaved, ignored };
}

/** Ask the server which pending items are already recorded (by me on another phone, or by a roommate). */
async function markRecorded() {
  const pending = Object.values(useCaptureStore.getState().items).filter((i) => i.status === 'pending');
  if (pending.length === 0) return;
  try {
    const { recorded } = await captureApi.match(pending.slice(0, 1000).map((i) => i.key));
    for (const [key, ref] of Object.entries(recorded)) useCaptureStore.getState().setStatus(key, 'recorded', { kind: ref.kind, id: ref.id, groupId: ref.groupId });
  } catch {
    // offline — try next time
  }
}

/** Turn a suggestion into something saveable (null for ignore). */
export function choiceFrom(item: ParsedTxn, s: Suggestion): Choice | null {
  const date = item.date || dayOf(item.timestamp);
  switch (s.kind) {
    case 'personal':
      return { kind: 'personal', description: s.description, category: s.category, date, amount: item.amount };
    case 'group':
      return { kind: 'group', groupId: s.groupId, splitWith: s.splitWith, description: s.description, category: s.category, date, amount: item.amount };
    case 'settlement':
      return { kind: 'settlement', groupId: s.groupId, fromUserId: s.fromUserId, toUserId: s.toUserId, date, amount: item.amount };
    case 'ignore':
      return null;
  }
}
