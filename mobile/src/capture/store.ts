import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { mergeDuplicates, type ParsedTxn, type SmsTemplate } from './parser';

/**
 * The payment inbox lives only on this phone (AsyncStorage, per signed-in user).
 * Raw message text stays here; the server only ever sees what the user confirms.
 */

export type InboxStatus = 'pending' | 'saved' | 'ignored' | 'recorded';
export type SavedAs = { kind: 'personal' | 'expense' | 'settlement'; id: string; groupId: string | null; auto?: boolean };
export type InboxItem = ParsedTxn & { status: InboxStatus; savedAs?: SavedAs; seenAt: number; handledAt?: number };

export type CaptureSettings = {
  /** user turned on bank-SMS reading */
  smsEnabled: boolean;
  /** newest SMS timestamp already scanned (ms) */
  lastSmsScan: number;
  /** "Auto-add payments" card on Home dismissed */
  setupDismissed: boolean;
};

type State = {
  userId: string | null;
  hydrated: boolean;
  items: Record<string, InboxItem>;
  settings: CaptureSettings;
  /** formats this user taught on this phone (also sent to the server for everyone) */
  localTemplates: SmsTemplate[];

  hydrate: (userId: string) => Promise<void>;
  /** Add newly parsed payments. Returns the keys that became new "to sort" items. */
  ingest: (parsed: ParsedTxn[]) => string[];
  setStatus: (key: string, status: InboxStatus, savedAs?: SavedAs) => void;
  patch: (key: string, patch: Partial<ParsedTxn>) => void;
  setSettings: (patch: Partial<CaptureSettings>) => void;
  addTemplate: (tpl: SmsTemplate) => void;
  clearInbox: () => void;
};

const DEFAULT_SETTINGS: CaptureSettings = { smsEnabled: false, lastSmsScan: 0, setupDismissed: false };
const KEEP_DAYS = 90;
const MAX_ITEMS = 1500;
const storageKey = (userId: string) => `kanakku.capture.v1.${userId}`;

export const useCaptureStore = create<State>((set, get) => ({
  userId: null,
  hydrated: false,
  items: {},
  settings: DEFAULT_SETTINGS,
  localTemplates: [],

  hydrate: async (userId) => {
    if (get().userId === userId && get().hydrated) return;
    set({ userId, hydrated: false, items: {}, settings: DEFAULT_SETTINGS, localTemplates: [] });
    try {
      const raw = await AsyncStorage.getItem(storageKey(userId));
      if (raw && get().userId === userId) {
        const saved = JSON.parse(raw) as Partial<Pick<State, 'items' | 'settings' | 'localTemplates'>>;
        set({ items: saved.items ?? {}, settings: { ...DEFAULT_SETTINGS, ...saved.settings }, localTemplates: saved.localTemplates ?? [] });
      }
    } catch {
      // corrupt / missing → start fresh
    }
    if (get().userId === userId) set({ hydrated: true });
  },

  ingest: (parsed) => {
    const now = Date.now();
    const oldest = now - KEEP_DAYS * 86_400_000;
    const items = { ...get().items };
    const added: string[] = [];

    for (const t of mergeDuplicates(parsed)) {
      if (t.timestamp < oldest) continue;
      const same = items[t.key];
      if (same) {
        if (same.status === 'pending' && !same.counterparty && t.counterparty) items[t.key] = { ...same, counterparty: t.counterparty, vpa: same.vpa ?? t.vpa, confidence: 'high' };
        continue;
      }
      // SMS read now + notification caught earlier (or the other way round) = one payment.
      const twin = Object.values(items).find(
        (o) => o.source !== t.source && o.direction === t.direction && Math.abs(o.amount - t.amount) < 0.005 && Math.abs(o.timestamp - t.timestamp) <= 10 * 60_000,
      );
      if (twin) {
        if (twin.status !== 'pending') continue; // already sorted — never resurrect it
        const merged = mergeDuplicates([twin, t])[0];
        delete items[twin.key];
        items[merged.key] = { ...twin, ...merged, status: 'pending' };
        const i = added.indexOf(twin.key);
        if (i >= 0) added[i] = merged.key;
        continue;
      }
      items[t.key] = { ...t, status: 'pending', seenAt: now };
      added.push(t.key);
    }
    set({ items: prune(items, oldest) });
    return added;
  },

  setStatus: (key, status, savedAs) => {
    const item = get().items[key];
    if (!item) return;
    set({ items: { ...get().items, [key]: { ...item, status, savedAs: status === 'pending' ? undefined : (savedAs ?? item.savedAs), handledAt: status === 'pending' ? undefined : Date.now() } } });
  },

  patch: (key, patch) => {
    const item = get().items[key];
    if (!item) return;
    set({ items: { ...get().items, [key]: { ...item, ...patch } } });
  },

  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

  addTemplate: (tpl) => {
    const same = (a: SmsTemplate) =>
      a.senderKey === tpl.senderKey && a.direction === tpl.direction && a.amountBefore === tpl.amountBefore && a.payeeBefore === tpl.payeeBefore && a.payeeAfter === tpl.payeeAfter;
    if (get().localTemplates.some(same)) return;
    set({ localTemplates: [...get().localTemplates, tpl].slice(-100) });
  },

  clearInbox: () => set({ items: {}, settings: { ...get().settings, lastSmsScan: 0 } }),
}));

function prune(items: Record<string, InboxItem>, oldest: number): Record<string, InboxItem> {
  let list = Object.values(items).filter((i) => i.timestamp >= oldest);
  if (list.length > MAX_ITEMS) list = list.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ITEMS);
  return Object.fromEntries(list.map((i) => [i.key, i]));
}

// ---- persistence (debounced) ----
let timer: ReturnType<typeof setTimeout> | null = null;
useCaptureStore.subscribe((s, prev) => {
  if (!s.userId || !s.hydrated) return;
  if (s.items === prev.items && s.settings === prev.settings && s.localTemplates === prev.localTemplates) return;
  if (timer) clearTimeout(timer);
  const userId = s.userId;
  timer = setTimeout(() => {
    const { items, settings, localTemplates } = useCaptureStore.getState();
    if (useCaptureStore.getState().userId !== userId) return;
    AsyncStorage.setItem(storageKey(userId), JSON.stringify({ items, settings, localTemplates })).catch(() => undefined);
  }, 400);
});

// ---- selectors ----
export const pendingItems = (items: Record<string, InboxItem>) =>
  Object.values(items)
    .filter((i) => i.status === 'pending')
    .sort((a, b) => b.timestamp - a.timestamp);

export const usePendingCount = () => useCaptureStore((s) => Object.values(s.items).reduce((n, i) => n + (i.status === 'pending' ? 1 : 0), 0));
