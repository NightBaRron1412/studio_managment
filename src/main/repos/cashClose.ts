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
  },

  // Past dates (last 30 days, excluding today) that had any cash activity
  // but no closing record. Surfaced on the dashboard + startup toast so
  // owners who forgot to close last night can backfill it. Today is
  // intentionally excluded — it's expected to be open while the day is
  // in progress; only previous days that should already be closed count
  // as "missed". A day with zero activity isn't surfaced either —
  // there's nothing to count.
  missedCloses(): Array<{
    date: string
    cash_in: number
    cash_out: number
    suggested_actual: number
  }> {
    const db = getDb()
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
    const horizonStr = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, '0')}-${String(horizon.getDate()).padStart(2, '0')}`
    // Build the union of all dates with any cash activity in window,
    // then filter to those without a corresponding cash_closes row.
    const rows = db
      .prepare(
        `WITH activity_dates AS (
           SELECT DISTINCT p.date AS d
           FROM payments p
           JOIN transactions t ON t.id = p.transaction_id
           WHERE t.deleted_at IS NULL
             AND COALESCE(p.payment_method, t.payment_method, '') = 'نقدي'
             AND p.date >= ? AND p.date < ?
           UNION
           SELECT DISTINCT date AS d FROM withdrawals
             WHERE deleted_at IS NULL AND date >= ? AND date < ?
           UNION
           SELECT DISTINCT payment_date AS d FROM rent_payments
             WHERE deleted_at IS NULL AND payment_date >= ? AND payment_date < ?
           UNION
           SELECT DISTINCT date AS d FROM inventory_purchases
             WHERE deleted_at IS NULL AND date >= ? AND date < ?
         )
         SELECT d AS date FROM activity_dates
         WHERE d NOT IN (SELECT date FROM cash_closes)
         ORDER BY d DESC
         LIMIT 30`
      )
      .all(
        horizonStr, today,
        horizonStr, today,
        horizonStr, today,
        horizonStr, today
      ) as Array<{ date: string }>
    // For each missed date, pull the actual cash_in / cash_out so the
    // dashboard card can show "30 in, 5 out" without the user clicking in.
    return rows.map((r) => {
      const info = CashCloseRepo.todayInfo(r.date)
      return {
        date: r.date,
        cash_in: info.cash_in,
        cash_out: info.cash_out,
        suggested_actual: info.expected_cash
      }
    })
  }
}
