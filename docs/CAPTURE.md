# Payment capture (Android)

Kanakku can add payments without typing by reading **bank SMS** and **UPI app notifications** on the phone.

## Flow

1. **Read** — `modules/kanakku-capture` (Kotlin, Expo module):
   - `readSms(since, limit)` queries the SMS inbox (READ_SMS, asked at runtime). Only alphanumeric senders
     (bank DLT headers like `VM-HDFCBK-S`) are returned; chats from phone numbers never reach JS.
   - `PaymentNotificationService` (a `NotificationListenerService`, enabled by the user in Android settings)
     keeps only notifications from GPay / PhonePe / Paytm / BHIM / Amazon Pay / CRED / MobiKwik … that mention ₹.
     They wait in app-private storage until the app drains them.
2. **Parse** — `src/capture/parser.ts`, bank-agnostic: amount next to the debit/credit verb (balance / limit
   amounts are skipped), direction from the first verb, payee from the usual shapes (`UPI/P2M/<ref>/NAME`,
   `to VPA x@y`, `; NAME credited`, `trf to NAME`, `at MERCHANT`), UPI ref / RRN, account last 4.
   OTPs, "will be debited", collect requests, failed payments and promotional (`-P`) senders are dropped.
   Tested against ~45 formats from 25+ banks (`tests/parser.test.ts`).
3. **Merge** — the bank SMS and the GPay notification for the same payment become one item (same amount and
   direction within 10 minutes; SMS keeps the ref, the notification gives the person's name).
4. **Dedupe** — every item has a key (`ref:<UPI ref>` or a hash). It is sent as `sourceRef` when saved, and
   `POST /api/capture/match` tells which keys are already recorded — so a roommate's SMS for the same UPI payment
   (same ref on both sides) can't create a second settlement.
5. **Sort** — Inbox suggests Personal / Group split / Settle up / Skip:
   - a remembered payee rule (`/api/capture/rules`) wins, optionally saving automatically;
   - a payee that matches a group member's name or email id → settle up;
   - groceries / rent / utilities / household → the group; other spends → personal; money in → skip.
6. **Teach once** — when the parser can't read an SMS format, the user types the amount / payee once. Only the
   1–2 words around them are kept (`/api/capture/templates`, shared with everyone, digits rejected).

## Privacy

- Raw SMS / notification text stays on the phone (AsyncStorage, per user).
- The server receives only the expenses the user saves, their payee rules, and anonymous format hints.
- Turning off SMS in Kanakku stops reading at once; notification access is revoked in Android settings.
