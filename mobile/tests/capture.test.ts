import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));

import type { CaptureRule, Group } from '../src/api/types';
import { parseNotification, parseSms, type RawMessage } from '../src/capture/parser';
import { useCaptureStore } from '../src/capture/store';
import { findRoommate, suggestFor } from '../src/capture/suggest';

const ME = 'u-me';
const ARUN = 'u-arun';
const PRIYA = 'u-priya';
const TS = new Date(2026, 9, 31, 20, 15).getTime();
let n = 0;
const sms = (body: string, timestamp = TS, sender = 'VM-HDFCBK-S'): RawMessage => ({ id: String(++n), source: 'sms', sender, body, timestamp });
const gpay = (title: string, body: string, timestamp = TS): RawMessage => ({ id: String(++n), source: 'notification', sender: 'com.google.android.apps.nbu.paisa.user', title, body, timestamp });

const member = (userId: string, name: string, email: string) => ({ userId, name, email, avatarColor: '#000', role: 'member' as const, joinedAt: '' });
const ROOM: Group = {
  id: 'g-room',
  name: 'Room 302',
  emoji: '🏠',
  color: '#E2590B',
  currency: 'INR',
  inviteCode: 'X',
  simplifyDebts: true,
  createdBy: ME,
  createdAt: '',
  members: [member(ME, 'Sathish Kumar', 'sathish@example.com'), member(ARUN, 'Arun', 'arun.k@gmail.com'), member(PRIYA, 'Priya S', 'priya@example.com')],
  myBalance: 300,
  totalSpent: 0,
  monthSpent: 5000,
  lastActivityAt: null,
};
const ctx = (rules: CaptureRule[] = []) => ({ rules, groups: [ROOM], meId: ME });
const rule = (r: Partial<CaptureRule>): CaptureRule => ({ id: 'r', key: '', label: '', kind: 'personal', groupId: null, category: null, description: null, splitWith: [], counterpartyUserId: null, autoSave: false, updatedAt: '', ...r });

describe('suggestions', () => {
  it('spots a roommate paying me back (bank SMS name) → settlement to me', () => {
    const t = parseSms(sms('Money Received - INR 300.00 in your A/c XX1234 on 31-10-26 from ARUN KUMAR (UPI Ref 430598765433). Avl bal: INR 12,345.67'))!;
    expect(suggestFor(t, ctx())).toMatchObject({ kind: 'settlement', groupId: 'g-room', fromUserId: ARUN, toUserId: ME });
  });

  it('spots me paying a roommate by VPA = email id → settlement from me', () => {
    const t = parseSms(sms('Sent Rs.250.00 from Kotak Bank AC X1234 to arun.k@okicici on 31-10-26.UPI Ref 430512345678.', TS, 'AD-KOTAKB'))!;
    expect(findRoommate(t, [ROOM], ME)?.member.userId).toBe(ARUN);
    expect(suggestFor(t, ctx())).toMatchObject({ kind: 'settlement', fromUserId: ME, toUserId: ARUN });
  });

  it('shared-looking spends go to the group, the rest to personal', () => {
    const shop = parseSms(sms('Sent Rs.640.00 From HDFC Bank A/C *1234 To ANNACHI STORE On 31/10/26 Ref 430512340001 Not You? Call 18002586161'))!;
    expect(suggestFor(shop, ctx())).toMatchObject({ kind: 'group', groupId: 'g-room', category: 'groceries', splitWith: [ME, ARUN, PRIYA] });
    const food = parseSms(sms('Rs.250.00 spent on your HDFC Bank Credit Card xx1234 at SWIGGY on 2026-10-31:20:15:12.'))!;
    expect(suggestFor(food, ctx())).toMatchObject({ kind: 'personal', category: 'food', description: 'Swiggy' });
  });

  it('money from strangers and ATM cash are skipped by default', () => {
    const salary = parseSms(sms('Update! INR 25,000.00 deposited in HDFC Bank A/c XX1234 on 31-OCT-26 for NEFT Cr-HDFC0000123-ACME TECH PVT LTD.'))!;
    expect(suggestFor(salary, ctx()).kind).toBe('ignore');
    const atm = parseSms(sms('Rs.2000 withdrawn at SBI ATM S1NW000123045 from A/cX1234 on 31Oct26 Txn# 1234. Avl Bal Rs 10345.67 -SBI', TS, 'VM-SBIINB'))!;
    expect(suggestFor(atm, ctx())).toMatchObject({ kind: 'ignore', reason: 'Cash withdrawal' });
  });

  it('a remembered rule wins — by VPA or by name', () => {
    const t = parseSms(sms('Sent Rs.250.00 from Kotak Bank AC X1234 to annachi@ybl on 31-10-26.UPI Ref 430512345678.', TS, 'AD-KOTAKB'))!;
    const r = rule({ key: 'annachi@ybl', label: 'Annachi Store', kind: 'group', groupId: 'g-room', category: 'groceries', description: 'Veggies', splitWith: [ME, ARUN], autoSave: true });
    expect(suggestFor(t, ctx([r]))).toMatchObject({ kind: 'group', splitWith: [ME, ARUN], description: 'Veggies', rule: r });
    const n2 = parseNotification(gpay('Payment successful', 'You paid ₹99 to Annachi Store'))!;
    expect(suggestFor(n2, ctx([r])).rule).toBe(r); // matched through the rule label
    const skip = rule({ key: 'name:annachi store', kind: 'ignore' });
    expect(suggestFor(n2, ctx([skip])).kind).toBe('ignore');
  });
});

describe('inbox store', () => {
  beforeEach(async () => {
    useCaptureStore.setState({ userId: null, hydrated: false, items: {} });
    await useCaptureStore.getState().hydrate('u-me');
  });

  it('adds payments once and merges an SMS that arrives after the GPay notification', () => {
    const notif = parseNotification(gpay('Payment successful', 'You paid ₹250 to Annachi Store'))!;
    expect(useCaptureStore.getState().ingest([notif])).toEqual([notif.key]);
    expect(useCaptureStore.getState().ingest([notif])).toEqual([]);

    const s = parseSms(sms('A/c *1234 Debited for Rs:250.00 on 31-10-2026 by Mob Bk ref no 430512345678 Avl Bal Rs:1234.56 -Union Bank of India', TS + 60_000, 'VM-UBOIND'))!;
    useCaptureStore.getState().ingest([s]);
    const items = Object.values(useCaptureStore.getState().items);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ key: 'ref:430512345678', counterparty: 'Annachi Store', status: 'pending', source: 'sms' });
  });

  it('never brings back a payment that was already sorted', () => {
    const notif = parseNotification(gpay('Payment successful', 'You paid ₹250 to Annachi Store'))!;
    useCaptureStore.getState().ingest([notif]);
    useCaptureStore.getState().setStatus(notif.key, 'ignored');
    const s = parseSms(sms('A/c *1234 Debited for Rs:250.00 on 31-10-2026 by Mob Bk ref no 430512345678 -Union Bank of India', TS + 60_000, 'VM-UBOIND'))!;
    expect(useCaptureStore.getState().ingest([s])).toEqual([]);
    expect(Object.values(useCaptureStore.getState().items).map((i) => i.status)).toEqual(['ignored']);
  });
});
