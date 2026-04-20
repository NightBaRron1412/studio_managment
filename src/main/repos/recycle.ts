import { getDb } from '../db'
import type { DeletedItem, ID } from '@shared/types'

const TABLES = {
  transaction: { table: 'transactions', label: (r: any) => `${r.transaction_no}`, sub: (r: any) => `${r.date} • ${Number(r.total).toFixed(2)}` },
  client: { table: 'clients', label: (r: any) => r.name as string, sub: (r: any) => r.phone || '' },
  withdrawal: { table: 'withdrawals', label: (r: any) => `سحب ${Number(r.amount).toFixed(2)}`, sub: (r: any) => `${r.date} ${r.reason ? '• ' + r.reason : ''}` },
  rent: { table: 'rent_payments', label: (r: any) => `إيجار ${Number(r.amount).toFixed(2)}`, sub: (r: any) => `${r.payment_date}` },
  inventory: { table: 'inventory_purchases', label: (r: any) => r.item_name as string, sub: (r: any) => `${r.date} • ${Number(r.cost).toFixed(2)}` }
} as const

type Kind = keyof typeof TABLES

export const RecycleRepo = {
  list(): DeletedItem[] {
    const db = getDb()
    const out: DeletedItem[] = []
    for (const kind of Object.keys(TABLES) as Kind[]) {
      const cfg = TABLES[kind]
      const rows = db
        .prepare(`SELECT * FROM ${cfg.table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`)
        .all() as any[]
      for (const r of rows) {
        out.push({
          kind,
          id: r.id,
          label: cfg.label(r),
          sub: cfg.sub(r),
          deleted_at: r.deleted_at
        })
      }
    }
    return out.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1))
  },

  restore(kind: Kind, id: ID): void {
    const cfg = TABLES[kind]
    const db = getDb()
    db.transaction(() => {
      // Re-decrement stock when restoring a previously-deleted transaction —
      // delete restored stock in the first place, so restore must put it back.
      if (kind === 'transaction') {
        const lines = db
          .prepare(
            `SELECT ti.item_id, ti.quantity FROM transaction_items ti WHERE ti.transaction_id = ?`
          )
          .all(id) as Array<{ item_id: ID | null; quantity: number }>
        const upd = db.prepare(
          `UPDATE items SET stock_qty = stock_qty - ?
           WHERE id = ? AND tracks_stock = 1`
        )
        for (const l of lines) {
          if (l.item_id != null) upd.run(Number(l.quantity), l.item_id)
        }
      }
      db.prepare(`UPDATE ${cfg.table} SET deleted_at = NULL WHERE id = ?`).run(id)
    })()
  },

  purge(kind: Kind, id: ID): void {
    const cfg = TABLES[kind]
    getDb().prepare(`DELETE FROM ${cfg.table} WHERE id = ?`).run(id)
  },

  empty(): void {
    const db = getDb()
    for (const kind of Object.keys(TABLES) as Kind[]) {
      db.prepare(`DELETE FROM ${TABLES[kind].table} WHERE deleted_at IS NOT NULL`).run()
    }
  }
}
