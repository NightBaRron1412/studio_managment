import { getDb } from '../db'
import type { ID, RentPayment } from '@shared/types'
import { SettingsRepo } from './settings'

export const RentRepo = {
  forMonth(year: number, month: number): {
    required: number
    paid: number
    remaining: number
    payments: RentPayment[]
  } {
    const db = getDb()
    const required = Number(SettingsRepo.get('default_rent') ?? '0') || 0
    const payments = db
      .prepare(
        `SELECT * FROM rent_payments
         WHERE period_year = ? AND period_month = ? AND deleted_at IS NULL
         ORDER BY payment_date ASC, id ASC`
      )
      .all(year, month) as RentPayment[]
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0)
    return { required, paid, remaining: Math.max(0, required - paid), payments }
  },
  create(input: Omit<RentPayment, 'id' | 'created_at' | 'deleted_at'>): RentPayment {
    const db = getDb()
    const info = db
      .prepare(
        'INSERT INTO rent_payments (payment_date, period_year, period_month, amount, note) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.payment_date, input.period_year, input.period_month, Number(input.amount), input.note || null)
    return db.prepare('SELECT * FROM rent_payments WHERE id = ?').get(info.lastInsertRowid) as RentPayment
  },
  delete(id: ID): void {
    getDb().prepare(`UPDATE rent_payments SET deleted_at = datetime('now') WHERE id = ?`).run(id)
  }
}
