# استوديو التصوير — Studio Manager

Desktop application for managing a photography studio: transactions, clients,
cash withdrawals, rent, inventory purchases, and reporting.

- **Platform:** Windows desktop (built with Electron — also runs on macOS / Linux for development).
- **Storage:** Local SQLite database in the user's profile. No server, no cloud, no internet required.
- **UI:** Fully Arabic (RTL).
- **Packaging:** Single `.exe` installer (NSIS) with desktop shortcut, Start Menu entry, and uninstaller.

---

## For end users (Windows install)

After packaging (see below), the user double-clicks `استوديو التصوير-Setup-1.0.0.exe`,
follows the Arabic installer, and launches the app from the desktop shortcut. No
configuration or terminal use required.

Backups: from inside the app, click **نسخ احتياطي** in the top bar to save a `.db`
file anywhere (USB stick, OneDrive folder, etc.). Restore by clicking **استعادة**
and selecting that file.

The database file lives at:
```
%APPDATA%\studio-manager\studio.db
```
(equivalent to `C:\Users\<username>\AppData\Roaming\studio-manager\studio.db`).

---

## Tech stack

| Layer        | Choice                                    |
|--------------|-------------------------------------------|
| Shell        | Electron 32                               |
| UI           | React 18 + TypeScript + Vite              |
| Styling      | Tailwind CSS (RTL) + Cairo / IBM Plex     |
| State / data | TanStack Query + Zustand                  |
| DB           | SQLite via `better-sqlite3` (synchronous) |
| Routing      | React Router 6 (HashRouter for file://)   |
| PDF          | `@react-pdf/renderer`                     |
| Excel        | `exceljs`                                 |
| Charts       | Recharts                                  |
| Build        | electron-vite                             |
| Installer    | electron-builder → NSIS                   |

---

## Development setup

### Prerequisites
- **Node.js 20+** (LTS recommended)
- **npm** (or pnpm/yarn — instructions use npm)
- For Windows builds: building **on** Windows is recommended (NSIS + native module rebuild). Cross-compiling NSIS installers from Linux/macOS works in many cases via Wine, but the supported path is to build on Windows.

### Install
```sh
npm install
```

`postinstall` runs `electron-builder install-app-deps`, which rebuilds
`better-sqlite3` against Electron's Node ABI. If you ever see a "wrong NODE_MODULE_VERSION"
error, run:
```sh
npm run rebuild
```

### Run in development
```sh
npm run dev
```
Hot-reloads the renderer; main process restarts on changes.

### Type-check
```sh
npm run typecheck
```

### Build the installer

On Windows:
```sh
npm run build:win
```
Output: `dist-installer/استوديو التصوير-Setup-1.0.0.exe`

This produces:
- A signed-ready (unsigned by default) NSIS installer
- Desktop shortcut + Start Menu entry both labeled **استوديو التصوير**
- Uninstaller registered with Programs and Features
- App data preserved on uninstall (so user backups are safe)

For an unsigned install on a fresh Windows machine, the user may see a SmartScreen
warning ("Windows protected your PC"). They click **More info → Run anyway**.
For production distribution, code-sign the installer with an EV or OV certificate.

---

## Project structure

```
src/
├── main/              # Electron main process (Node.js)
│   ├── index.ts        # Window creation, app lifecycle
│   ├── db.ts           # SQLite init, migrations, seed
│   ├── ipc.ts          # IPC handler registration
│   ├── pdf.ts          # PDF generation (receipts, reports)
│   ├── excel.ts        # Excel export
│   └── repos/          # Repository layer (one file per entity)
├── preload/           # Secure IPC bridge (contextBridge)
├── shared/            # Types shared between main and renderer
└── renderer/          # React app (Vite-bundled)
    └── src/
        ├── App.tsx
        ├── components/
        ├── pages/
        ├── lib/
        └── store/

resources/             # icon.ico, app metadata
electron.vite.config.ts
electron-builder config (in package.json `build` field)
```

---

## Features

- **Dashboard:** today/month income, transaction count, withdrawals, rent progress, top items, net summary
- **New Transaction:** multi-line items with picker or custom items, client linking, payment method, staff
- **Transactions list & detail:** searchable, filterable by date, printable PDF receipt, edit, delete
- **Clients:** searchable directory, profile with full purchase history, total spent, visit count, last visit
- **Cash withdrawals:** date, amount, person, reason
- **Rent:** month-by-month browsing, partial payments, required/paid/remaining with progress bar
- **Inventory:** supply purchases with date, quantity, cost, supplier
- **Reports:** date range filter, by-day chart, by-item / by-category breakdowns, PDF + Excel export
- **Settings:** items management with categories and prices, business info, currency, numerals style, backup/restore
- **Backup / Restore:** save/restore the entire database as a single file
- **Arabic-Indic numerals option** in settings (٠١٢٣ vs 0123)

---

## Known limitations / future work

- PDF Arabic shaping uses the system Tahoma/Arial fallback. For perfect ligature shaping in long Arabic strings, ship a vendored Arabic font (Cairo or Noto Naskh Arabic) under `resources/fonts/` and register it in `src/main/pdf.ts`.
- No multi-user accounts (single-shop model). Add an authentication step in `src/renderer/src/App.tsx` if needed.
- No automatic cloud backup (intentional — single-file `.db` is trivially synced via OneDrive/Dropbox if the user wants).

---

## License

MIT
