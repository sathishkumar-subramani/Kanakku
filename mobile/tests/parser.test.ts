import { describe, expect, it } from 'vitest';

import {
  applyTemplate,
  guessCategory,
  learnTemplate,
  mergeDuplicates,
  parseNotification,
  parseSms,
  ruleKeyFor,
  ruleKeysFor,
  senderKeyOf,
  type Direction,
  type RawMessage,
} from '../src/capture/parser';

const TS = new Date(2026, 9, 31, 20, 15).getTime();
let n = 0;
const sms = (sender: string, body: string, timestamp = TS): RawMessage => ({ id: String(++n), source: 'sms', sender, body, timestamp });

type Expect = { direction: Direction; amount: number; who?: string | null; vpa?: string | null; ref?: string | null; account?: string | null };

/**
 * Formats modelled on the public SMS formats of Indian banks / payment banks / card issuers.
 * Names, VPAs and numbers are made up.
 */
const CASES: [string, string, string, Expect][] = [
  // ---- SBI
  ['SBI UPI debit', 'AD-SBIUPI-S', 'Dear UPI user A/C X1234 debited by 250.0 on date 31Oct26 trf to ANNACHI STORE Refno 430512345678. If not u? call 1800111109. -SBI', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678', account: '1234' }],
  ['SBI UPI credit', 'JD-SBIUPI-S', 'Dear SBI User, your A/c X1234-credited by Rs.500 on 31Oct26 transfer from ARUN KUMAR Ref No 430598765432 -SBI', { direction: 'credit', amount: 500, who: 'Arun Kumar', ref: '430598765432', account: '1234' }],
  ['SBI ATM', 'VM-SBIINB', 'Rs.2000 withdrawn at SBI ATM S1NW000123045 from A/cX1234 on 31Oct26 Txn# 1234. Avl Bal Rs 10345.67. If not withdrawn by you, forward this SMS to 9223008333 -SBI', { direction: 'debit', amount: 2000, account: '1234' }],
  ['SBI card spend', 'VK-SBICRD', 'Rs.1,250.00 spent on your SBI Credit Card ending 1234 at SWIGGY on 31/10/26. Trxn. not done by you? Report at https://sbicard.com/Dispute', { direction: 'debit', amount: 1250, who: 'Swiggy', account: '1234' }],

  // ---- HDFC
  ['HDFC UPI sent', 'VM-HDFCBK-S', 'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo ANNACHI STORE\nOn 31/10/26\nRef 430512345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678', account: '1234' }],
  ['HDFC UPI sent one-line', 'AD-HDFCBK', 'Sent Rs.68.00 From HDFC Bank A/C x1234 To RAMESH TEA STALL On 31/10/26 Ref 430511112222 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808', { direction: 'debit', amount: 68, who: 'Ramesh Tea Stall', ref: '430511112222' }],
  ['HDFC UPI received', 'VM-HDFCBK-S', 'Received Rs.500.00 in your HDFC Bank A/c xx1234 from arun@okicici on 31-10-26 by UPI Ref No 430598765432', { direction: 'credit', amount: 500, vpa: 'arun@okicici', ref: '430598765432', account: '1234' }],
  ['HDFC money received name', 'JM-HDFCBK', 'Money Received - INR 500.00 in your A/c XX1234 on 31-10-26 from PRIYA S (UPI Ref 430598765433). Avl bal: INR 12,345.67', { direction: 'credit', amount: 500, who: 'Priya S', ref: '430598765433' }],
  ['HDFC credit card', 'VM-HDFCBK', 'Rs.1,250.00 spent on your HDFC Bank Credit Card xx1234 at SWIGGY on 2026-10-31:20:15:12. Avl Lmt: Rs.50,000. Not you? Call 18002586161', { direction: 'debit', amount: 1250, who: 'Swiggy', account: '1234' }],
  ['HDFC debit card', 'VM-HDFCBK', 'Spent Rs.499 On HDFC Bank Card 1234 At AMAZON PAY INDIA On 2026-10-31:20:15:12. Not You? To Block+Reissue Call 18002586161', { direction: 'debit', amount: 499, who: 'Amazon Pay India' }],

  // ---- ICICI
  ['ICICI UPI debit', 'AX-ICICIT-S', 'ICICI Bank Acct XX123 debited for Rs 250.00 on 31-Oct-26; ANNACHI STORE credited. UPI:430512345678. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678', account: '123' }],
  ['ICICI UPI credit', 'AX-ICICIB', 'Dear Customer, Acct XX123 is credited with Rs 500.00 on 31-Oct-26 from ARUN KUMAR. UPI:430598765432-ICICI Bank.', { direction: 'credit', amount: 500, who: 'Arun Kumar', ref: '430598765432' }],
  ['ICICI card', 'VM-ICICIT', 'INR 1,250.00 spent using ICICI Bank Card XX1234 on 31-Oct-26 on SWIGGY. Avl Limit: INR 48,750.00. If not you, call 1800 2662/SMS BLOCK 1234 to 9215676766.', { direction: 'debit', amount: 1250, who: 'Swiggy' }],

  // ---- Axis
  ['Axis UPI debit', 'VK-AXISBK', 'INR 250.00 debited\nA/c no. XX1234\n31-10-26, 20:15:12\nUPI/P2M/430512345678/ANNACHI STORE\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678', account: '1234' }],
  ['Axis UPI credit', 'VK-AXISBK-S', 'INR 500.00 credited\nA/c no. XX1234\n31-10-26, 20:15:12 IST\nUPI/P2A/430598765432/ARUN KUMAR\n- Axis Bank', { direction: 'credit', amount: 500, who: 'Arun Kumar', ref: '430598765432' }],

  // ---- Kotak
  ['Kotak sent', 'AD-KOTAKB', 'Sent Rs.250.00 from Kotak Bank AC X1234 to annachistore@ybl on 31-10-26.UPI Ref 430512345678. Not you, https://kotak.com/KBANKT/Fraud', { direction: 'debit', amount: 250, vpa: 'annachistore@ybl', ref: '430512345678', account: '1234' }],
  ['Kotak received', 'AD-KOTAKB-S', 'Received Rs.500.00 in your Kotak Bank AC X1234 from arun@okicici on 31-10-26.UPI Ref:430598765432.', { direction: 'credit', amount: 500, vpa: 'arun@okicici', ref: '430598765432' }],

  // ---- PNB / BOB / Canara / Union
  ['PNB debit', 'BP-PNBSMS', 'Your A/c XX1234 has been debited with INR 250.00 on 31-10-2026 13:20:10 and A/c of ANNACHI STORE credited.UPI Ref no 430512345678. Available Bal INR 1,234.56 -PNB', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678' }],
  ['BOB debit', 'VM-BOBTXN', 'Rs.250.00 transferred from A/c ...1234 to:annachistore@ybl. Total Bal:Rs.1234.56CR. Avlbl Amt:Rs.1234.56(31-10-2026 20:15:12) - Bank of Baroda', { direction: 'debit', amount: 250, vpa: 'annachistore@ybl', account: '1234' }],
  ['BOB credit', 'VM-BOBTXN-S', 'Rs.500.00 Credited to A/c ...1234 thru UPI/430598765432 by arun@okicici. Total Bal:Rs.1734.56CR. Avlbl Amt:Rs.1734.56(31-10-2026) - Bank of Baroda', { direction: 'credit', amount: 500, vpa: 'arun@okicici', ref: '430598765432' }],
  ['Canara debit', 'AD-CANBNK', 'An amount of INR 250.00 has been DEBITED to your account XXX1234 on 31/10/2026 towards UPI/430512345678/ANNACHI STORE. Total Avail.bal INR 1,234.56. - Canara Bank', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678' }],
  ['Union debit no payee', 'VM-UBOIND', 'A/c *1234 Debited for Rs:250.00 on 31-10-2026 20:15:12 by Mob Bk ref no 430512345678 Avl Bal Rs:1234.56.If not you, Call 1800222243 -Union Bank of India', { direction: 'debit', amount: 250, who: null, ref: '430512345678' }],
  ['Union credit', 'VM-UBOIND', 'A/c *1234 Credited for Rs:500.00 on 31-10-2026 20:15:12 by Mob Bk ref no 430598765432 Avl Bal Rs:1734.56 -Union Bank of India', { direction: 'credit', amount: 500, who: null, ref: '430598765432' }],

  // ---- Tamil Nadu banks
  ['IOB debit', 'VM-IOBCHN', 'Your a/c no. XXXXX1234 is debited for Rs.250.00 on 31-10-2026 and credited to a/c no. XXXXXX5678 (UPI Ref no 430512345678) -IOB', { direction: 'debit', amount: 250, ref: '430512345678', account: '1234' }],
  ['Indian Bank debit', 'VM-INDBNK', 'A/c *1234 debited Rs. 250.00 on 31-10-26 to ANNACHI STORE. UPI:430512345678. Not you? SMS BLOCK to 9444394443 -Indian Bank', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678' }],
  ['Indian Bank credit', 'VM-INDBNK-S', 'A/c *1234 credited Rs. 500.00 on 31-10-26 from ARUN KUMAR. UPI:430598765432. -Indian Bank', { direction: 'credit', amount: 500, who: 'Arun Kumar', ref: '430598765432' }],
  ['TMB debit', 'AD-TMBANK', 'Your A/c No XXXX1234 is debited for INR 250.00 on 31-10-2026 towards UPI/DR/430512345678/ANNACHI S/YESB/annachi@ybl. Avl Bal INR 1234.56 - TMB', { direction: 'debit', amount: 250, who: 'Annachi S', ref: '430512345678' }],
  ['KVB credit', 'VM-KVBANK', 'Your A/c XX1234 is credited with Rs.500.00 on 31-10-2026 via UPI from ARUN KUMAR (Ref 430598765432). Bal Rs.1734.56 - KVB', { direction: 'credit', amount: 500, who: 'Arun Kumar', ref: '430598765432' }],
  ['City Union debit', 'JD-CUBANK', 'Rs.250.00 debited from your A/c XX1234 on 31-10-26 to VPA annachi@okaxis (UPI Ref 430512345678). Avl Bal Rs.1234.56 -CUB', { direction: 'debit', amount: 250, vpa: 'annachi@okaxis', ref: '430512345678' }],

  // ---- private / small-finance / payments banks
  ['IDFC debit no payee', 'VM-IDFCFB', 'Your A/C XXXXXXX1234 is debited by INR 250.00 on 31/10/26 20:15. New Bal :INR 1234.56. UPI Ref No 430512345678 - IDFC FIRST Bank', { direction: 'debit', amount: 250, who: null, ref: '430512345678' }],
  ['Federal debit', 'AD-FEDBNK', 'Rs 250.00 debited from your A/c using UPI on 31-10-2026 20:15:12 to VPA annachistore@ybl - (UPI Ref No 430512345678)-Federal Bank', { direction: 'debit', amount: 250, vpa: 'annachistore@ybl', ref: '430512345678' }],
  ['Yes Bank debit', 'VM-YESBNK', 'INR 250.00 debited from A/c XX1234 on 31-10-26 for UPI-430512345678-ANNACHI STORE. Avl Bal INR 1234.56. Not you? Call 18001200', { direction: 'debit', amount: 250, ref: '430512345678' }],
  ['IndusInd debit', 'VM-INDUSB', 'Your A/c 1234XXXX5678 is debited for INR 250.00 towards UPI to annachistore@ybl on 31/10/2026. Ref no 430512345678. Avl Bal INR 1,234.56', { direction: 'debit', amount: 250, vpa: 'annachistore@ybl', ref: '430512345678' }],
  ['AU debit', 'VM-AUBANK', 'Dear Customer, INR 250.00 debited from your AU Bank A/c XX1234 on 31-10-26 to ANNACHI STORE via UPI. Ref 430512345678', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678' }],
  ['Paytm Payments Bank', 'VM-PAYTMB', 'Paid Rs.250 to Annachi Store from Paytm Payments Bank a/c XX1234. UPI Ref: 430512345678. Queries? Call 01204456456', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678' }],
  ['Airtel Payments Bank', 'VM-AIRBNK', 'Rs.250.00 debited from your Airtel Payments Bank a/c 1234 for payment to annachistore@ybl. UPI Ref No. 430512345678', { direction: 'debit', amount: 250, vpa: 'annachistore@ybl', ref: '430512345678' }],
  ['Jupiter / Federal', 'AD-JUPITR', 'You paid ₹250 to Annachi Store using UPI from your Federal Bank account XX1234. UPI Ref No: 430512345678', { direction: 'debit', amount: 250, who: 'Annachi Store', ref: '430512345678' }],

  // ---- odd but real shapes
  ['NEFT credit', 'VM-HDFCBK', 'Update! INR 25,000.00 deposited in HDFC Bank A/c XX1234 on 31-OCT-26 for NEFT Cr-HDFC0000123-ACME TECH PVT LTD-SATHISH KUMAR-N123456789.Avl bal INR 37,345.67', { direction: 'credit', amount: 25000 }],
  ['Refund', 'VM-ICICIT', 'Dear Customer, Rs 250.00 debited from your Acct XX123 on 30-Oct-26 for UPI 430512345678 has been reversed to your account on 31-Oct-26.', { direction: 'credit', amount: 250 }],
  ['Amount with lakh grouping', 'VM-SBIINB', 'Your A/c XX1234 debited by Rs. 1,25,000.00 on 31-10-26 trf to SRI BALAJI ESTATES Ref No 430512349999. -SBI', { direction: 'debit', amount: 125000, who: 'Sri Balaji Estates' }],
  ['HDFC new UPI format', 'VM-HDFCBK-S', 'Dear Customer, Rs.250.00 has been debited from account **1234 to VPA annachi@ybl ANNACHI STORE on 31-10-26. Your UPI transaction reference number is 430512345678. If you did not authorize this transaction, please report it immediately by calling 18002586161', { direction: 'debit', amount: 250, vpa: 'annachi@ybl', ref: '430512345678', account: '1234' }],
  ['Indian Bank VPA linked', 'VM-INDBNK', 'Your VPA sathish@okhdfcbank linked to Indian Bank a/c no. XX1234 is debited for Rs.250.00 and credited to annachi@ybl (UPI Ref no 430512345678).', { direction: 'debit', amount: 250, vpa: 'annachi@ybl', ref: '430512345678' }],
  ['HDFC Txn card/UPI', 'VM-HDFCBK', 'Txn Rs.250.00\nOn HDFC Bank Card 1234\nAt annachi@ybl\nby UPI 430512345678\nOn 31-10\nNot You?\nCall 18002586161/SMS BLOCK DC 1234 to 7308080808', { direction: 'debit', amount: 250, vpa: 'annachi@ybl', ref: '430512345678' }],
  ['Refund for failed txn', 'VM-SBIUPI', 'Dear SBI UPI User, Refund of Rs.250 for failed transaction Ref No 430512345678 has been credited to your A/c XX1234. -SBI', { direction: 'credit', amount: 250, ref: '430512345678' }],
  ['Rent to owner name', 'VM-HDFCBK', 'Sent Rs.9000.00 From HDFC Bank A/C *1234 To K RAJENDRAN On 01/11/26 Ref 430600001111 Not You? Call 18002586161', { direction: 'debit', amount: 9000, who: 'K Rajendran' }],
];

const IGNORED: [string, string, string][] = [
  ['OTP', 'VM-HDFCBK', '123456 is your OTP for txn of Rs 250.00 at SWIGGY on HDFC Bank card xx1234. Valid for 5 mins. Do not share OTP.'],
  ['will be debited', 'VM-ICICIT', 'Dear Customer, your EMI of Rs 2,499.00 for loan XX5678 will be debited from Acct XX123 on 05-Nov-26. Please maintain sufficient balance.'],
  ['collect request', 'VM-SBIUPI', 'Dear SBI UPI User, ANNACHI STORE has requested money of Rs.250 from your A/c. Ignore if not you. -SBI'],
  ['failed', 'VM-HDFCBK', 'UPI txn of Rs.250.00 from A/c *1234 to annachistore@ybl failed. Ref 430512345678. Amount if debited will be reversed.'],
  ['promotional', 'VM-HDFCBK-P', 'Get Rs.500 cashback on your HDFC Bank Credit Card! Spend Rs.5000 at Amazon. T&C apply.'],
  ['balance alert', 'VM-SBIINB', 'Your A/c XX1234 has a balance of Rs. 12,345.67 as on 31-10-26. -SBI'],
  ['bill due', 'VM-ICICIT', 'ICICI Bank Credit Card XX1234: Total amount due Rs 12,345.00, minimum amount due Rs 617.00. Payment due on 05-Nov-26.'],
  ['personal number', '+919876543210', 'Sent Rs 500 to you for dinner, check your a/c'],
  ['no money', 'VM-HDFCBK', 'Your HDFC Bank A/c XX1234 KYC is due for update. Visit branch.'],
];

describe('bank SMS — generic parser', () => {
  for (const [label, sender, body, exp] of CASES) {
    it(label, () => {
      const t = parseSms(sms(sender, body));
      expect(t, `parsed nothing for: ${body}`).not.toBeNull();
      expect(t!.direction).toBe(exp.direction);
      expect(t!.amount).toBe(exp.amount);
      if (exp.who !== undefined) expect(t!.counterparty).toBe(exp.who);
      if (exp.vpa !== undefined) expect(t!.vpa).toBe(exp.vpa);
      if (exp.ref !== undefined) expect(t!.ref).toBe(exp.ref);
      if (exp.account !== undefined) expect(t!.account).toBe(exp.account);
      expect(t!.date).toBe('2026-10-31');
    });
  }

  for (const [label, sender, body] of IGNORED) {
    it(`ignores: ${label}`, () => {
      expect(parseSms(sms(sender, body))).toBeNull();
    });
  }

  it('keys by UPI ref so the same payment is never added twice', () => {
    const a = parseSms(sms('VM-HDFCBK-S', CASES[4][2]))!;
    const b = parseSms(sms('VM-HDFCBK', CASES[4][2], TS + 5000))!;
    expect(a.key).toBe('ref:430512345678');
    expect(b.key).toBe(a.key);
  });

  it('marks results without a payee as low confidence', () => {
    expect(parseSms(sms('VM-UBOIND', CASES.find((c) => c[0] === 'Union debit no payee')![2]))!.confidence).toBe('low');
    expect(parseSms(sms('VM-HDFCBK-S', CASES[4][2]))!.confidence).toBe('high');
  });

  it('normalises sender headers', () => {
    expect(senderKeyOf('VM-HDFCBK-S')).toBe('HDFCBK');
    expect(senderKeyOf('AD-SBIUPI')).toBe('SBIUPI');
    expect(senderKeyOf('HDFCBK')).toBe('HDFCBK');
  });

  it('guesses categories from the payee', () => {
    expect(parseSms(sms('VM-HDFCBK', CASES[8][2]))!.categoryGuess).toBe('food');
    expect(guessCategory('Annachi Store')).toBe('groceries');
    expect(guessCategory('TNEB')).toBe('utilities');
    expect(guessCategory('Rapido')).toBe('travel');
    expect(guessCategory('Someone')).toBe('other');
  });
});

describe('payment-app notifications', () => {
  const notif = (pkg: string, title: string, body: string, timestamp = TS): RawMessage => ({ id: String(++n), source: 'notification', sender: pkg, title, body, timestamp });
  const GPAY = 'com.google.android.apps.nbu.paisa.user';

  it('GPay: name in title, "Paid you ₹500"', () => {
    const t = parseNotification(notif(GPAY, 'Arun Kumar', 'Paid you ₹500'))!;
    expect(t).toMatchObject({ direction: 'credit', amount: 500, counterparty: 'Arun Kumar', method: 'upi' });
  });
  it('GPay: "Arun Kumar paid you ₹500.00"', () => {
    expect(parseNotification(notif(GPAY, 'Payment received', 'Arun Kumar paid you ₹500.00'))).toMatchObject({ direction: 'credit', amount: 500, counterparty: 'Arun Kumar' });
  });
  it('GPay: "You paid ₹250 to Annachi Store"', () => {
    expect(parseNotification(notif(GPAY, 'Payment successful', 'You paid ₹250 to Annachi Store'))).toMatchObject({ direction: 'debit', amount: 250, counterparty: 'Annachi Store' });
  });
  it('PhonePe: "Received ₹500 from Arun Kumar"', () => {
    expect(parseNotification(notif('com.phonepe.app', '₹500 received', 'Received ₹500 from Arun Kumar in your SBI a/c'))).toMatchObject({ direction: 'credit', amount: 500, counterparty: 'Arun Kumar' });
  });
  it('PhonePe: "Paid ₹1,250 to SWIGGY successfully"', () => {
    expect(parseNotification(notif('com.phonepe.app', 'Payment Successful', 'Paid ₹1,250 to SWIGGY successfully'))).toMatchObject({ direction: 'debit', amount: 1250, counterparty: 'Swiggy' });
  });
  it('Paytm: "Payment of Rs 250 to annachi@paytm is successful"', () => {
    expect(parseNotification(notif('net.one97.paytm', 'Paytm', 'Payment of Rs 250 to annachi@paytm is successful'))).toMatchObject({ direction: 'debit', amount: 250, vpa: 'annachi@paytm' });
  });
  it('ignores requests, reminders and cashback', () => {
    expect(parseNotification(notif(GPAY, 'Arun Kumar', 'Requested ₹500 from you'))).toBeNull();
    expect(parseNotification(notif(GPAY, 'You won ₹21 cashback', 'Scratch your card now'))).toBeNull();
    expect(parseNotification(notif(GPAY, 'Reminder', 'Your electricity bill of ₹1,200 is due'))).toBeNull();
  });

  it('merges SMS + notification for the same payment, keeping the ref and the better name', () => {
    const s = parseSms(sms('VM-UBOIND', 'A/c *1234 Debited for Rs:250.00 on 31-10-2026 by Mob Bk ref no 430512345678 Avl Bal Rs:1234.56 -Union Bank of India'))!;
    const g = parseNotification(notif(GPAY, 'Payment successful', 'You paid ₹250 to Annachi Store', TS + 30_000))!;
    const merged = mergeDuplicates([s, g]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ source: 'sms', ref: '430512345678', counterparty: 'Annachi Store', confidence: 'high' });
  });
  it('prefers the person name from the notification over a bare VPA from the SMS', () => {
    const s = parseSms(sms('AD-KOTAKB', 'Sent Rs.250.00 from Kotak Bank AC X1234 to arun@okicici on 31-10-26.UPI Ref 430512345678.'))!;
    const g = parseNotification(notif(GPAY, 'Payment successful', 'You paid ₹250 to Arun Kumar', TS + 30_000))!;
    const [m] = mergeDuplicates([s, g]);
    expect(m).toMatchObject({ counterparty: 'Arun Kumar', vpa: 'arun@okicici', ref: '430512345678' });
    expect(ruleKeysFor(m)).toEqual(['arun@okicici', 'name:arun kumar']);
  });
  it('does not merge different amounts', () => {
    const s = parseSms(sms('VM-HDFCBK-S', CASES[4][2]))!;
    const g = parseNotification(notif(GPAY, 'x', 'You paid ₹251 to Annachi Store', TS + 30_000))!;
    expect(mergeDuplicates([s, g])).toHaveLength(2);
  });
});

describe('teach once (templates)', () => {
  const weird = 'TXN ALERT: 250.00 gone out of yr acct 1234 -> payee: ANNACHI STORE | ref 430512345678 | GoodBank';
  const weird2 = 'TXN ALERT: 1,499.50 gone out of yr acct 1234 -> payee: RAPIDO BIKE | ref 430512340000 | GoodBank';

  it('learns anchors without amounts, names or account numbers', () => {
    const tpl = learnTemplate(weird, 'GOODBK', 'debit', 250, 'ANNACHI STORE', ['Sathish', 'Kumar'])!;
    expect(tpl).toBeTruthy();
    expect(tpl.amountBefore).toBe('ALERT:');
    expect(tpl.payeeBefore).toBe('payee:');
    expect(tpl.payeeAfter).toBe('|');
    const blob = JSON.stringify(tpl);
    expect(blob).not.toMatch(/250|1234|ANNACHI|430512/);
  });

  it('applies a learned template to the next SMS from the same sender', () => {
    const tpl = learnTemplate(weird, 'GOODBK', 'debit', 250, 'ANNACHI STORE')!;
    expect(applyTemplate(weird2, tpl)).toEqual({ amount: 1499.5, payee: 'RAPIDO BIKE' });
    const t = parseSms(sms('VM-GOODBK', weird2 + ' a/c'), [tpl])!;
    expect(t).toMatchObject({ direction: 'debit', amount: 1499.5, counterparty: 'Rapido Bike', viaTemplate: true });
  });

  it('scrubs the user name from anchors', () => {
    const body = 'Dear SATHISH, Rs.250 debited from a/c XX1234 to ANNACHI STORE ref 430512345678';
    const tpl = learnTemplate(body, 'X', 'debit', 250, 'ANNACHI STORE', ['Sathish'])!;
    expect(JSON.stringify(tpl).toLowerCase()).not.toContain('sathish');
  });
});

describe('rule keys', () => {
  it('prefers VPA, falls back to normalised name', () => {
    expect(ruleKeyFor({ vpa: 'Annachi@YBL', counterparty: 'x' })).toBe('annachi@ybl');
    expect(ruleKeyFor({ vpa: null, counterparty: 'ANNACHI  Store.' })).toBe('name:annachi store.');
    expect(ruleKeyFor({ vpa: null, counterparty: null })).toBeNull();
  });
});
