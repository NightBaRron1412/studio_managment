# Screenshots

The README's screenshot section references PNG files in this folder. To populate it:

1. Open the running app (`npm run dev` or the installed `.exe`).
2. Take screenshots of these views and save them here with these exact names:

| File | View |
|---|---|
| `dashboard.png` | الرئيسية — Dashboard with the alert banners and stat tiles |
| `new-transaction.png` | معاملة جديدة — New Transaction with a few line items + discount |
| `client-profile.png` | ملف العميل — Client profile showing past transactions |
| `bookings.png` | حجوزات الجلسات — Bookings page (today filter) |
| `cash-close.png` | تقفيلة اليوم — End of day with expected vs actual |
| `dark-mode.png` | Any page with dark mode enabled (toggle from top bar) |

**Recommended size:** 1400×900 px PNG. On Windows, **Windows + Shift + S** lets you crop a region; on macOS, **Cmd + Shift + 4**.

After dropping screenshots in: `git add docs/screenshots/*.png && git commit -m "docs: add screenshots" && git push` — and they appear automatically in the README.
