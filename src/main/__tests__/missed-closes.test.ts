// missedCloses() surfaces past days with cash activity that owners
// forgot to close. Today is intentionally excluded (it's expected to
// be open while the day is in progress); already-closed days don't
// surface; days with zero activity don't surface.
import { describe, expect, beforeEach, it } from 'vitest'
import { freshDb } from '../../../tests/helpers'
import { CashCloseRepo } from '../repos/cashClose'
import { TransactionsRepo } from '../repos/transactions'
import { getDb } from '../db'

function localToday(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeCashSale(date: string, amount = 100): number {
  const tx = TransactionsRepo.create({
    date,
    client_id: null,
    staff_name: 'موظف',
    notes: null,
    payment_method: 'نقدي',
    discount_type: null,
    discount_value: 0,
    vat_percent: 0,
    paid_amount: amount,
    pickup_status: null,
    pickup_promised_date: null,
    lines: [{ item_id: null, custom_name: 'صنف', quantity: 1, unit_price: amount, note: null }]
  })
  return tx.id
}

describe('CashCloseRepo.missedCloses', () => {
  beforeEach(() => freshDb())

  it('returns empty when there is no cash activity in the last 30 days', () => {
    expect(CashCloseRepo.missedCloses()).toEqual([])
  })

  it('today is excluded — only past days count as "missed"', () => {
    makeCashSale(localToday(), 100)
    const missed = CashCloseRepo.missedCloses()
    expect(missed.find((m) => m.date === localToday())).toBeUndefined()
  })

  it('a closed past day does not show up', () => {
    const yesterday = daysAgo(1)
    makeCashSale(yesterday, 50)
    CashCloseRepo.submit({
      date: yesterday,
      actual_cash: 50,
      opening_float: 0,
      note: null
    })
    const missed = CashCloseRepo.missedCloses()
    expect(missed.find((m) => m.date === yesterday)).toBeUndefined()
  })

  it('an unclosed past day with cash activity shows up with cash_in / cash_out / suggested', () => {
    const d = daysAgo(2)
    makeCashSale(d, 80)
    // Add a withdrawal that day too so cash_out > 0.
    getDb()
      .prepare(
        `INSERT INTO withdrawals (date, amount, withdrawn_by, reason) VALUES (?, ?, ?, ?)`
      )
      .run(d, 30, 'صاحب', 'مصروف')

    const missed = CashCloseRepo.missedCloses()
    const entry = missed.find((m) => m.date === d)
    expect(entry).toBeDefined()
    expect(entry?.cash_in).toBe(80)
    expect(entry?.cash_out).toBe(30)
    // suggested = opening (0, no prior close) + 80 − 30 = 50.
    expect(entry?.suggested_actual).toBe(50)
  })

  it('orders most-recent first', () => {
    makeCashSale(daysAgo(5), 50)
    makeCashSale(daysAgo(2), 50)
    makeCashSale(daysAgo(7), 50)
    const dates = CashCloseRepo.missedCloses().map((m) => m.date)
    expect(dates).toEqual([daysAgo(2), daysAgo(5), daysAgo(7)])
  })

  it('ignores days with only non-cash payments', () => {
    const d = daysAgo(3)
    TransactionsRepo.create({
      date: d,
      client_id: null,
      staff_name: 'موظف',
      notes: null,
      payment_method: 'تحويل بنكي',
      discount_type: null,
      discount_value: 0,
      vat_percent: 0,
      paid_amount: 100,
      pickup_status: null,
      pickup_promised_date: null,
      lines: [{ item_id: null, custom_name: 'صنف', quantity: 1, unit_price: 100, note: null }]
    })
    // No cash_in / cash_out — nothing to close.
    expect(CashCloseRepo.missedCloses().find((m) => m.date === d)).toBeUndefined()
  })
})
