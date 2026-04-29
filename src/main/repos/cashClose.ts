import { getDb } from '../db'
import type { CashClose, CashCloseToday } from '@shared/types'

export const CashCloseRepo = {
  todayInfo(date: string): CashCloseToday {
    const db = getDb()
    // Cash-in: every cash payment whose date = today, regardless of when
    // the underlying sale was made. A sale created on Jan 1 with 30 paid
    // up front and 70 paid on Jan 5 now correctly contributes 30 to Jan
    // 1's cash close and 70 to Jan 5's cash close — instead of the old
    // bug where the Jan 5 payment was silently dropped.
    const cashRow = db
      .prepare(
        `SELECT COALESCE(SUM(p.amount), 0) AS s
         FROM payments p
         JOIN transactions t ON t.id = p.transaction_id
         WHERE t.deleted_at IS NULL
           AND p.date = ?
           AND COALESCE(p.payment_method, t.payment_method, '') = 'نقدي'`
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
    // Default opening_float = the most recent prior close's actual_cash.
    // The studio leaves change in the drawer overnight; without this
    // carry-over, that leftover cash would show as a daily "زيادة"
    // discrepancy. If the user already saved today's close, prefer the
    // value they set there instead of recalculating.
    let openingFloat = 0
    if (closed) {
      openingFloat = Number(closed.opening_float ?? 0)
    } else {
      const prev = db
        .prepare(
          'SELECT actual_cash FROM cash_closes WHERE date < ? ORDER BY date DESC LIMIT 1'
        )
        .get(date) as { actual_cash: number } | undefined
      openingFloat = prev ? Number(prev.actual_cash) : 0
    }
    const expected =
      openingFloat + Number(cashRow.s) - Number(wdRow.s) - Number(rentRow.s) - Number(invRow.s)
    return {
      date,
      opening_float: Number(openingFloat.toFixed(2)),
      expected_cash: Number(expected.toFixed(2)),
      cash_in: Number(cashRow.s),
      cash_out: Number(wdRow.s) + Number(rentRow.s) + Number(invRow.s),
      rent_paid: Number(rentRow.s),
      inventory_paid: Number(invRow.s),
      closed: closed ?? null
    }
  },

  submit(input: {
    date: string
    actual_cash: number
    opening_float?: number
    note: string | null
  }): CashClose {
    const db = getDb()
    const info = CashCloseRepo.todayInfo(input.date)
    // Caller can override the carried-forward float (e.g., owner took
    // some change home overnight). Falls back to the suggested default.
    const opening =
      input.opening_float != null
        ? Number(input.opening_float)
        : info.opening_float
    const cashIn = info.cash_in
    const cashOut = info.cash_out
    const expected = Number((opening + cashIn - cashOut).toFixed(2))
    const diff = Number((Number(input.actual_cash) - expected).toFixed(2))
    db.prepare(
      `INSERT INTO cash_closes (date, opening_float, expected_cash, actual_cash, difference, note)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         opening_float = excluded.opening_float,
         expected_cash = excluded.expected_cash,
         actual_cash = excluded.actual_cash,
         difference = excluded.difference,
         note = excluded.note`
    ).run(input.date, opening, expected, Number(input.actual_cash), diff, input.note || null)
    return db.prepare('SELECT * FROM cash_closes WHERE date = ?').get(input.date) as CashClose
  },

  list(): CashClose[] {
    return getDb()
      .prepare('SELECT * FROM cash_closes ORDER BY date DESC LIMIT 90')
      .all() as CashClose[]
  }
}
