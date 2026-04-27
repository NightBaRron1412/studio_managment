// Cash-close pulls from the payments ledger by payment.date — these tests
// pin the multi-day-cash-flow behaviour that 1.2.0 introduced (payment on
// day B credits day B's تقفيلة, not day A's).
import { describe, expect, beforeEach, it } from 'vitest'
import { freshDb } from '../../../tests/helpers'
import { TransactionsRepo } from '../repos/transactions'
import { CashCloseRepo } from '../repos/cashClose'
import { getDb } from '../db'

function makeSale(date: string, paid: number, method: string | null = 'نقدي'): number {
  const tx = TransactionsRepo.create({
    date,
    client_id: null,
    staff_name: 'موظف',
    notes: null,
    payment_method: method,
    discount_type: null,
    discount_value: 0,
    vat_percent: 0,
    paid_amount: paid,
    pickup_status: null,
    pickup_promised_date: null,
    lines: [
      { item_id: null, custom_name: 'صنف', quantity: 1, unit_price: 100, note: null }
    ]
  })
  return tx.id
}

describe('CashCloseRepo.todayInfo', () => {
  beforeEach(() => freshDb())

  it('a fully cash-paid sale credits its own date', () => {
    makeSale('2026-04-27', 100)
    const info = CashCloseRepo.todayInfo('2026-04-27')
    expect(info.cash_in).toBe(100)
  })

  it('multi-day cash flow: partial today + remainder later credits each day separately', () => {
    const id = makeSale('2026-04-01', 30) // initial payment dated 2026-04-01
    // Simulate the user clicking "تسجيل دفعة" four days later. markPaid
    // uses local "today" for its date — we insert directly with a fixed
    // date instead so the assertion is deterministic across machines.
    // The payments-ledger contract under test is the same either way:
    // cash-close reads payment.date, not transaction.date.
    getDb()
      .prepare(
        `INSERT INTO payments (transaction_id, date, amount, payment_method) VALUES (?, ?, ?, ?)`
      )
      .run(id, '2026-04-05', 70, 'نقدي')

    expect(CashCloseRepo.todayInfo('2026-04-01').cash_in).toBe(30)
    expect(CashCloseRepo.todayInfo('2026-04-05').cash_in).toBe(70)
    // A day in between sees neither.
    expect(CashCloseRepo.todayInfo('2026-04-03').cash_in).toBe(0)
  })

  it('non-cash payment methods are excluded from cash_in', () => {
    makeSale('2026-04-27', 100, 'تحويل بنكي')
    const info = CashCloseRepo.todayInfo('2026-04-27')
    expect(info.cash_in).toBe(0)
  })

  it('soft-deleted transactions are excluded', () => {
    const id = makeSale('2026-04-27', 100)
    TransactionsRepo.delete(id)
    const info = CashCloseRepo.todayInfo('2026-04-27')
    expect(info.cash_in).toBe(0)
  })
})
