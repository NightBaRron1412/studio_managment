// Regression tests — pin the bugs we fixed in 1.1.5 / 1.1.6 / 1.2.0 /
// 1.2.1 so they can never silently come back. Each describe-block
// references the release that fixed it.
import { describe, expect, beforeEach, it } from 'vitest'
import { freshDb } from '../../../tests/helpers'
import { getDb, closeDb, initDb } from '../db'
import { TransactionsRepo } from '../repos/transactions'

function makeAjelSale(date = '2026-04-27'): number {
  const tx = TransactionsRepo.create({
    date,
    client_id: null,
    staff_name: 'موظف',
    notes: null,
    payment_method: 'نقدي',
    discount_type: null,
    discount_value: 0,
    vat_percent: 0,
    paid_amount: 0, // آجل
    pickup_status: null,
    pickup_promised_date: null,
    lines: [
      { item_id: null, custom_name: 'صنف', quantity: 1, unit_price: 100, note: null }
    ]
  })
  return tx.id
}

describe('1.1.5 / 1.1.6 — backfill never re-fires on آجل sales', () => {
  beforeEach(() => freshDb())

  it('an آجل sale stays paid_amount=0 across app restarts', () => {
    makeAjelSale()
    // Simulate two more app launches by closing and re-initing on the
    // same path — except in-memory DBs vanish on close, so use a tmp file
    // that survives the close/reopen cycle.
    closeDb()
    const tmp = `/tmp/studio-regression-${Date.now()}.db`
    initDb(tmp)
    makeAjelSale('2026-04-27')
    closeDb()
    initDb(tmp)
    const all = getDb()
      .prepare('SELECT paid_amount, total FROM transactions WHERE deleted_at IS NULL')
      .all() as { paid_amount: number; total: number }[]
    expect(all.length).toBeGreaterThan(0)
    for (const row of all) {
      // Pre-1.1.5 the on-every-launch backfill turned every paid=0 row
      // into paid=total. The fix ran the backfill at most once per db.
      expect(row.paid_amount).toBe(0)
    }
  })

  it('backfill flag is set exactly once per db', () => {
    closeDb()
    const tmp = `/tmp/studio-flag-${Date.now()}.db`
    initDb(tmp)
    initDb(tmp) // closeDb is implicit when initDb reassigns; safe to re-init
    const flag = getDb()
      .prepare(
        `SELECT value FROM settings WHERE key = 'paid_subtotal_backfill_done'`
      )
      .get() as { value: string } | undefined
    // The fix sets the flag unconditionally on first encounter so
    // subsequent boots can't re-evaluate the heuristic.
    expect(flag?.value).toBe('1')
  })
})

describe('1.2.0 — payments are dated per payment, not per transaction', () => {
  beforeEach(() => freshDb())

  it('the initial payment row matches the sale date, not "today"', () => {
    const tx = TransactionsRepo.create({
      date: '2025-12-31',
      client_id: null,
      staff_name: 'موظف',
      notes: null,
      payment_method: 'نقدي',
      discount_type: null,
      discount_value: 0,
      vat_percent: 0,
      paid_amount: 50,
      pickup_status: null,
      pickup_promised_date: null,
      lines: [{ item_id: null, custom_name: 'صنف', quantity: 1, unit_price: 100, note: null }]
    })
    expect(tx.payments[0].date).toBe('2025-12-31')
  })

  it('markPaid uses local-timezone today (no UTC drift)', () => {
    const tx = TransactionsRepo.create({
      date: '2026-01-01',
      client_id: null,
      staff_name: 'موظف',
      notes: null,
      payment_method: 'نقدي',
      discount_type: null,
      discount_value: 0,
      vat_percent: 0,
      paid_amount: 30,
      pickup_status: null,
      pickup_promised_date: null,
      lines: [{ item_id: null, custom_name: 'صنف', quantity: 1, unit_price: 100, note: null }]
    })
    const after = TransactionsRepo.markPaid(tx.id, 70)
    const newPayment = after.payments[after.payments.length - 1]
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(newPayment.date).toBe(today)
  })
})

describe('1.2.0 — editing preserves later payments and floors at received-so-far', () => {
  beforeEach(() => freshDb())

  it('user cannot retroactively undo a payment via edit', () => {
    const tx = TransactionsRepo.create({
      date: '2026-04-01',
      client_id: null,
      staff_name: 'موظف',
      notes: null,
      payment_method: 'نقدي',
      discount_type: null,
      discount_value: 0,
      vat_percent: 0,
      paid_amount: 30,
      pickup_status: null,
      pickup_promised_date: null,
      lines: [{ item_id: null, custom_name: 'صنف', quantity: 1, unit_price: 100, note: null }]
    })
    TransactionsRepo.markPaid(tx.id, 50)
    const updated = TransactionsRepo.update(tx.id, {
      date: '2026-04-01',
      client_id: null,
      staff_name: 'موظف',
      notes: null,
      payment_method: 'نقدي',
      discount_type: null,
      discount_value: 0,
      vat_percent: 0,
      paid_amount: 0, // attempt to wipe payment
      pickup_status: null,
      pickup_promised_date: null,
      lines: [{ item_id: null, custom_name: 'صنف', quantity: 1, unit_price: 100, note: null }]
    })
    // Floored at the 50 already received via markPaid; the markPaid row
    // is preserved, the initial-payment row is removed because the
    // remainder (0) doesn't need it.
    expect(updated.paid_amount).toBe(50)
    expect(updated.payments.some((p) => p.amount === 50)).toBe(true)
  })
})
