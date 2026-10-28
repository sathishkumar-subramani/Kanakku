# Kanakku design system

**Kanakku** (Tamil: *accounts*) — "Your room's shared ledger." A calm, paper-and-ink ledger feel with one warm accent. It must *not* look like Splitwise (no mint green, no bubbly cards): think a well-made notebook.

## Colour tokens (`shared/theme.json`)

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | `#F6F4EE` | `#0F1116` | page background (warm paper / ink) |
| surface | `#FFFFFF` | `#171A22` | cards, sheets |
| surface2 | `#EFECE4` | `#20242E` | inputs, chips, table stripes |
| border | `#E3DFD5` | `#2B303C` | hairlines |
| text | `#1B1C24` | `#F1EFE8` | primary text |
| muted | `#6C6F7C` | `#9A9EAC` | secondary text |
| accent | `#E2590B` | `#FF8A3D` | primary buttons, active tab, focus ring (saffron) |
| accentSoft | `#FDEBDD` | `#3A2416` | accent tints |
| positive | `#1D8F62` | `#3DCB8E` | "you are owed", income |
| positiveSoft | `#DFF4EA` | `#15382A` | |
| negative | `#CF3E38` | `#FF6B61` | "you owe" |
| negativeSoft | `#FBE4E2` | `#3F1F1D` | |
| info | `#2F6FED` | `#6B9CFF` | links |

Category colours (both themes, used on chips/charts): food `#F26D3D`, groceries `#4CAF7A`, rent `#5B6CFF`, utilities `#F5B400`, travel `#2BB3C9`, entertainment `#C85CD6`, shopping `#E8558C`, health `#3DBE8B`, household `#9A7B4F`, other `#8A8F9C`.

Category emoji: food 🍛, groceries 🛒, rent 🏠, utilities 💡, travel 🚌, entertainment 🎬, shopping 🛍️, health 💊, household 🧹, other 📦.

Member avatars: initials on a coloured circle; `avatarColor` comes from the API (set at registration from a palette of 8).

## Type

* Display & UI: **Plus Jakarta Sans** (600/700 for headings, 500 for labels, 400 body).
* Money: **DM Mono** 500, tabular. Every amount in the app is set in DM Mono so columns line up.
* Web: `@fontsource-variable/plus-jakarta-sans`, `@fontsource/dm-mono`. Mobile: `@expo-google-fonts/plus-jakarta-sans`, `@expo-google-fonts/dm-mono`.
* Sizes (web/mobile): display 32/28, h1 24/22, h2 18/17, body 15/15, small 13/13, micro 11/11.

## Shape & spacing

* Cards radius 18, inputs/buttons 12, chips pill. 1px `border` hairline on cards, no drop shadows in dark mode, a very soft shadow (`0 1px 2px rgba(0,0,0,.04)`) in light.
* Base spacing 4. Page gutter 16 (mobile) / 24 (web). Cards padding 16–20.
* Bottom tab bar on mobile: Home · Groups · ＋ (big saffron FAB "Add expense") · Personal · More.
* Web: left sidebar (collapsible on < 1024px to a top bar), content max width 1100.

## Money formatting

`₹1,250.50` style with Indian grouping (12,34,567.00) using `Intl.NumberFormat('en-IN', { style: 'currency', currency })`. Negative balances are shown as "you owe ₹x" in `negative`, positive as "you are owed ₹x" in `positive`, zero as "settled up" in `muted`. Never show a raw minus sign to the user for balances.

## Copy rules

* English only. Short, friendly, no exclamation marks. "Add expense", "Settle up", "Record a payment", "Who paid?", "Split between".
* Empty states say what to do next: "No expenses yet. Add the first one." with a button.
* Errors are sentences: "That invite code didn't match any group."

## Motion

Subtle. Screen transitions 200 ms, list items fade/slide 150 ms, no bouncing. The only "delight" moment: when a group becomes fully settled, the balance card shows a small check-mark animation.

## Screens (both apps)

1. **Sign in / Create account** — logo wordmark, two fields, one button, switch link.
2. **Home (dashboard)** — month picker (‹ Oct 2026 ›), four stat tiles (This month · You owe · You are owed · I paid), "Spend by group" bars, "By category" donut + legend, daily spend line, recent list. "Download PDF" button.
3. **Groups** — cards with emoji, name, members avatars, your balance line. Buttons: New group, Join with code.
4. **Group detail** — header (emoji, name, members, total spent), balance strip ("You are owed ₹400 overall" + "Settle up"), tabs: Expenses (grouped by day, month filter) · Balances (member balances + "who pays whom" list with "Settle" buttons) · Activity · Members (invite code with copy/share, add by email, leave/remove).
5. **Add / edit expense** — description, amount (big), category chips, date, "Paid by" (member picker), "Split" (equal by default with member toggles; advanced: exact / percent / shares with live remaining indicator), notes. Save.
6. **Settle up** — from → to (prefilled from the debt tapped), amount (prefilled, editable), date, note.
7. **Personal** — month picker, total, list grouped by day, add/edit sheet.
8. **Reports** — month list; per month: Download PDF (all / per group / personal), Download CSV.
9. **More / Settings** — profile (name, avatar colour), currency, theme (system/light/dark), change password, sign out, app version. Nothing else — configuration stays minimal.
