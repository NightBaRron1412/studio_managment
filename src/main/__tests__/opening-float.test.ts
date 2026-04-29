// Opening-float carry-over: cash left in the drawer overnight should
// roll into the next day's تقفيلة as the opening balance, so it doesn't
// look like a daily "زيادة" discrepancy.
import { describe, expect, beforeEach, it } from 'vitest'
import { freshDb } from '../../../tests/helpers'
import { CashCloseRepo } from '../repos/cashClose'

describe('CashCloseRepo opening_float', () => {
  beforeEach(() => freshDb())

  it('first day with no prior closes defaults to opening_float = 0', () => {
    const info = CashCloseRepo.todayInfo('2026-04-29')
    expect(info.opening_float).toBe(0)
    expect(info.expected_cash).toBe(0)
  })

  it('expected = opening + cash_in − cash_out', () => {
    // No payments/withdrawals — just the float math.
    CashCloseRepo.submit({
      date: '2026-04-28',
      actual_cash: 200,
      opening_float: 0,
      note: null
    })
    const info = CashCloseRepo.todayInfo('2026-04-29')
    expect(info.opening_float).toBe(200) // carried from yesterday's actual
    expect(info.expected_cash).toBe(200) // 200 + 0 − 0
  })

  it('manual override on submit overrides the carried default', () => {
    CashCloseRepo.submit({
      date: '2026-04-28',
      actual_cash: 200,
      opening_float: 0,
      note: null
    })
    // Owner took 50 home overnight — open with 150 instead of the default 200.
    const saved = CashCloseRepo.submit({
      date: '2026-04-29',
      actual_cash: 150,
      opening_float: 150,
      note: null
    })
    expect(saved.opening_float).toBe(150)
    expect(saved.expected_cash).toBe(150) // 150 + 0 − 0
    expect(saved.difference).toBe(0)
  })

  it('reopening today after save preserves the saved opening_float', () => {
    CashCloseRepo.submit({
      date: '2026-04-29',
      actual_cash: 250,
      opening_float: 100,
      note: null
    })
    const info = CashCloseRepo.todayInfo('2026-04-29')
    // Should NOT recompute from yesterday; should reflect the saved row.
    expect(info.opening_float).toBe(100)
    expect(info.closed?.opening_float).toBe(100)
  })

  it('skips a day correctly: opening = most recent prior close, not exactly yesterday', () => {
    CashCloseRepo.submit({
      date: '2026-04-25',
      actual_cash: 500,
      opening_float: 0,
      note: null
    })
    // No close on 26, 27, 28 — query for 29 should still find the 25 close.
    const info = CashCloseRepo.todayInfo('2026-04-29')
    expect(info.opening_float).toBe(500)
  })
})
