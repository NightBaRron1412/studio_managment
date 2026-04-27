import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized')
  return db
}

export function getDbPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'studio.db')
}

function runBatch(d: Database.Database, sql: string): void {
  const fn = (d as unknown as Record<string, (s: string) => void>)['exec']
  fn.call(d, sql)
}

export function initDb(customPath?: string): Database.Database {
  // Tests pass ':memory:' (or a tmp file) so they can run the same migrate
  // and seedIfEmpty path without touching the user's real database.
  const path = customPath ?? getDbPath()
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  // synchronous=FULL fsyncs every commit so a hard PC shutdown after an
  // edit can't roll the row back to its pre-edit state. Slight write-cost
  // (microseconds per commit) but this is a desktop app — durability wins.
  db.pragma('synchronous = FULL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  seedIfEmpty(db)
  return db
}

// Force a WAL checkpoint and fsync. Called from IPC handlers after every
// write so even an instant power loss leaves the database consistent.
export function checkpointDb(): void {
  if (db) {
    try {
      db.pragma('wal_checkpoint(PASSIVE)')
    } catch {
      // checkpoint failure isn't fatal — synchronous=FULL has already
      // fsync'd the WAL entry; we just couldn't fold it into the main file.
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

interface ColumnInfo {
  name: string
}

function hasColumn(d: Database.Database, table: string, col: string): boolean {
  const rows = d.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]
  return rows.some((r) => r.name === col)
}

function addColumnIfMissing(d: Database.Database, table: string, col: string, ddl: string): void {
  if (!hasColumn(d, table, col)) {
    runBatch(d, `ALTER TABLE ${table} ADD COLUMN ${ddl};`)
  }
}

function migrate(d: Database.Database): void {
  const schema = `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      icon TEXT
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      name_ar TEXT NOT NULL,
      size TEXT,
      default_price REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_no TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      staff_name TEXT,
      notes TEXT,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_client ON transactions(client_id);
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
      custom_name TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_txi_tx ON transaction_items(transaction_id);
    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      withdrawn_by TEXT,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wd_date ON withdrawals(date);
    CREATE TABLE IF NOT EXISTS rent_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_date TEXT NOT NULL,
      period_year INTEGER NOT NULL,
      period_month INTEGER NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rent_period ON rent_payments(period_year, period_month);
    CREATE TABLE IF NOT EXISTS inventory_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      cost REAL NOT NULL,
      supplier TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_inv_date ON inventory_purchases(date);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cash_closes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      expected_cash REAL NOT NULL,
      actual_cash REAL NOT NULL,
      difference REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cc_date ON cash_closes(date);
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT,
      client_phone TEXT,
      session_type TEXT NOT NULL,
      deposit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'scheduled',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bk_date ON bookings(date);
    CREATE INDEX IF NOT EXISTS idx_bk_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_bk_deleted ON bookings(deleted_at);
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      due_date TEXT,
      is_done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_rem_done ON reminders(is_done);
    CREATE INDEX IF NOT EXISTS idx_rem_due ON reminders(due_date);
  `
  runBatch(d, schema)

  // Idempotent column additions for existing databases
  addColumnIfMissing(d, 'transactions', 'subtotal', 'subtotal REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'transactions', 'discount_type', 'discount_type TEXT')
  addColumnIfMissing(d, 'transactions', 'discount_value', 'discount_value REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'transactions', 'discount_amount', 'discount_amount REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'transactions', 'vat_percent', 'vat_percent REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'transactions', 'vat_amount', 'vat_amount REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'transactions', 'paid_amount', 'paid_amount REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'transactions', 'deleted_at', 'deleted_at TEXT')
  addColumnIfMissing(d, 'clients', 'deleted_at', 'deleted_at TEXT')
  addColumnIfMissing(d, 'withdrawals', 'deleted_at', 'deleted_at TEXT')
  addColumnIfMissing(d, 'rent_payments', 'deleted_at', 'deleted_at TEXT')
  addColumnIfMissing(d, 'inventory_purchases', 'deleted_at', 'deleted_at TEXT')
  addColumnIfMissing(d, 'transactions', 'pickup_status', "pickup_status TEXT")
  addColumnIfMissing(d, 'transactions', 'pickup_promised_date', 'pickup_promised_date TEXT')
  addColumnIfMissing(d, 'transactions', 'pickup_delivered_at', 'pickup_delivered_at TEXT')

  // Inventory tracking on items + purchase-to-item linking
  addColumnIfMissing(d, 'items', 'tracks_stock', 'tracks_stock INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'items', 'stock_qty', 'stock_qty REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'items', 'low_stock_threshold', 'low_stock_threshold REAL NOT NULL DEFAULT 0')
  addColumnIfMissing(d, 'inventory_purchases', 'item_id', 'item_id INTEGER REFERENCES items(id) ON DELETE SET NULL')

  // Payments ledger — replaces the single transactions.paid_amount column
  // for tracking *when* money actually came in. paid_amount stays as a
  // denormalized cache so existing queries (debtors, transaction
  // remaining) keep working, but cash-close and reports now sum payments
  // rows by their own date — so a partial sale paid off later credits the
  // day the money was received, not the day the sale was made.
  runBatch(
    d,
    `CREATE TABLE IF NOT EXISTS payments (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
       date TEXT NOT NULL,
       amount REAL NOT NULL,
       payment_method TEXT,
       note TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     );
     CREATE INDEX IF NOT EXISTS idx_payments_tx ON payments(transaction_id);
     CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);`
  )

  // Staff list — replaces free-text staff_name on transactions
  runBatch(
    d,
    `CREATE TABLE IF NOT EXISTS staff (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       is_active INTEGER NOT NULL DEFAULT 1,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     );
     CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(is_active);`
  )

  // One-shot historical backfill — runs at most once per database. The
  // original query
  //   UPDATE transactions SET paid_amount = total WHERE paid_amount = 0
  // ran on every launch and silently marked every legitimate آجل sale as
  // fully paid the next time the app started. We still need the backfill
  // for users upgrading from a schema that lacked paid_amount/subtotal,
  // but the heuristic «every existing row has paid_amount = 0» is what
  // distinguishes a real schema-upgrade backfill from "user just typed
  // an آجل sale and restarted".
  const flag = d
    .prepare(`SELECT value FROM settings WHERE key = 'paid_subtotal_backfill_done'`)
    .get() as { value: string } | undefined
  if (!flag) {
    // Only run the destructive UPDATE when it really looks like a legacy
    // schema upgrade: there are existing transactions AND none of them
    // have any recorded payment yet (i.e., paid_amount column was likely
    // just added by addColumnIfMissing and defaulted everything to 0).
    const stats = d
      .prepare(
        `SELECT COUNT(*) AS total_count,
                SUM(CASE WHEN paid_amount > 0 THEN 1 ELSE 0 END) AS paid_count
         FROM transactions`
      )
      .get() as { total_count: number; paid_count: number | null }
    const looksLikeLegacyUpgrade =
      stats.total_count > 0 && (stats.paid_count ?? 0) === 0
    if (looksLikeLegacyUpgrade) {
      d.prepare(
        `UPDATE transactions SET paid_amount = total WHERE paid_amount = 0 AND total > 0`
      ).run()
      d.prepare(
        `UPDATE transactions SET subtotal = total WHERE subtotal = 0 AND total > 0`
      ).run()
    }
    // ALWAYS set the flag (even on fresh installs / databases that already
    // have proper paid data) so the destructive query can never fire later.
    // Done after seedIfEmpty would otherwise be skipped — see closeover at
    // end of migrate(): we set the flag here unconditionally so a future
    // launch never re-evaluates the heuristic.
    d.prepare(
      `INSERT OR REPLACE INTO settings (key, value)
       VALUES ('paid_subtotal_backfill_done', '1')`
    ).run()
  }

  // One-shot payments backfill — every transaction with paid_amount > 0
  // that doesn't already have a payment row gets one dated to the
  // transaction's own date. Idempotent via the settings flag AND the
  // NOT EXISTS clause, so re-running it would never double-count even
  // if the flag was deleted.
  const paymentsFlag = d
    .prepare(`SELECT value FROM settings WHERE key = 'payments_backfill_done'`)
    .get() as { value: string } | undefined
  if (!paymentsFlag) {
    d.prepare(
      `INSERT INTO payments (transaction_id, date, amount, payment_method, note)
       SELECT t.id, t.date, t.paid_amount, t.payment_method,
              'تم تحويلها تلقائياً من السجل القديم'
       FROM transactions t
       WHERE t.paid_amount > 0
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.transaction_id = t.id)`
    ).run()
    d.prepare(
      `INSERT OR REPLACE INTO settings (key, value)
       VALUES ('payments_backfill_done', '1')`
    ).run()
  }

  // Helpful indexes for new columns
  runBatch(
    d,
    `CREATE INDEX IF NOT EXISTS idx_tx_deleted ON transactions(deleted_at);
     CREATE INDEX IF NOT EXISTS idx_tx_paid ON transactions(paid_amount);
     CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deleted_at);
     CREATE INDEX IF NOT EXISTS idx_wd_deleted ON withdrawals(deleted_at);
     CREATE INDEX IF NOT EXISTS idx_rent_deleted ON rent_payments(deleted_at);
     CREATE INDEX IF NOT EXISTS idx_inv_deleted ON inventory_purchases(deleted_at);`
  )
}

function seedIfEmpty(d: Database.Database): void {
  const catCount = d.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }
  if (catCount.c === 0) {
    const insertCat = d.prepare('INSERT INTO categories (name_ar, sort_order, icon) VALUES (?, ?, ?)')
    const cats = [
      { name: 'طباعة', icon: 'printer' },
      { name: 'تصوير', icon: 'camera' },
      { name: 'براويز', icon: 'frame' },
      { name: 'تابلوهات', icon: 'image' },
      { name: 'ألبومات', icon: 'book' },
      { name: 'هدايا', icon: 'gift' },
      { name: 'طباعة من الموبايل', icon: 'phone' },
      { name: 'مصاريف', icon: 'receipt' },
      { name: 'أخرى', icon: 'more' }
    ]
    cats.forEach((c, i) => insertCat.run(c.name, i, c.icon))
  }

  const itemCount = d.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number }
  if (itemCount.c === 0) {
    const printingId = (d.prepare('SELECT id FROM categories WHERE name_ar = ?').get('طباعة') as { id: number }).id
    const phoneId = (d.prepare('SELECT id FROM categories WHERE name_ar = ?').get('طباعة من الموبايل') as { id: number }).id
    const insertItem = d.prepare(
      'INSERT INTO items (category_id, name_ar, size, default_price, is_active) VALUES (?, ?, ?, ?, 1)'
    )
    insertItem.run(printingId, 'مقاس ٤×٦ عادي', '4×6', 60)
    insertItem.run(printingId, 'مقاس ٤×٦ فوري', '4×6', 70)
    insertItem.run(printingId, 'كروت جروب', null, 45)
    insertItem.run(phoneId, 'تسليم على الموبايل بدون طباعة', null, 25)
  }

  // Use a sentinel key (business_name is always seeded) instead of checking
  // the whole settings count — migrate() may have inserted internal flags
  // (e.g., paid_subtotal_backfill_done) before this seed runs.
  const hasBusinessName = d
    .prepare(`SELECT 1 FROM settings WHERE key = 'business_name'`)
    .get()
  if (!hasBusinessName) {
    const ins = d.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    ins.run('business_name', 'نظام إدارة الاستوديو')
    ins.run('default_rent', '2500')
    ins.run('currency_symbol', 'ج.م')
    ins.run('numerals_style', 'western')
    ins.run('owner_name', '')
    ins.run('phone', '')
    ins.run('address', '')
    ins.run('vat_enabled', 'false')
    ins.run('vat_default_percent', '14')
    ins.run('theme', 'light')
    ins.run('auto_backup_enabled', 'false')
    ins.run('auto_backup_dir', '')
    ins.run('logo_path', '')
    ins.run('pin_enabled', 'false')
    ins.run('pin_hash', '')
    ins.run('privacy_mode', 'false')
    ins.run('onboarding_done', 'false')
  } else {
    const ins = d.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`
    )
    ins.run('vat_enabled', 'false')
    ins.run('vat_default_percent', '14')
    ins.run('theme', 'light')
    ins.run('auto_backup_enabled', 'false')
    ins.run('auto_backup_dir', '')
    ins.run('logo_path', '')
    ins.run('pin_enabled', 'false')
    ins.run('pin_hash', '')
    ins.run('privacy_mode', 'false')
    ins.run('onboarding_done', 'true') // existing users skip onboarding
  }
}
