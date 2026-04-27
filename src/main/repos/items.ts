import { getDb } from '../db'
import type { Item, ID, LowStockItem } from '@shared/types'

export const ItemsRepo = {
  list(opts?: { only_active?: boolean; category_id?: ID }): Item[] {
    const db = getDb()
    const where: string[] = []
    const params: (number | string)[] = []
    if (opts?.only_active) where.push('i.is_active = 1')
    if (opts?.category_id) {
      where.push('i.category_id = ?')
      params.push(opts.category_id)
    }
    const sql = `
      SELECT i.*, c.name_ar AS category_name
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY c.sort_order ASC, i.name_ar ASC
    `
    return db.prepare(sql).all(...params) as Item[]
  },
  create(input: Omit<Item, 'id' | 'created_at'>): Item {
    const db = getDb()
    const info = db
      .prepare(
        `INSERT INTO items (category_id, name_ar, size, default_price, is_active, notes,
                            tracks_stock, stock_qty, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.category_id ?? null,
        input.name_ar.trim(),
        input.size || null,
        Number(input.default_price) || 0,
        input.is_active ?? 1,
        input.notes || null,
        input.tracks_stock ?? 0,
        Number(input.stock_qty) || 0,
        Number(input.low_stock_threshold) || 0
      )
    const id = info.lastInsertRowid as number
    return ItemsRepo.list().find((it) => it.id === id) || (db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item)
  },
  update(id: ID, input: Partial<Omit<Item, 'id' | 'created_at'>>): Item {
    const db = getDb()
    const cur = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item | undefined
    if (!cur) throw new Error('الصنف غير موجود')
    const merged = { ...cur, ...input }
    db.prepare(
      `UPDATE items SET category_id = ?, name_ar = ?, size = ?, default_price = ?, is_active = ?, notes = ?,
                        tracks_stock = ?, stock_qty = ?, low_stock_threshold = ?
       WHERE id = ?`
    ).run(
      merged.category_id ?? null,
      merged.name_ar.trim(),
      merged.size || null,
      Number(merged.default_price) || 0,
      merged.is_active ?? 1,
      merged.notes || null,
      merged.tracks_stock ?? 0,
      Number(merged.stock_qty) || 0,
      Number(merged.low_stock_threshold) || 0,
      id
    )
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item
  },
  delete(id: ID): void {
    getDb().prepare('DELETE FROM items WHERE id = ?').run(id)
  },
  // Items at or below their low-stock threshold (and tracking stock).
  // is_out flag distinguishes "completely out" from "low".
  lowStock(): LowStockItem[] {
    return getDb()
      .prepare(
        `SELECT i.id, i.name_ar, i.size, c.name_ar AS category_name,
                i.stock_qty, i.low_stock_threshold,
                CASE WHEN i.stock_qty <= 0 THEN 1 ELSE 0 END AS is_out
         FROM items i
         LEFT JOIN categories c ON c.id = i.category_id
         WHERE i.is_active = 1 AND i.tracks_stock = 1
           AND i.stock_qty <= i.low_stock_threshold
         ORDER BY is_out DESC, i.stock_qty ASC, i.name_ar ASC`
      )
      .all()
      .map((r: unknown) => {
        const row = r as Record<string, unknown>
        return { ...row, is_out: row.is_out === 1 } as LowStockItem
      })
  },
  // Bump stock and (optionally) record a purchase row linked to the item.
  restock(input: {
    item_id: ID
    quantity: number
    cost?: number
    supplier?: string | null
    note?: string | null
    date?: string
  }): { item: Item; purchase_id: ID } {
    const db = getDb()
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(input.item_id) as Item | undefined
    if (!item) throw new Error('الصنف غير موجود')
    const qty = Number(input.quantity) || 0
    if (qty <= 0) throw new Error('الكمية يجب أن تكون أكبر من 0')
    const date = input.date || new Date().toISOString().slice(0, 10)
    const cost = Number(input.cost) || 0
    let purchaseId = 0
    const txFn = db.transaction(() => {
      db.prepare('UPDATE items SET stock_qty = stock_qty + ? WHERE id = ?').run(qty, input.item_id)
      const info = db
        .prepare(
          `INSERT INTO inventory_purchases (date, item_name, quantity, cost, supplier, note, item_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(date, item.name_ar, qty, cost, input.supplier || null, input.note || null, input.item_id)
      purchaseId = info.lastInsertRowid as number
    })
    txFn()
    const updatedItem = db.prepare('SELECT * FROM items WHERE id = ?').get(input.item_id) as Item
    return { item: updatedItem, purchase_id: purchaseId }
  },

  // Reverse a restock — subtracts the purchase quantity from item.stock_qty
  // and hard-deletes the inventory_purchases row. Used by Ctrl+Z undo when
  // the last action was «+ تزويد». Stock is allowed to go negative (matches
  // the negative-stock-allowed policy elsewhere).
  unrestock(purchaseId: ID): void {
    const db = getDb()
    const row = db
      .prepare('SELECT item_id, quantity FROM inventory_purchases WHERE id = ?')
      .get(purchaseId) as { item_id: ID | null; quantity: number } | undefined
    if (!row) return
    db.transaction(() => {
      if (row.item_id != null) {
        db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE id = ?').run(
          row.quantity,
          row.item_id
        )
      }
      db.prepare('DELETE FROM inventory_purchases WHERE id = ?').run(purchaseId)
    })()
  },
  suggestedForClient(clientId: ID): Array<{ item_id: ID; name: string; default_price: number; count: number }> {
    return getDb()
      .prepare(
        `SELECT i.id AS item_id, i.name_ar AS name, i.default_price AS default_price, COUNT(*) AS count
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         JOIN items i ON i.id = ti.item_id
         WHERE t.client_id = ? AND t.deleted_at IS NULL AND i.is_active = 1
         GROUP BY i.id
         ORDER BY count DESC, MAX(t.date) DESC
         LIMIT 6`
      )
      .all(clientId) as Array<{ item_id: ID; name: string; default_price: number; count: number }>
  }
}
