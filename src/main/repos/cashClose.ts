import { getDb } from '../db'
import type { CashClose, CashCloseToday } from '@shared/types'

export const CashCloseRepo = {
  todayInfo(date: string): CashCloseToday {
    const db = getDb()
    // Cash-in: payments received today on cash transactions, plus any cash payments
    // marked. We approximate with: paid_amount on transactions whose payment_method = 'نقدي'
    // and date = today. Plus any other cash adjustments NOT modeled — keep simple.
    const cashRow = db
      .prepare(
        `SELECT COALESCE(SUM(paid_amount), 0) AS s
         FROM transactions
         WHERE deleted_at IS NULL AND date = ? AND COALESCE(payment_method, '') = 'نقدي'`
      )
      .get(date) as { s: number }
    const wdRow = db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM withdrawals WHERE deleted_at IS NULL AND date = ?')
      .get(date) as { s: number }
    const rentRow = db
      .prepare(
        'SELECT COALESCE(SUM(amount), 0) AS s FROM rent_payments WHERE deleted_at IS NULL AND payment_date = ?'
      )
      .get(date) as { s: number }
    const invRow = db
      .prepare(
        'SELECT COALESCE(SUM(cost), 0) AS s FROM inventory_purchases WHERE deleted_at IS NULL AND date = ?'
      )
      .get(date) as { s: number }
    const closed = db
      .prepare('SELECT * FROM cash_closes WHERE date = ?')
      .get(date) as CashClose | undefined
    const expected = Number(cashRow.s) - Number(wdRow.s) - Number(rentRow.s) - Number(invRow.s)
    return {
      date,
      expected_cash: Number(expected.toFixed(2)),
      cash_in: Number(cashRow.s),
      cash_out: Number(wdRow.s) + Number(rentRow.s) + Number(invRow.s),
      rent_paid: Number(rentRow.s),
      inventory_paid: Number(invRow.s),
      closed: closed ?? null
    }
  },

  submit(input: { date: string; actual_cash: number; note: string | null }): CashClose {
    const db = getDb()
    const info = CashCloseRepo.todayInfo(input.date)
    const diff = Number((Number(input.actual_cash) - info.expected_cash).toFixed(2))
    db.prepare(
      `INSERT INTO cash_closes (date, expected_cash, actual_cash, difference, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         expected_cash = excluded.expected_cash,
         actual_cash = excluded.actual_cash,
         difference = excluded.difference,
         note = excluded.note`
    ).run(input.date, info.expected_cash, Number(input.actual_cash), diff, input.note || null)
    return db.prepare('SELECT * FROM cash_closes WHERE date = ?').get(input.date) as CashClose
  },

  list(): CashClose[] {
    return getDb()
      .prepare('SELECT * FROM cash_closes ORDER BY date DESC LIMIT 90')
      .all() as CashClose[]
  }
}
