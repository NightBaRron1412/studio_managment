import { getDb } from '../db'
import type { Item, ID } from '@shared/types'

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
        `INSERT INTO items (category_id, name_ar, size, default_price, is_active, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.category_id ?? null,
        input.name_ar.trim(),
        input.size || null,
        Number(input.default_price) || 0,
        input.is_active ?? 1,
        input.notes || null
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
      `UPDATE items SET category_id = ?, name_ar = ?, size = ?, default_price = ?, is_active = ?, notes = ? WHERE id = ?`
    ).run(
      merged.category_id ?? null,
      merged.name_ar.trim(),
      merged.size || null,
      Number(merged.default_price) || 0,
      merged.is_active ?? 1,
      merged.notes || null,
      id
    )
    return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item
  },
  delete(id: ID): void {
    getDb().prepare('DELETE FROM items WHERE id = ?').run(id)
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
