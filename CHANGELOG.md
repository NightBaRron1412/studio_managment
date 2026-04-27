# Changelog

All notable changes to **نظام إدارة مبيعات الاستوديو** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

---

## [1.4.1] — 2026-04-27

### Fixed (CI)
- 🛠️ **Tests CI workflow now typechecks cleanly.** `tsconfig.node.json` was including `src/main/**/*.ts` (which pulled in the new `__tests__` files) but didn't include the `tests/` helpers they import — TypeScript correctly refused. Added `tests/**/*.ts` and `vitest.config.ts` to the include set.
- 🧰 **`smoke.test.ts` typed the `.all()` result properly** — better-sqlite3 returns `unknown[]`, so casting must happen on the array, not in the `.map` callback.

---

## [1.4.0] — 2026-04-27

### Added — test suite + CI
- 🧪 **Vitest harness** running against an in-memory SQLite (the same migration + seed as a real first-launch). 22 tests across 4 files cover the critical paths and pin every recently-fixed bug as a regression test.
- 🤖 **GitHub Actions workflow** runs typecheck + tests on every push to `main` and every PR. Red tests fail the build.
- ⚙️ **`npm test` / `npm run test:watch`** — `pretest` rebuilds better-sqlite3 against Node so the native module loads outside of Electron.

### Coverage
- **Transactions**: create with stock decrement + initial payment row, آجل skips the payment row, stock-going-negative warning, markPaid caps + dates today, update preserves later payments, delete restores stock + soft-deletes, removePayment reverses.
- **Cash close**: cash-in by payment date (multi-day cash-flow correctness), non-cash methods excluded, soft-deleted excluded.
- **Regressions** (so they never come back): backfill is one-shot per database (1.1.5/1.1.6), payment dates use local time not UTC (1.2.0), edit cannot retroactively undo a recorded payment (1.2.0).

### Refactor
- `initDb(path?)` now accepts an optional path so tests can use `:memory:` without touching the user's real database. Production behaviour unchanged.

---

## [1.3.0] — 2026-04-27

### Added — global Ctrl+Z undo
- ⌨️ **Press `Ctrl+Z` (or `⌘+Z`) anywhere in the app to reverse the last action.** A toast confirms what was undone, and «Ctrl+Z للتراجع» is appended to the success toast of any reversible action so it's discoverable.
- The undo stack is **session-only** (resets when you close the app) and holds the **last 50 actions**.
- Ctrl+Z is suppressed while typing in an input/textarea/select so it never breaks native text-edit undo.

### Reversible actions covered
| Action | Where | Reverses by |
|---|---|---|
| Delete transaction | Transaction detail | Restoring from recycle bin |
| Delete client | Client profile | Restoring from recycle bin |
| Delete cash withdrawal | Withdrawals | Restoring from recycle bin |
| Delete rent payment | Rent | Restoring from recycle bin |
| Delete supplier purchase | مشتريات الموردين | Restoring from recycle bin |
| Record payment (تسجيل دفعة, تسوية, pay-on-deliver) | Anywhere | Removing the payment row + decrementing paid_amount |
| Mark order ready / delivered | طلبات قيد التسليم | Restoring previous pickup status |
| Pay-and-deliver | طلبات قيد التسليم | Removing the payment AND restoring previous pickup status |
| Restock item (+ تزويد) | Settings → الأصناف | Subtracting the qty + removing the supplier purchase row it created |

### Database
- New backend APIs: `payment:delete` (removes a payment row + decrements paid_amount on its transaction) and `item:unrestock` (reverses a restock and removes the linked supplier-purchase row).
- `item:restock` now returns `{ item, purchase_id }` so the renderer can target the exact purchase to unrestock.

---

## [1.2.1] — 2026-04-27

### Fixed
- 💵 **تقفيلة اليوم now refreshes immediately when you record a payment** from the Pickups, Debtors, or Transaction Detail page. The 1.2.0 payment-ledger change correctly persisted the payment dated today, but the cash-close view kept showing its stale cached number until you navigated away and back. All three payment call sites now invalidate the `cash-close-today` and `cash-close-list` queries on success.

---

## [1.2.0] — 2026-04-21

### Added — payments ledger (correct multi-day cash flow)
- 💸 **Every payment is now a row in a new `payments` table**, not just a number on the transaction. A sale created on Jan 1 with 30 paid up front and 70 paid on Jan 5 now correctly contributes **30 to Jan 1's cash close** and **70 to Jan 5's cash close** — instead of the old behaviour where the Jan 5 payment was silently dropped from any day's totals.
- 📜 **Payment history shown on the transaction detail page** — full audit trail under the المدفوع / المتبقي card listing each payment's date and amount.

### Changed
- 📊 **Cash close, dashboard income, and Reports income now all aggregate from the payments ledger** by the payment's own date. The three views finally agree on what "money received today/this week/this month" means.
- ✏️ **Editing a transaction preserves payment history** — only the original initial payment is reconciled to the new sale date and amount; later "تسجيل دفعة" entries stay intact. If you try to lower the paid amount below what's already been received via later payments, it's floored to the actual received total (you can't retroactively undo a recorded payment).

### Database
- New table: `payments(id, transaction_id, date, amount, payment_method, note, created_at)` with cascade-delete on transactions.
- One-shot backfill: every existing transaction with `paid_amount > 0` gets one payment row dated to the transaction's own date — preserves your existing income totals exactly. Idempotent and gated by a `payments_backfill_done` flag.
- `transactions.paid_amount` is kept as a denormalized cache so existing queries (debtors, remaining balances) keep working unchanged.

---

## [1.1.9] — 2026-04-21

### Fixed
- 👤 **Stale "(اختياري)" text in the customer picker** — the field label was switched to required in 1.1.7, but the placeholder inside the picker button still said «اختر عميلاً (اختياري)». Now matches the required state.

---

## [1.1.8] — 2026-04-21

### Changed
- 📦 **Default pickup status on a new transaction is now «قيد التحضير»** instead of «سُلِّم فوراً». Most studio orders need preparation before handover, so this default reflects reality and removes a click. The helper text under the dropdown now nudges you to switch to «سُلِّم فوراً» only when the customer takes the product on the spot.

---

## [1.1.7] — 2026-04-21

### Changed
- 👤 **العميل + الموظف are now required** when creating a transaction. Save is disabled until both are filled — every sale traces cleanly to who-bought-from-whom going forward. The «الموظف» input is now a proper styled dropdown (instead of the native datalist that looked ugly and inconsistent with the other inputs); if the staff list is empty it shows a single button that jumps straight to الإعدادات.

### Fixed
- 🔄 **No more scary "cannot find latest.yml" error mid-CI**. When GitHub Releases has the new release published but the workflow hasn't finished uploading `latest.yml` yet (it uploads last, ~30s after the release is created), the in-app updater used to surface that as a big red error. Now it's silently treated as "no update available right now" — re-check after the CI run finishes (~3 min from tag push).

---

## [1.1.6] — 2026-04-21

### Fixed (audit follow-up to 1.1.5)
- 🐛 **Closed an آجل-corruption hole on fresh installs.** The 1.1.5 backfill gate skipped the destructive UPDATE on a brand-new database, but it also skipped *setting the "done" flag*. So on a fresh install the sequence "create an آجل sale → restart app" would re-evaluate the gate, find a transaction with `paid_amount = 0`, and run the backfill anyway — destroying the آجل sale. The flag is now set unconditionally on first launch, and the backfill only runs when the heuristic clearly indicates a legacy schema upgrade (existing transactions, *all* with `paid_amount = 0`).
- 🌱 **Default settings (`business_name`, currency, etc.) now seed reliably** even when migrate() has already inserted internal flags into the settings table. Switched the seed-if-empty check from "settings table is empty" to "no `business_name` key yet".

---

## [1.1.5] — 2026-04-21

### Fixed (critical data-loss bugs)
- 💾 **Edits no longer revert after a hard PC shutdown** — SQLite was running in WAL mode but with the default `synchronous = NORMAL`, so a power loss could drop the most recent commits and leave a partially-paid edit looking like its pre-edit (often fully-paid) state. We now run `synchronous = FULL` so every commit is fsynced before returning. Tiny per-write cost; bulletproof durability.
- 🐛 **آجل (paid=0) sales no longer silently turn into "fully paid" on next launch** — there was a one-time historical backfill (`UPDATE transactions SET paid_amount = total WHERE paid_amount = 0`) that was running on **every** app start. Any legitimate آجل sale you created and then closed the app would come back as fully paid. The backfill is now gated behind a settings flag so it runs once per database and never again.

> If you have any آجل sales that mysteriously became fully paid in past versions, you'll need to recreate them — the bug erased the actual paid_amount; we can't recover it. Going forward, both bugs are fixed.

---

## [1.1.4] — 2026-04-20

### Added
- 💳 **Payment status on the طلبات قيد التسليم table** — same chip + amber row tint as the transactions and clients lists, so unpaid pickups stand out alongside paid ones at a glance.

### Fixed
- 🌙 **Dark-mode tints for the new payment-status highlights** — `bg-amber-50/40` (the row tint on unpaid transactions, pickups, and owing clients) and `bg-amber-100` (the amber avatar in the clients list) weren't in the dark-mode auto-mapping table, so they rendered as glaring solid amber on a dark background. Both are now mapped to translucent amber that blends with the dark theme.

---

## [1.1.3] — 2026-04-20

### Added
- 💳 **Payment status column on the transactions table** — every row now shows a chip: «مدفوع ✓» in green for fully-paid sales, «متبقّي X» or «آجل X» in amber for anything still owed. Unpaid rows also get a soft amber row tint so they jump out at a glance.
- 👤 **Outstanding-balance highlight on the clients list** — clients with any unpaid balance get an amber row tint, an amber avatar, and a new «المتبقّي عليه» chip showing exactly how much they owe.

---

## [1.1.2] — 2026-04-20

### Fixed
- 💰 **Editing a transaction now correctly shows the previously-paid amount** in the «المبلغ المدفوع» field. The auto-fill effect that defaults the field to the total on a *new* transaction was racing the existing-load effect on edits — both ran in the same effect phase, the auto-fill called `setPaidAmount` last with a still-stale `totals.total = 0`, and the field stuck at 0 forever (so a transaction paid 74/100 looked like 0/100 in the edit screen). The auto-fill now skips when an existing transaction is loaded.

---

## [1.1.1] — 2026-04-20

### Fixed
- 🔄 **Editing a transaction now shows the new values immediately** — the save handler invalidated only the transactions list cache, so navigating back to the transaction detail page rendered the stale pre-edit copy. Now it also invalidates `['transaction', id]`, so the detail view refetches and reflects the edit straight away.

---

## [1.1.0] — 2026-04-20

### Added
- 📦 **Inventory & stock tracking** — per-item toggle on each item in الإعدادات → الأصناف. When enabled:
  - Set the current on-hand quantity and a low-stock threshold.
  - Every sale automatically decrements the stock (line quantity × tracked items only). Editing or deleting a sale rebalances stock cleanly. Restoring a deleted sale re-applies the deduction.
  - Negative stock is allowed with a toast warning, so you never get blocked from saving a sale.
  - **+ تزويد** button on each item opens a quick restock dialog (quantity + optional cost & supplier) — bumps stock and writes a linked row to the supplier purchases ledger.
- 🚨 **Low-stock notifications** in three places:
  - Red badge on the **الإعدادات** link in the sidebar showing the count of low/out items (refreshes every 60s).
  - **Dashboard alert card** listing the items that need attention, with a quick jump to restock.
  - **One-shot toast on app launch** summarising what's low.
- 👥 **Staff list** — manage staff in الإعدادات → الموظفون. The «الموظف» field on معاملة جديدة is now a combobox sourced from this list, with the typed-name fallback preserved for one-off entries.

### Changed
- 🏷️ Renamed the «المشتريات والمخزون» page to **مشتريات الموردين** to avoid confusion with the new on-hand stock system. The sidebar entry now reads مشتريات الموردين too. The page itself is still the same supplier-purchases ledger you used before — restocking a tracked item from الإعدادات automatically writes into it.

### Database
- New columns (auto-migrated on first launch): `items.tracks_stock`, `items.stock_qty`, `items.low_stock_threshold`, `inventory_purchases.item_id`.
- New table: `staff (id, name, is_active, created_at)`.

> ⚠️ Same one-time manual install caveat as the 1.0.x signed releases — download `...-Setup-1.1.0.exe` once from GitHub Releases, then in-app updates work going forward.

---

## [1.0.10] — 2026-04-20

### Added
- 💰 **Unpaid-on-delivery prompt** — when marking a طلب قيد التسليم as تسليم, if the order still has an unpaid balance the app now opens a dialog reminding you to collect from the client. The dialog shows total/paid/remaining, lets you record the payment in one click (defaulted to the remaining amount), and then marks the order as delivered. You can also choose **تسليم بدون دفع** to deliver as-is and leave the remainder on the client's tab (آجل).

---

## [1.0.9] — 2026-04-20

### Fixed
- 🔓 **Auto-update no longer rejects the new installer** with "certificate chain terminated in an untrusted root" — electron-updater's Authenticode chain check is now bypassed because the project ships with a self-signed cert that isn't anchored in any trusted CA. Trust still relies on the GitHub Release source (only the project owner can publish there).

> ⚠️ Same one-time manual install caveat as 1.0.8 — download `...-Setup-1.0.9.exe` once, then in-app updates work going forward.

---

## [1.0.8] — 2026-04-20

### Fixed
- 🔏 **Auto-update signature check** — explicitly set `publisherName: "Studio Manager"` in the build config so electron-updater's signature verification compares against a stable, deterministic value instead of auto-detecting from the certificate (which intermittently failed with "not signed by the application owner" on self-signed certs).

> ⚠️ **Manual install required this once.** The currently installed v1.0.6/v1.0.7 cannot accept this update via the in-app updater (its baseline publisher was auto-detected). Download `...-Setup-1.0.8.exe` from the [GitHub release](https://github.com/NightBaRron1412/studio_managment/releases/latest) and run it once. From v1.0.8 onward, in-app auto-updates will work normally.

---

## [1.0.7] — 2026-04-20

### Fixed
- 🧾 **Receipt PDF now shows the full price breakdown** — previously only the final total was printed. The receipt now lists: subtotal, discount (with % when applicable), VAT, total, paid amount, and remaining balance (آجل) — each row rendered only when relevant.

---

## [1.0.6] — 2026-04-20

### Added
- 📦 **Portable `.zip` build** alongside the NSIS installer — extract anywhere and run `StudioManager.exe`. Avoids browser "virus detected" false positives that hit unsigned `.exe` downloads.
- 🔏 **Code signing** for the Windows installer using a self-signed certificate (via `WIN_CSC_LINK` / `WIN_CSC_KEY_PASSWORD` GitHub Secrets), so the installer no longer shows "Unknown publisher".

### Changed
- CI workflow `build-windows.yml` wires `CSC_LINK` + `CSC_KEY_PASSWORD` env vars and uploads `.zip` artifacts on non-tag builds.

---

## [1.0.5] — 2026-04-19

### Added
- 🚀 **Splash screen** on app launch (frameless transparent window with logo + animated loader)
- 🔄 **Full auto-update flow** — Settings → فحص التحديثات now offers download (with **live progress bar**) and one-click install
- IPC events: `update:progress`, `update:downloaded`, `update:error` forwarded to renderer

### Changed
- 🎨 **Icon redesigned** with layered solid colors that ImageMagick renders correctly (the previous "fancy" SVG silently lost gradients/filters and came out all black)

### Fixed
- electron-updater wired to expose download/install (previously only checked)

---

## [1.0.4] — 2026-04-19

### Added
- 🧹 **System reset** in Settings → الحماية → المنطقة الخطرة
  - **مسح كل السجلات**: clears transactions/clients/money movements but keeps items + settings
  - **إعادة ضبط المصنع**: full wipe; onboarding wizard re-appears; auto-relaunches
  - Both gated by typing the word "حذف" to confirm
- 🎨 Fancier app icon (squircle, Islamic-pattern background, refined camera + lens)

### Changed
- `releaseType: "release"` added to publish config so future builds **publish immediately** (not as drafts)
- Retroactively published v1.0.1, v1.0.2, v1.0.3 from drafts

---

## [1.0.3] — 2026-04-19

### Fixed
- 🔢 PIN dots now fill **left → right** (added `dir="ltr"` to the dot row)
- 📱 WhatsApp share now **reveals the PDF in File Explorer** so the user can drag it directly into the chat (wa.me URLs don't support file pre-attach)
- Updated toast: "فُتحت واتساب — اسحب ملف PDF من النافذة المفتوحة إلى المحادثة"

---

## [1.0.2] — 2026-04-19

### Fixed
- 🖼️ **Logo on PDF receipts** — was showing as blank space because @react-pdf/renderer's `Image` component is unreliable with file path strings (especially Windows backslashes). Now reads the PNG into a Node `Buffer` and passes `{ data, format: 'png' }` to the Image — works identically across OSes.

---

## [1.0.1] — 2026-04-19

### Fixed
- 🪟 **Windows EBUSY** when generating PDFs — receipts now use unique timestamped filenames in temp so reopens don't collide with files held by the user's PDF viewer
- Friendly Arabic error if the destination is locked: "الملف مفتوح في برنامج آخر. أغلقه ثم حاول مرة أخرى."

---

## [1.0.0] — 2026-04-19

### Initial release 🎉

A complete photography studio management system in Arabic.

**Sales & Customers**
- Multi-line transactions with predefined or custom items
- Discount (% or fixed) and optional VAT
- Partial payments (آجل) with debtors page and mark-as-paid
- Full client directory with purchase history, total spent, smart per-client suggestions
- Duplicate any past transaction in one click
- Multiple payment methods (cash, card, transfer, wallet, credit)

**Schedule & Operations**
- Bookings calendar (sessions with type, deposit, status)
- Pickup tracking (pending/ready/delivered) with overdue alerts
- Reminders with due dates and dashboard alerts
- End-of-day cash close with expected vs actual + history

**Money Out**
- Cash withdrawals
- Monthly rent with partial payments
- Inventory/supplies purchases

**Reports**
- Date range filters, by-day chart, by-item, by-category, by-payment-method
- PDF and Excel export
- Dashboard tiles: net month, weekly trend, active clients, top items

**Safety**
- Manual + automatic backups (keeps last 7)
- Full restore from any `.db` file
- Soft delete + recycle bin (سلة المحذوفات)
- Optional 4–8 digit PIN lock
- 4-step onboarding wizard on first launch

**Polish**
- 100% Arabic UI with Cairo font + RTL throughout
- Dark mode + privacy mode (blur amounts)
- Ctrl+K spotlight search
- Studio logo on receipt PDFs
- WhatsApp share with prefilled receipt summary
- Auto-update infrastructure (electron-updater + GitHub releases)
- Windows NSIS installer with desktop shortcut + Start Menu entry

### Tech stack
Electron 32, React 18, TypeScript 5, Vite 5, Tailwind CSS 3, better-sqlite3 11, TanStack Query 5, @react-pdf/renderer 4, exceljs 4, Recharts 2, electron-builder 25, electron-vite 2, electron-updater 6.

---

[1.0.5]: https://github.com/NightBaRron1412/studio_managment/releases/tag/v1.0.5
[1.0.4]: https://github.com/NightBaRron1412/studio_managment/releases/tag/v1.0.4
[1.0.3]: https://github.com/NightBaRron1412/studio_managment/releases/tag/v1.0.3
[1.0.2]: https://github.com/NightBaRron1412/studio_managment/releases/tag/v1.0.2
[1.0.1]: https://github.com/NightBaRron1412/studio_managment/releases/tag/v1.0.1
[1.0.0]: https://github.com/NightBaRron1412/studio_managment/releases/tag/v1.0.0
