import { getDb } from '../db'
import type { ID, InventoryPurchase } from '@shared/types'

export const InventoryRepo = {
  list(filter?: { date_from?: string; date_to?: string }): InventoryPurchase[] {
    const where: string[] = ['deleted_at IS NULL']
    const params: string[] = []
    if (filter?.date_from) {
      where.push('date >= ?')
      params.push(filter.date_from)
    }
    if (filter?.date_to) {
      where.push('date <= ?')
      params.push(filter.date_to)
    }
    const sql = `SELECT * FROM inventory_purchases WHERE ${where.join(' AND ')} ORDER BY date DESC, id DESC`
    return getDb().prepare(sql).all(...params) as InventoryPurchase[]
  },
  create(input: Omit<InventoryPurchase, 'id' | 'created_at' | 'deleted_at'>): InventoryPurchase {
    const db = getDb()
    const info = db
      .prepare(
        'INSERT INTO inventory_purchases (date, item_name, quantity, cost, supplier, note) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.date,
        input.item_name.trim(),
        Number(input.quantity),
        Number(input.cost),
        input.supplier || null,
        input.note || null
      )
    return db
      .prepare('SELECT * FROM inventory_purchases WHERE id = ?')
      .get(info.lastInsertRowid) as InventoryPurchase
  },
  update(id: ID, input: Partial<Omit<InventoryPurchase, 'id' | 'created_at' | 'deleted_at'>>): InventoryPurchase {
    const db = getDb()
    const cur = db.prepare('SELECT * FROM inventory_purchases WHERE id = ?').get(id) as
      | InventoryPurchase
      | undefined
    if (!cur) throw new Error('السجل غير موجود')
    const m = { ...cur, ...input }
    db.prepare(
      'UPDATE inventory_purchases SET date = ?, item_name = ?, quantity = ?, cost = ?, supplier = ?, note = ? WHERE id = ?'
    ).run(
      m.date,
      m.item_name.trim(),
      Number(m.quantity),
      Number(m.cost),
      m.supplier || null,
      m.note || null,
      id
    )
    return db.prepare('SELECT * FROM inventory_purchases WHERE id = ?').get(id) as InventoryPurchase
  },
  delete(id: ID): void {
    getDb().prepare(`UPDATE inventory_purchases SET deleted_at = datetime('now') WHERE id = ?`).run(id)
  }
}
