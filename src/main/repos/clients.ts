import { getDb } from '../db'
import type { Client, ClientWithStats, ID } from '@shared/types'

export const ClientsRepo = {
  list(q?: string): ClientWithStats[] {
    const db = getDb()
    const search = q && q.trim() ? `%${q.trim()}%` : null
    const sql = `
      SELECT c.*,
        COALESCE(SUM(CASE WHEN t.deleted_at IS NULL THEN t.total ELSE 0 END), 0) as total_spent,
        COUNT(CASE WHEN t.deleted_at IS NULL THEN t.id END) as visit_count,
        MAX(CASE WHEN t.deleted_at IS NULL THEN t.date END) as last_visit,
        COALESCE(SUM(CASE WHEN t.deleted_at IS NULL THEN (t.total - t.paid_amount) ELSE 0 END), 0) as outstanding
      FROM clients c
      LEFT JOIN transactions t ON t.client_id = c.id
      WHERE c.deleted_at IS NULL
      ${search ? 'AND (c.name LIKE ? OR c.phone LIKE ?)' : ''}
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE ASC
    `
    const stmt = db.prepare(sql)
    const rows = (search ? stmt.all(search, search) : stmt.all()) as ClientWithStats[]
    return rows
  },

  get(id: ID): Client | null {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL')
      .get(id) as Client | undefined
    return row ?? null
  },

  create(input: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Client {
    const db = getDb()
    const stmt = db.prepare(
      'INSERT INTO clients (name, phone, address, notes) VALUES (?, ?, ?, ?)'
    )
    const info = stmt.run(input.name.trim(), input.phone || null, input.address || null, input.notes || null)
    return ClientsRepo.get(info.lastInsertRowid as number)!
  },

  update(id: ID, input: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Client {
    const db = getDb()
    const cur = ClientsRepo.get(id)
    if (!cur) throw new Error('العميل غير موجود')
    const merged = { ...cur, ...input }
    db.prepare(
      `UPDATE clients SET name = ?, phone = ?, address = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(merged.name.trim(), merged.phone || null, merged.address || null, merged.notes || null, id)
    return ClientsRepo.get(id)!
  },

  delete(id: ID): void {
    getDb().prepare(`UPDATE clients SET deleted_at = datetime('now') WHERE id = ?`).run(id)
  }
}
