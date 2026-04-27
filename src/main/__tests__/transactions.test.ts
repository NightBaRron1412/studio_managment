// Critical-path tests for the transactions repo. Every test runs against
// a fresh in-memory database with the full migration + seed, so we exercise
// the same code paths as a real first-launch.
import { describe, expect, beforeEach, it } from 'vitest'
import { freshDb } from '../../../tests/helpers'
import { getDb } from '../db'
import { TransactionsRepo } from '../repos/transactions'
import { ItemsRepo } from '../repos/items'

// Helper: build a minimal valid TransactionInput. Tests pass overrides
// for whatever they care about and let the rest take sensible defaults.
function txInput(overrides: Partial<Parameters<typeof TransactionsRepo.create>[0]> = {}): Parameters<typeof TransactionsRepo.create>[0] {
  return {
    date: '2026-04-27',
    client_id: null,
    staff_name: 'موظف',
    notes: null,
    payment_method: 'نقدي',
    discount_type: null,
    discount_value: 0,
    vat_percent: 0,
    paid_amount: 100,
    pickup_status: null,
    pickup_promised_date: null,
    lines: [
      { item_id: null, custom_name: 'صنف اختبار', quantity: 1, unit_price: 100, note: null }
    ],
    ...overrides
  }
}

describe('TransactionsRepo.create', () => {
  beforeEach(() => freshDb())

  it('persists totals, paid_amount, and inserts an initial payment row dated to the sale', () => {
    const tx = TransactionsRepo.create(txInput({ date: '2026-04-01', paid_amount: 30 }))
    expect(tx.total).toBe(100)
    expect(tx.paid_amount).toBe(30)
    expect(tx.payments).toHaveLength(1)
    expect(tx.payments[0].date).toBe('2026-04-01')
    expect(tx.payments[0].amount).toBe(30)
  })

  it('skips the initial payment row when the sale is آجل (paid=0)', () => {
    const tx = TransactionsRepo.create(txInput({ paid_amount: 0 }))
    expect(tx.paid_amount).toBe(0)
    expect(tx.payments).toHaveLength(0)
    expect(tx.remaining).toBe(100)
  })

  it('decrements stock for items where tracks_stock = 1', () => {
    const item = ItemsRepo.create({
      category_id: null,
      category_name: null,
      name_ar: 'برواز ٤×٦',
      size: '4x6',
      default_price: 50,
      is_active: 1,
      notes: null,
      tracks_stock: 1,
      stock_qty: 10,
      low_stock_threshold: 2
    })
    TransactionsRepo.create(
      txInput({
        lines: [{ item_id: item.id, custom_name: null, quantity: 3, unit_price: 50, note: null }],
        paid_amount: 150
      })
    )
    const after = ItemsRepo.list().find((i) => i.id === item.id)
    expect(after?.stock_qty).toBe(7)
  })

  it('flags items that crossed into non-positive stock as a warning', () => {
    const item = ItemsRepo.create({
      category_id: null,
      category_name: null,
      name_ar: 'كرت',
      size: null,
      default_price: 1,
      is_active: 1,
      notes: null,
      tracks_stock: 1,
      stock_qty: 2,
      low_stock_threshold: 0
    })
    const tx = TransactionsRepo.create(
      txInput({
        lines: [{ item_id: item.id, custom_name: null, quantity: 5, unit_price: 1, note: null }],
        paid_amount: 5
      })
    )
    expect(tx.negative_stock_items).toBeDefined()
    expect(tx.negative_stock_items?.[0].name).toBe('كرت')
    expect(tx.negative_stock_items?.[0].stock).toBe(-3)
  })
})

describe('TransactionsRepo.markPaid', () => {
  beforeEach(() => freshDb())

  it('inserts a new payment row dated TODAY (local timezone) and bumps paid_amount', () => {
    const tx = TransactionsRepo.create(
      txInput({ date: '2026-01-01', paid_amount: 30 })
    )
    const after = TransactionsRepo.markPaid(tx.id, 70)
    expect(after.paid_amount).toBe(100)
    expect(after.payments).toHaveLength(2)
    const newPayment = after.payments[1]
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(newPayment.date).toBe(today)
    expect(newPayment.amount).toBe(70)
  })

  it('caps the payment at the remaining balance — never overpays', () => {
    const tx = TransactionsRepo.create(txInput({ paid_amount: 90 }))
    const after = TransactionsRepo.markPaid(tx.id, 50) // remaining is only 10
    expect(after.paid_amount).toBe(100)
    // The capped delta of 10 (not 50) is what should be in the payment row.
    expect(after.payments[after.payments.length - 1].amount).toBe(10)
  })

  it('is a no-op (no payment row) when the transaction is already fully paid', () => {
    const tx = TransactionsRepo.create(txInput({ paid_amount: 100 }))
    const before = tx.payments.length
    const after = TransactionsRepo.markPaid(tx.id, 50)
    expect(after.payments.length).toBe(before)
  })
})

describe('TransactionsRepo.update', () => {
  beforeEach(() => freshDb())

  it('preserves later "تسجيل دفعة" payments — the edit only reconciles the initial payment', () => {
    const tx = TransactionsRepo.create(
      txInput({ date: '2026-01-01', paid_amount: 30 })
    )
    TransactionsRepo.markPaid(tx.id, 40) // separate payment dated today
    const updated = TransactionsRepo.update(tx.id, txInput({ date: '2026-01-01', paid_amount: 80 }))
    // initial: 80 - 40 = 40 dated 2026-01-01; later 40 dated today preserved.
    expect(updated.paid_amount).toBe(80)
    expect(updated.payments).toHaveLength(2)
    const dates = updated.payments.map((p) => p.date)
    expect(dates).toContain('2026-01-01')
  })

  it('floors paid_amount at the sum of subsequent payments — you cannot retroactively undo a payment', () => {
    const tx = TransactionsRepo.create(txInput({ paid_amount: 30 }))
    TransactionsRepo.markPaid(tx.id, 50) // now 80 paid
    const updated = TransactionsRepo.update(tx.id, txInput({ paid_amount: 10 }))
    // 50 already received via markPaid; the edit can't drop below that.
    expect(updated.paid_amount).toBe(50)
  })

  it('rebalances stock on quantity change', () => {
    const item = ItemsRepo.create({
      category_id: null,
      category_name: null,
      name_ar: 'كرت',
      size: null,
      default_price: 10,
      is_active: 1,
      notes: null,
      tracks_stock: 1,
      stock_qty: 10,
      low_stock_threshold: 0
    })
    const tx = TransactionsRepo.create(
      txInput({
        lines: [{ item_id: item.id, custom_name: null, quantity: 3, unit_price: 10, note: null }],
        paid_amount: 30
      })
    )
    expect(ItemsRepo.list().find((i) => i.id === item.id)?.stock_qty).toBe(7)
    TransactionsRepo.update(tx.id, {
      ...txInput({ paid_amount: 50 }),
      lines: [{ item_id: item.id, custom_name: null, quantity: 5, unit_price: 10, note: null }]
    })
    expect(ItemsRepo.list().find((i) => i.id === item.id)?.stock_qty).toBe(5)
  })
})

describe('TransactionsRepo.delete + removePayment', () => {
  beforeEach(() => freshDb())

  it('soft-deletes the transaction and restores stock', () => {
    const item = ItemsRepo.create({
      category_id: null,
      category_name: null,
      name_ar: 'كرت',
      size: null,
      default_price: 10,
      is_active: 1,
      notes: null,
      tracks_stock: 1,
      stock_qty: 10,
      low_stock_threshold: 0
    })
    const tx = TransactionsRepo.create(
      txInput({
        lines: [{ item_id: item.id, custom_name: null, quantity: 4, unit_price: 10, note: null }],
        paid_amount: 40
      })
    )
    TransactionsRepo.delete(tx.id)
    expect(ItemsRepo.list().find((i) => i.id === item.id)?.stock_qty).toBe(10)
    // Soft-deleted: row exists but with deleted_at set.
    const raw = getDb()
      .prepare('SELECT deleted_at FROM transactions WHERE id = ?')
      .get(tx.id) as { deleted_at: string | null }
    expect(raw.deleted_at).not.toBeNull()
  })

  it('removePayment deletes the row and decrements paid_amount', () => {
    const tx = TransactionsRepo.create(txInput({ paid_amount: 30 }))
    const after = TransactionsRepo.markPaid(tx.id, 70)
    const newPaymentId = after.payments[after.payments.length - 1].id
    const reverted = TransactionsRepo.removePayment(newPaymentId)
    expect(reverted?.paid_amount).toBe(30)
    expect(reverted?.payments).toHaveLength(1)
  })
})
