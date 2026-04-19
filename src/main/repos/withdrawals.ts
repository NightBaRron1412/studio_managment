import { getDb } from '../db'
import type { ID, Withdrawal } from '@shared/types'

export const WithdrawalsRepo = {
  list(filter?: { date_from?: string; date_to?: string }): Withdrawal[] {
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
    const sql = `SELECT * FROM withdrawals WHERE ${where.join(' AND ')} ORDER BY date DESC, id DESC`
    return getDb().prepare(sql).all(...params) as Withdrawal[]
  },
  create(input: Omit<Withdrawal, 'id' | 'created_at' | 'deleted_at'>): Withdrawal {
    const db = getDb()
    const info = db
      .prepare('INSERT INTO withdrawals (date, amount, withdrawn_by, reason) VALUES (?, ?, ?, ?)')
      .run(input.date, Number(input.amount), input.withdrawn_by || null, input.reason || null)
    return db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(info.lastInsertRowid) as Withdrawal
  },
  update(id: ID, input: Partial<Omit<Withdrawal, 'id' | 'created_at' | 'deleted_at'>>): Withdrawal {
    const db = getDb()
    const cur = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id) as Withdrawal | undefined
    if (!cur) throw new Error('السحب غير موجود')
    const m = { ...cur, ...input }
    db.prepare('UPDATE withdrawals SET date = ?, amount = ?, withdrawn_by = ?, reason = ? WHERE id = ?').run(
      m.date,
      Number(m.amount),
      m.withdrawn_by || null,
      m.reason || null,
      id
    )
    return db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id) as Withdrawal
  },
  delete(id: ID): void {
    getDb().prepare(`UPDATE withdrawals SET deleted_at = datetime('now') WHERE id = ?`).run(id)
  }
}
