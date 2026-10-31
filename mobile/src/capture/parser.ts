/**
 * Bank-agnostic parser for payment SMS and payment-app notifications.
 *
 * It does not know any bank by name. Indian bank SMS all carry the same few markers:
 * an amount (Rs./INR/₹), a debit or credit verb, an account/card/UPI marker, often a counterparty
 * (VPA or name) and a reference number. We look for those markers, not a bank's layout.
 * When a format still can't be read, a user-taught template (see learnTemplate) fills the gap.
 *
 * Pure TypeScript, no React Native imports, so it is unit-tested in Node (tests/parser.test.ts).
 */

export type Direction = 'debit' | 'credit';
export type CaptureSource = 'sms' | 'notification';
export type PayMethod = 'upi' | 'card' | 'netbanking' | 'atm' | 'other';
export type GuessCategory =
  | 'food'
  | 'groceries'
  | 'rent'
  | 'utilities'
  | 'travel'
  | 'entertainment'
  | 'shopping'
  | 'health'
  | 'household'
  | 'other';

export interface RawMessage {
  /** Stable id from the source (SMS _id, or notification key + time). */
  id: string;
  source: CaptureSource;
  /** SMS sender header (e.g. "VM-HDFCBK-S") or the notifying app's package name. */
  sender: string;
  /** Notification title (notifications only). */
  title?: string;
  body: string;
  /** Epoch ms. */
  timestamp: number;
}

export interface ParsedTxn {
  /** Dedupe key: UPI ref when present, otherwise a hash of sender/amount/minute. */
  key: string;
  source: CaptureSource;
  sender: string;
  /** Sender without DLT prefix/suffix ("VM-HDFCBK-S" → "HDFCBK"), or the app package. */
  senderKey: string;
  direction: Direction;
  amount: number;
  /** Display name of the other side (payee for debits, payer for credits). */
  counterparty: string | null;
  vpa: string | null;
  ref: string | null;
  /** Last digits of the account/card. */
  account: string | null;
  method: PayMethod;
  timestamp: number;
  /** Local calendar day "YYYY-MM-DD". */
  date: string;
  /** 'low' when we could not find who the money went to / came from. */
  confidence: 'high' | 'low';
  categoryGuess: GuessCategory;
  /** Original text — kept on the phone only, never uploaded. */
  body: string;
  title?: string;
  viaTemplate?: boolean;
}

/** A user-taught "where to look" hint for one sender, shared between users. Contains no amounts or names. */
export interface SmsTemplate {
  senderKey: string;
  direction: Direction;
  /** Text right before the amount, e.g. "debited by" or "Rs.". Empty = first number in the text. */
  amountBefore: string;
  /** Text right before the payee, e.g. "trf to". */
  payeeBefore?: string | null;
  /** Text right after the payee, e.g. "Refno". Empty = end of line. */
  payeeAfter?: string | null;
}

// ---------------------------------------------------------------------------------------------
// helpers

const NUM = String.raw`([0-9][0-9,]*(?:\.[0-9]{1,2})?)`;
const MONEY_RE = new RegExp(String.raw`(?:\b(?:rs|inr)\.?|₹)\s*[:.]?\s*` + NUM, 'gi');
const VERB_AMOUNT_RE = new RegExp(String.raw`\b(?:debited|credited|deducted)\s+(?:by|for|with|of)?\s*(?:(?:rs|inr)\.?|₹)?\s*:?\s*` + NUM, 'gi');
const VPA = String.raw`([a-z0-9][a-z0-9._\-]*@[a-z][a-z0-9]+)(?!\.[a-z])`;

const toNumber = (s: string) => Number(s.replace(/,/g, ''));

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day for an epoch-ms timestamp. */
export function dayOf(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "VM-HDFCBK-S" → "HDFCBK", "AD-SBIUPI" → "SBIUPI", "HDFCBK" → "HDFCBK". */
export function senderKeyOf(sender: string): string {
  const s = sender.trim().toUpperCase();
  const m = /^[A-Z]{2}-([A-Z0-9]{3,9})(?:-[A-Z])?$/.exec(s);
  if (m) return m[1];
  return s.replace(/[^A-Z0-9.]/g, '');
}

function looksLikePhoneNumber(sender: string): boolean {
  return /^\+?\d[\d\s\-]{6,}$/.test(sender.trim());
}

function isPromotionalSender(sender: string): boolean {
  return /^[A-Z]{2}-[A-Z0-9]{3,9}-P$/i.test(sender.trim());
}

/** "ANNACHI STORE" → "Annachi Store"; mixed-case text is left alone. */
export function prettyName(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return s;
  if (s.includes('@')) return s.toLowerCase();
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

function cleanName(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\s:\-.,]+|[\s:\-.,;)(]+$/g, '');
  // drop dangling connector words the lookahead let through
  s = s.replace(/\s+(?:on|ref|via|using|thru|through|from|to|by|and|for|the|a\/c|ac)$/i, '').trim();
  if (s.length < 2) return null;
  if (/^\d+$/.test(s)) return null;
  if (/^(?:your|you|ur|us|the|bank|upi|imps|neft|rtgs|mob|mobile|net ?banking)$/i.test(s)) return null;
  return s;
}

function firstIndex(re: RegExp, text: string): number {
  const m = re.exec(text);
  re.lastIndex = 0;
  return m ? m.index : -1;
}

// ---------------------------------------------------------------------------------------------
// direction

const OTP_RE = /\botp\b|one[\s-]?time[\s-]?password|verification code|\bpasscode\b/i;
const EXCLUDE_RE =
  /\bwill be (?:debited|credited|deducted|charged|reversed|refunded)|\bis due\b|\bdue (?:on|date|by)\b|minimum (?:amount )?due|\bpayable\b|\brequest(?:ed|ing)?\b|\bcollect request\b|\bfailed\b|\bdeclined\b|\bunsuccessful\b|\bnot (?:been )?processed\b|\bon hold\b|\bblocked amount\b/i;
const REFUND_RE = /\b(?:reversed|reversal|refunded|refund of|refund for|refund)\b/i;
/** A refund that actually happened — allowed even when the SMS also says "failed" ("Refund for failed txn … credited"). */
const COMPLETED_REFUND_RE =
  /\b(?:has been|have been|was|is)\s+(?:reversed|refunded|credited)\b|\b(?:reversed|refunded)\s+(?:to|in|into)\s+(?:your|ur)\b|\brefund\b.{0,60}\bcredited\b/i;
const DEBIT_RE = /\b(?:debited|sent|paid|spent|withdrawn|withdrawal|transferred from|deducted|purchase(?:d)?\b)/i;
const CREDIT_RE = /\b(?:credited|received|deposited|transferred to (?:your|ur))\b/i;
const WEAK_DEBIT_RE = /\b(?:dr|debit|payment of|txn of|transaction of|transferred|txn(?=\s*(?:rs\b|inr\b|₹)))\b/i;
const WEAK_CREDIT_RE = /\b(?:cr|credit)\b/i;
const INSTRUMENT_RE = /\b(?:a\/?c|acct|account|ac|card|upi|vpa|wallet|bank|atm)\b|\ba\/c(?=[x*\d])|[x*]{2,}\d{3,}/i;

function detectDirection(text: string): { direction: Direction; verbIndex: number } | null {
  if (REFUND_RE.test(text)) {
    const i = firstIndex(REFUND_RE, text);
    return { direction: 'credit', verbIndex: i };
  }
  const d = firstIndex(DEBIT_RE, text);
  const c = firstIndex(CREDIT_RE, text);
  if (d >= 0 || c >= 0) {
    // Whichever verb comes first describes *your* account ("A/c debited …; X credited").
    if (d >= 0 && (c < 0 || d < c)) return { direction: 'debit', verbIndex: d };
    return { direction: 'credit', verbIndex: c };
  }
  const wd = firstIndex(WEAK_DEBIT_RE, text);
  const wc = firstIndex(WEAK_CREDIT_RE, text);
  if (wd >= 0 && (wc < 0 || wd < wc)) return { direction: 'debit', verbIndex: wd };
  if (wc >= 0) return { direction: 'credit', verbIndex: wc };
  return null;
}

// ---------------------------------------------------------------------------------------------
// amount

const NOT_TXN_AMOUNT_BEFORE = /\b(?:bal|balance|avl|avbl|avlbl|avail|available|limit|lmt|outstanding|due|total)\b[\s:.\-a-z]{0,12}$/i;

function findAmount(text: string, verbIndex: number): number | null {
  const candidates: { value: number; index: number }[] = [];
  for (const re of [MONEY_RE, VERB_AMOUNT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const numIndex = m.index + m[0].length - m[1].length;
      const pre = text.slice(Math.max(0, m.index - 25), m.index);
      const value = toNumber(m[1]);
      if (!(value > 0) || value >= 1e8) continue;
      if (NOT_TXN_AMOUNT_BEFORE.test(pre)) continue;
      candidates.push({ value, index: numIndex });
    }
    re.lastIndex = 0;
  }
  if (candidates.length === 0) return null;
  if (verbIndex < 0) return candidates.sort((a, b) => a.index - b.index)[0].value;
  candidates.sort((a, b) => Math.abs(a.index - verbIndex) - Math.abs(b.index - verbIndex) || a.index - b.index);
  return candidates[0].value;
}

// ---------------------------------------------------------------------------------------------
// counterparty

const NAME = String.raw`([A-Za-z][A-Za-z0-9 .&'\-]{1,40}?)`;
const NAME_END = String.raw`(?=\s+(?:on|ref|refno|upi|via|using|avl|avbl|bal|not|if|thru|from|at|for|with|in|is|has|and|info|dated|date)\b|\s*[.,;(\-](?:\s|$)|\s*\(|\s*\n|\s*$|\.(?=\S))`;

const SLASH_RE = /\bupi\/(?:(?:dr|cr|p2[am])\/)?\d{6,}\/([^\/\n]+?)(?=\/|\n|$|\.\s|\s{2,}|\.$)/i;
const DEBIT_VPA_RE = new RegExp(String.raw`\b(?:to|paid to|sent to|towards)(?::|\s)\s*(?:vpa\s*[:\-]?\s*)?` + VPA, 'i');
const CREDIT_VPA_RE = new RegExp(String.raw`\b(?:from|by|frm)(?::|\s)\s*(?:vpa\s*[:\-]?\s*)?` + VPA, 'i');
const ANY_VPA_RE = new RegExp(VPA, 'gi');
const DEBIT_NAME_RE = new RegExp(
  String.raw`\b(?:trf to|transfer to|transferred to|paid to|sent to|towards|to)\s+(?!your\b|ur\b|you\b|us\b|a\/c|ac\b|acct|account|block|report|dispute|stop|know|avoid|check|call|sms|the bank\b|bank\b)` +
    NAME +
    NAME_END,
  'i',
);
const ICICI_STYLE_RE = new RegExp(String.raw`;\s*` + NAME + String.raw`\s+credited\b`, 'i');
const AC_OF_RE = new RegExp(String.raw`\ba\/?c of\s+` + NAME + String.raw`\s+credited\b`, 'i');
const AT_MERCHANT_RE = new RegExp(String.raw`\bat\s+` + String.raw`([A-Za-z][A-Za-z0-9 .&'*\-]{1,40}?)` + String.raw`(?=\s+on\b|\s*[.,;](?:\s|$)|\s*\.|\s*$|\s+(?:avl|avbl|ref|txn)\b)`, 'i');
const ON_MERCHANT_RE = /\bon\s+([A-Z][A-Z0-9 &.'*\-]{2,40}?)(?=\.\s|\.$|\s*$)/;
const CREDIT_NAME_RE = new RegExp(
  String.raw`\b(?:transfer from|transferred from|from|by|frm)\s+(?!your\b|ur\b|a\/c|ac\b|acct|account|rs\b|inr\b|hdfc|icici|sbi|kotak|axis|bank\b|upi\b|mob\b|mobile\b|neft\b|imps\b|rtgs\b|net ?banking|cash\b|atm\b|cheque\b|clearing\b)` +
    NAME +
    NAME_END,
  'i',
);

function findCounterparty(text: string, direction: Direction, verb: string): { name: string | null; vpa: string | null } {
  const slash = SLASH_RE.exec(text);
  if (slash) {
    const n = cleanName(slash[1]);
    if (n && !/^[a-z0-9]{2,6}$/i.test(n)) return { name: n, vpa: null };
  }
  if (direction === 'debit') {
    const v = DEBIT_VPA_RE.exec(text);
    if (v) return { name: null, vpa: v[1].toLowerCase() };
    for (const re of [ICICI_STYLE_RE, AC_OF_RE, DEBIT_NAME_RE]) {
      const m = re.exec(text);
      const n = cleanName(m?.[1]);
      if (n) return { name: n, vpa: null };
    }
    if (/\b(?:spent|purchase)/i.test(verb) || /\bcard\b/i.test(text)) {
      for (const re of [AT_MERCHANT_RE, ON_MERCHANT_RE]) {
        const m = re.exec(text);
        const n = cleanName(m?.[1]);
        if (n) return { name: n, vpa: null };
      }
    }
    if (/\b(?:atm|withdrawn|withdrawal)\b/i.test(text)) return { name: 'ATM cash', vpa: null };
  } else {
    const v = CREDIT_VPA_RE.exec(text);
    if (v) return { name: null, vpa: v[1].toLowerCase() };
    const m = CREDIT_NAME_RE.exec(text);
    const n = cleanName(m?.[1]);
    if (n) return { name: n, vpa: null };
  }
  // last resort: any VPA in the text
  ANY_VPA_RE.lastIndex = 0;
  const any = ANY_VPA_RE.exec(text);
  ANY_VPA_RE.lastIndex = 0;
  if (any) return { name: null, vpa: any[1].toLowerCase() };
  return { name: null, vpa: null };
}

// ---------------------------------------------------------------------------------------------
// reference / account / method

const REF_RES = [
  /(?:upi\s*ref(?:erence)?(?:\s*(?:no|number|id))?|imps\s*ref(?:\s*no)?|ref(?:erence)?(?:\s*(?:no|number|id))?|refno|rrn|utr|txn\s*(?:id|no)|transaction\s*(?:id|no))\.?\s*[:.\-#]?\s*(?:no\.?\s*)?(\d{8,18})/i,
  /\bupi[:\s\/]+(?:(?:dr|cr|p2[am])\/)?(\d{9,18})/i,
];

function findRef(text: string): string | null {
  for (const re of REF_RES) {
    const m = re.exec(text);
    if (m) return m[1];
  }
  // a bare 12-digit UPI RRN, but not a phone number ("SMS BLOCK to 919951860002", "call 1800…")
  const re = /(?:^|\D)(\d{12})(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length - 12;
    const pre = text.slice(Math.max(0, start - 14), start).toLowerCase();
    if (/(?:call|sms|to|whatsapp|ph|mob|phone|tel|contact)\s*[:\-]?\s*\+?$/.test(pre)) continue;
    return m[1];
  }
  return null;
}

const ACCOUNT_RE = /\b(?:account|acct|a\/?c|ac|card)(?:\b|(?=[x*]\d|[x*]{2}))(?:\s*(?:no\.?|number|ending(?:\s+with)?|ending in))?\s*[:.]?\s*[x*.\-]*\s*(\d{3,6})\b/i;

function findAccount(text: string): string | null {
  const m = ACCOUNT_RE.exec(text);
  if (m) return m[1].slice(-4);
  const x = /[x*]{2,}(\d{3,6})\b/i.exec(text);
  return x ? x[1].slice(-4) : null;
}

function findMethod(text: string, vpa: string | null): PayMethod {
  if (vpa || /\bupi\b|\bvpa\b/i.test(text)) return 'upi';
  if (/\b(?:atm|withdrawn|withdrawal)\b/i.test(text)) return 'atm';
  if (/\bcard\b|\bspent\b/i.test(text)) return 'card';
  if (/\b(?:neft|imps|rtgs|net ?banking|netbanking)\b/i.test(text)) return 'netbanking';
  return 'other';
}

// ---------------------------------------------------------------------------------------------
// category guess

const CATEGORY_HINTS: [GuessCategory, RegExp][] = [
  ['food', /swiggy|zomato|eatsure|domino|pizza|kfc|mcdonald|burger|hotel|restaurant|cafe|coffee|tea\b|bakery|biryani|mess\b|canteen|food|sweets|juice|saravana|anjappar|a2b|adyar ananda/i],
  ['groceries', /bigbasket|blinkit|zepto|instamart|dmart|d-mart|grocery|groceries|kirana|supermarket|super market|mart\b|provision|vegetable|fruits|milk|aavin|nilgiris|reliance fresh|more retail|store\b|stores\b/i],
  ['travel', /uber|ola\b|rapido|irctc|redbus|metro|cmrl|railway|bus\b|petrol|fuel|hpcl|bpcl|iocl|indian oil|shell|fastag|parking|makemytrip|goibibo|indigo|air india|cab\b|auto\b/i],
  ['utilities', /airtel|jio|vodafone|\bvi\b|bsnl|tneb|tangedco|electricity|eb bill|bescom|power|gas\b|indane|hp gas|bharat gas|broadband|act fibernet|hathway|water|recharge|dth|tata play|sun direct/i],
  ['shopping', /amazon|flipkart|myntra|ajio|meesho|nykaa|croma|reliance digital|decathlon|lifestyle|westside|trends|shopping/i],
  ['health', /pharma|pharmacy|apollo|medplus|1mg|netmeds|pharmeasy|hospital|clinic|diagnostic|lab\b|medical|doctor|dental/i],
  ['entertainment', /bookmyshow|pvr|inox|netflix|hotstar|spotify|prime video|youtube|sony liv|zee5|cinema|theatre|game|steam/i],
  ['rent', /\brent\b|house owner|landlord|nobroker|nestaway|hostel|pg\b/i],
  ['household', /urban company|urbanclap|laundry|dry ?clean|plumber|electrician|carpenter|ikea|furniture|cleaning/i],
];

export function guessCategory(...texts: (string | null | undefined)[]): GuessCategory {
  const hay = texts.filter(Boolean).join(' ');
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(hay)) return cat;
  return 'other';
}

// ---------------------------------------------------------------------------------------------
// SMS

/** Is this SMS worth parsing at all? */
export function looksLikeBankSms(msg: Pick<RawMessage, 'sender' | 'body'>, opts: { requireAmount?: boolean } = {}): boolean {
  if (looksLikePhoneNumber(msg.sender)) return false;
  if (isPromotionalSender(msg.sender)) return false;
  const text = msg.body;
  if (OTP_RE.test(text)) return false;
  if (EXCLUDE_RE.test(text) && !COMPLETED_REFUND_RE.test(text)) return false;
  if (!INSTRUMENT_RE.test(text)) return false;
  if (opts.requireAmount === false) return true;
  MONEY_RE.lastIndex = 0;
  VERB_AMOUNT_RE.lastIndex = 0;
  const hasAmount = MONEY_RE.test(text) || VERB_AMOUNT_RE.test(text);
  MONEY_RE.lastIndex = 0;
  VERB_AMOUNT_RE.lastIndex = 0;
  return hasAmount;
}

function build(msg: RawMessage, parts: { direction: Direction; amount: number; name: string | null; vpa: string | null; ref: string | null; account: string | null; method: PayMethod; viaTemplate?: boolean }): ParsedTxn {
  const senderKey = msg.source === 'sms' ? senderKeyOf(msg.sender) : msg.sender;
  const amount = Math.round(parts.amount * 100) / 100;
  const counterparty = parts.name ? prettyName(parts.name) : parts.vpa;
  const key = parts.ref
    ? `ref:${parts.ref}`
    : `h:${msg.source}:${senderKey}:${parts.direction}:${amount.toFixed(2)}:${Math.floor(msg.timestamp / 60000)}`;
  return {
    key,
    source: msg.source,
    sender: msg.sender,
    senderKey,
    direction: parts.direction,
    amount,
    counterparty,
    vpa: parts.vpa,
    ref: parts.ref,
    account: parts.account,
    method: parts.method,
    timestamp: msg.timestamp,
    date: dayOf(msg.timestamp),
    confidence: counterparty ? 'high' : 'low',
    categoryGuess: guessCategory(counterparty, parts.vpa),
    body: msg.body,
    title: msg.title,
    viaTemplate: parts.viaTemplate,
  };
}

/**
 * Parse one SMS. Returns null for anything that is not a completed debit/credit
 * (OTPs, promotions, balance alerts, "will be debited", collect requests, failed payments…).
 * `templates` are user-taught hints; they are only used when the generic parser misses something.
 */
export function parseSms(msg: RawMessage, templates: SmsTemplate[] = []): ParsedTxn | null {
  const senderKey = senderKeyOf(msg.sender);
  const forSender = templates.filter((t) => t.senderKey === senderKey);
  // A taught sender may write amounts without "Rs"/"₹", so the amount check is left to the template.
  if (!looksLikeBankSms(msg, { requireAmount: forSender.length === 0 })) return null;
  const text = msg.body.replace(/\r/g, '');
  const dir = detectDirection(text);

  let direction = dir?.direction ?? null;
  let amount = findAmount(text, dir?.verbIndex ?? -1);
  let { name, vpa } = direction ? findCounterparty(text, direction, verbAt(text, dir!.verbIndex)) : { name: null, vpa: null };
  let viaTemplate = false;

  if (forSender.length && (!direction || amount == null || (!name && !vpa))) {
    const tpl = (direction && forSender.find((t) => t.direction === direction)) || forSender.find((t) => applyTemplate(text, t)?.amount != null);
    const applied = tpl ? applyTemplate(text, tpl) : null;
    if (tpl && applied) {
      direction = direction ?? tpl.direction;
      if (amount == null && applied.amount != null) amount = applied.amount;
      if (!name && !vpa && applied.payee) {
        const looksVpa = new RegExp(`^${VPA}$`, 'i').exec(applied.payee);
        if (looksVpa) vpa = applied.payee.toLowerCase();
        else name = applied.payee;
      }
      viaTemplate = true;
    }
  }

  if (!direction || amount == null) return null;
  return build(msg, {
    direction,
    amount,
    name,
    vpa,
    ref: findRef(text),
    account: findAccount(text),
    method: findMethod(text, vpa),
    viaTemplate,
  });
}

function verbAt(text: string, index: number): string {
  return index >= 0 ? text.slice(index, index + 12) : '';
}

// ---------------------------------------------------------------------------------------------
// notifications (GPay, PhonePe, Paytm, BHIM…) — same wording for every bank

export const PAYMENT_APPS: Record<string, string> = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'com.phonepe.app': 'PhonePe',
  'net.one97.paytm': 'Paytm',
  'in.org.npci.upiapp': 'BHIM',
  'in.amazon.mShop.android.shopping': 'Amazon Pay',
  'com.dreamplug.androidapp': 'CRED',
  'com.mobikwik_new': 'MobiKwik',
};

const N_AMT = String.raw`(?:₹|rs\.?|inr)\s*` + NUM;
const N_NAME = String.raw`(.+?)`;
const N_END = String.raw`(?=\s+(?:successfully|using|via|from your|on|in|through|with)\b|[.!\n]|$)`;
const NOTIF_EXCLUDE = /request|remind|cashback|reward|scratch|offer|you won|\bwon\b|\bdue\b|failed|declined|pending|processing|refund initiated|will be|split bill|ask(?:ed)? for/i;

const NOTIF_PATTERNS: { re: RegExp; direction: Direction; amountGroup: number; nameGroup: number }[] = [
  { re: new RegExp(String.raw`^` + N_NAME + String.raw`\s+(?:paid|sent)\s+you\s+` + N_AMT, 'im'), direction: 'credit', nameGroup: 1, amountGroup: 2 },
  { re: new RegExp(String.raw`(?:received|got)\s+` + N_AMT + String.raw`\s+from\s+` + N_NAME + N_END, 'i'), direction: 'credit', amountGroup: 1, nameGroup: 2 },
  { re: new RegExp(N_AMT + String.raw`\s+(?:received|credited)\s+from\s+` + N_NAME + N_END, 'i'), direction: 'credit', amountGroup: 1, nameGroup: 2 },
  { re: new RegExp(String.raw`payment\s+of\s+` + N_AMT + String.raw`\s+to\s+` + N_NAME + String.raw`\s+(?:is\s+|was\s+)?(?:successful|completed|done)`, 'i'), direction: 'debit', amountGroup: 1, nameGroup: 2 },
  { re: new RegExp(String.raw`(?:you\s+)?(?:paid|sent)\s+` + N_AMT + String.raw`\s+to\s+` + N_NAME + N_END, 'i'), direction: 'debit', amountGroup: 1, nameGroup: 2 },
  { re: new RegExp(N_AMT + String.raw`\s+(?:paid|sent)\s+to\s+` + N_NAME + N_END, 'i'), direction: 'debit', amountGroup: 1, nameGroup: 2 },
];

export function parseNotification(msg: RawMessage): ParsedTxn | null {
  const title = (msg.title ?? '').trim();
  const body = (msg.body ?? '').trim();
  const text = [title, body].filter(Boolean).join('\n');
  if (!text || NOTIF_EXCLUDE.test(text)) return null;

  // "Arun Kumar" / "Paid you ₹500"
  const paidYou = new RegExp(String.raw`^(?:has\s+)?(?:paid|sent)\s+you\s+` + N_AMT, 'i').exec(body);
  if (paidYou && title && !/[₹]|\d/.test(title)) {
    return build(msg, { direction: 'credit', amount: toNumber(paidYou[1]), name: cleanName(title), vpa: null, ref: null, account: null, method: 'upi' });
  }

  for (const p of NOTIF_PATTERNS) {
    for (const candidate of [body, text]) {
      const m = p.re.exec(candidate);
      if (!m) continue;
      const amount = toNumber(m[p.amountGroup]);
      if (!(amount > 0)) continue;
      const rawName = m[p.nameGroup];
      const vpaMatch = new RegExp(VPA, 'i').exec(rawName ?? '');
      return build(msg, {
        direction: p.direction,
        amount,
        name: vpaMatch ? null : cleanName(rawName),
        vpa: vpaMatch ? vpaMatch[1].toLowerCase() : null,
        ref: findRef(text),
        account: null,
        method: 'upi',
      });
    }
  }
  return null;
}

export function parseMessage(msg: RawMessage, templates: SmsTemplate[] = []): ParsedTxn | null {
  return msg.source === 'notification' ? parseNotification(msg) : parseSms(msg, templates);
}

// ---------------------------------------------------------------------------------------------
// teach once

/** Take up to two words of plain text right before `index`, stopping at digits. */
function anchorBefore(text: string, index: number, scrub: string[]): string {
  const raw = text.slice(Math.max(0, index - 24), index);
  const afterDigit = raw.replace(/^[\s\S]*\d/, '');
  const tokens = afterDigit.split(/\s+/).filter(Boolean).filter((tok) => !scrub.includes(tok.toLowerCase().replace(/[^a-z]/g, '')));
  const take = tokens.slice(-2);
  if (take.length === 2 && take[1].length >= 4) take.shift();
  return take.join(' ');
}

function anchorAfter(text: string, index: number, scrub: string[]): string {
  const raw = text.slice(index, index + 16);
  const beforeDigit = raw.replace(/\d[\s\S]*$/, '');
  const tokens = beforeDigit.split(/\s+/).filter(Boolean).filter((tok) => !scrub.includes(tok.toLowerCase().replace(/[^a-z]/g, '')));
  return tokens.slice(0, 1).join(' ');
}

/**
 * Build a shareable template from one SMS the user corrected by hand.
 * Only a few words around the amount and payee are kept — never the amount, the payee or account numbers.
 * `scrubWords` (e.g. the user's own name parts) are removed from the anchors.
 */
export function learnTemplate(body: string, senderKey: string, direction: Direction, amount: number, payee: string | null, scrubWords: string[] = []): SmsTemplate | null {
  const text = body.replace(/\r/g, '');
  const scrub = scrubWords.map((w) => w.toLowerCase().replace(/[^a-z]/g, '')).filter((w) => w.length >= 3);
  const numRe = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;
  let m: RegExpExecArray | null;
  let amountIndex = -1;
  while ((m = numRe.exec(text))) {
    if (Math.abs(toNumber(m[0]) - amount) < 0.005) {
      amountIndex = m.index;
      break;
    }
  }
  if (amountIndex < 0) return null;
  const tpl: SmsTemplate = { senderKey, direction, amountBefore: anchorBefore(text, amountIndex, scrub) };

  if (payee && payee.trim().length >= 2) {
    const idx = text.toLowerCase().indexOf(payee.trim().toLowerCase());
    if (idx >= 0) {
      const before = anchorBefore(text, idx, scrub);
      const after = anchorAfter(text, idx + payee.trim().length, scrub);
      if (before.replace(/[^a-z]/gi, '').length >= 2) {
        tpl.payeeBefore = before;
        tpl.payeeAfter = after;
      }
    }
  }
  return tpl;
}

/** Apply a template to a message. Returns what it could find. */
export function applyTemplate(body: string, tpl: SmsTemplate): { amount: number | null; payee: string | null } {
  const text = body.replace(/\r/g, '');
  const lower = text.toLowerCase();
  let amount: number | null = null;

  const startAt = tpl.amountBefore ? lower.indexOf(tpl.amountBefore.toLowerCase()) : 0;
  if (startAt >= 0) {
    const rest = text.slice(startAt + (tpl.amountBefore?.length ?? 0));
    const am = /^\s*(?:(?:rs|inr)\.?|₹)?\s*[:.]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i.exec(tpl.amountBefore ? rest : text.replace(/^[^0-9]*/, ''));
    if (am) amount = toNumber(am[1]);
  }

  let payee: string | null = null;
  if (tpl.payeeBefore) {
    const pi = lower.indexOf(tpl.payeeBefore.toLowerCase());
    if (pi >= 0) {
      const from = pi + tpl.payeeBefore.length;
      let end = -1;
      if (tpl.payeeAfter) end = lower.indexOf(tpl.payeeAfter.toLowerCase(), from + 1);
      if (end < 0) {
        const nl = text.indexOf('\n', from);
        end = nl >= 0 ? nl : text.length;
      }
      payee = cleanName(text.slice(from, Math.min(end, from + 60)));
    }
  }
  return { amount: amount != null && amount > 0 ? amount : null, payee };
}

// ---------------------------------------------------------------------------------------------
// merging + rule keys

/**
 * The same payment often arrives twice: bank SMS (has ref) + payment-app notification (has the name).
 * Merge them: same direction and amount within 10 minutes. The SMS wins; a missing name is filled in.
 */
export function mergeDuplicates(items: ParsedTxn[]): ParsedTxn[] {
  const byKey = new Map<string, ParsedTxn>();
  for (const t of items) if (!byKey.has(t.key)) byKey.set(t.key, t);
  const list = [...byKey.values()].sort((a, b) => a.timestamp - b.timestamp);
  const out: ParsedTxn[] = [];
  for (const t of list) {
    const twin = out.find((o) => o.source !== t.source && o.direction === t.direction && Math.abs(o.amount - t.amount) < 0.005 && Math.abs(o.timestamp - t.timestamp) <= 10 * 60_000);
    if (!twin) {
      out.push(t);
      continue;
    }
    const sms = twin.source === 'sms' ? twin : t;
    const notif = twin.source === 'sms' ? t : twin;
    // A bank SMS often only has the VPA; the app notification has the person's name — prefer a real name.
    const realName = (x: ParsedTxn) => (x.counterparty && x.counterparty !== x.vpa ? x.counterparty : null);
    const merged: ParsedTxn = {
      ...sms,
      counterparty: realName(sms) ?? realName(notif) ?? sms.counterparty ?? notif.counterparty,
      vpa: sms.vpa ?? notif.vpa,
      confidence: sms.counterparty || notif.counterparty ? 'high' : 'low',
      categoryGuess: sms.categoryGuess !== 'other' ? sms.categoryGuess : notif.categoryGuess,
    };
    out[out.indexOf(twin)] = merged;
  }
  return out;
}

/** Normalised name used to remember a payee ("ANNACHI STORE " → "annachi store"). */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9@. ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Every key a payee rule could be stored under for this payment (VPA first, then the name). */
export function ruleKeysFor(t: Pick<ParsedTxn, 'vpa' | 'counterparty'>): string[] {
  const keys: string[] = [];
  if (t.vpa) keys.push(t.vpa.toLowerCase());
  if (t.counterparty && t.counterparty !== t.vpa) keys.push(`name:${normalizeName(t.counterparty)}`);
  return keys;
}

/** Key a payee rule is stored under: the VPA when known, otherwise the normalised name. */
export function ruleKeyFor(t: Pick<ParsedTxn, 'vpa' | 'counterparty'>): string | null {
  if (t.vpa) return t.vpa.toLowerCase();
  if (t.counterparty) return `name:${normalizeName(t.counterparty)}`;
  return null;
}
