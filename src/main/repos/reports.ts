import { getDb } from '../db'
import { SettingsRepo } from './settings'
import { RemindersRepo } from './reminders'
import type { DashboardStats, ReportFilters, ReportSummary } from '@shared/types'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
function monthStartStr(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function monthEndStr(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}

export const ReportsRepo = {
  dashboard(): DashboardStats {
    const db = getDb()
    const today = todayStr()
    const monthStart = monthStartStr()
    const monthEnd = monthEndStr()

        // Dashboard income = money actually received on those days, summed
    // from the payments ledger by payment.date (not the underlying sale's
    // date). This matches how cash-close and the Reports page compute
    // income, so all three views agree.
    const incomeToday =
      (db
        .prepare(
          `SELECT COALESCE(SUM(p.amount),0) AS s
           FROM payments p
           JOIN transactions t ON t.id = p.transaction_id
           WHERE t.deleted_at IS NULL AND p.date = ?`
        )
        .get(today) as { s: number }).s ?? 0
    const incomeMonth =
      (db
        .prepare(
          `SELECT COALESCE(SUM(p.amount),0) AS s
           FROM payments p
           JOIN transactions t ON t.id = p.transaction_id
           WHERE t.deleted_at IS NULL AND p.date >= ? AND p.date <= ?`
        )
        .get(monthStart, monthEnd) as { s: number }).s ?? 0
    const txCountToday =
      (db
        .prepare('SELECT COUNT(*) AS c FROM transactions WHERE deleted_at IS NULL AND date = ?')
        .get(today) as { c: number }).c ?? 0
    const txCountMonth =
      (db
        .prepare(
          'SELECT COUNT(*) AS c FROM transactions WHERE deleted_at IS NULL AND date >= ? AND date <= ?'
        )
        .get(monthStart, monthEnd) as { c: number }).c ?? 0
    const wdMonth =
      (db
        .prepare(
          'SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE deleted_at IS NULL AND date >= ? AND date <= ?'
        )
        .get(monthStart, monthEnd) as { s: number }).s ?? 0
    const invMonth =
      (db
        .prepare(
          'SELECT COALESCE(SUM(cost),0) AS s FROM inventory_purchases WHERE deleted_at IS NULL AND date >= ? AND date <= ?'
        )
        .get(monthStart, monthEnd) as { s: number }).s ?? 0
    const now = new Date()
    const rentReq = Number(SettingsRepo.get('default_rent') ?? '0') || 0
    const rentPaid =
      (db
        .prepare(
          `SELECT COALESCE(SUM(amount),0) AS s FROM rent_payments
           WHERE deleted_at IS NULL AND period_year = ? AND period_month = ?`
        )
        .get(now.getFullYear(), now.getMonth() + 1) as { s: number }).s ?? 0
    const outstandingRow = db
      .prepare(
        `SELECT COALESCE(SUM(total - paid_amount), 0) AS s, COUNT(*) AS c
         FROM transactions
         WHERE deleted_at IS NULL AND (total - paid_amount) > 0.0001`
      )
      .get() as { s: number; c: number }
    const activeClientsRow = db
      .prepare(
        `SELECT COUNT(DISTINCT client_id) AS c
         FROM transactions
         WHERE deleted_at IS NULL AND client_id IS NOT NULL AND date >= ? AND date <= ?`
      )
      .get(monthStart, monthEnd) as { c: number }

    const topItems = db
      .prepare(
        `SELECT COALESCE(i.name_ar, ti.custom_name) AS name,
                SUM(ti.quantity) AS quantity,
                SUM(ti.subtotal) AS revenue
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN items i ON i.id = ti.item_id
         WHERE t.deleted_at IS NULL AND t.date >= ? AND t.date <= ?
         GROUP BY name
         ORDER BY revenue DESC
         LIMIT 5`
      )
      .all(monthStart, monthEnd) as { name: string; quantity: number; revenue: number }[]

    // Pending pickups
    const pickupRow = db
      .prepare(
        `SELECT COUNT(*) AS c FROM transactions
         WHERE deleted_at IS NULL AND pickup_status IN ('pending','ready')`
      )
      .get() as { c: number }

    // Bookings
    const bookingsToday = (db
      .prepare(
        `SELECT COUNT(*) AS c FROM bookings
         WHERE deleted_at IS NULL AND status = 'scheduled' AND date = ?`
      )
      .get(today) as { c: number }).c
    const bookingsUpcoming = (db
      .prepare(
        `SELECT COUNT(*) AS c FROM bookings
         WHERE deleted_at IS NULL AND status = 'scheduled' AND date > ?`
      )
      .get(today) as { c: number }).c

    // Reminders
    const remindersDue = RemindersRepo.countDue()

    // Weekly P&L
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 6)
    const weekStartStr = weekStart.toISOString().slice(0, 10)
    const prevWeekEnd = new Date(weekStart)
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1)
    const prevWeekEndStr = prevWeekEnd.toISOString().slice(0, 10)
    const prevWeekStart = new Date(prevWeekEnd)
    prevWeekStart.setDate(prevWeekStart.getDate() - 6)
    const prevWeekStartStr = prevWeekStart.toISOString().slice(0, 10)
    // Same payments-based aggregation for the weekly trend chart.
    const incomeWeek = (db
      .prepare(
        `SELECT COALESCE(SUM(p.amount),0) AS s
         FROM payments p
         JOIN transactions t ON t.id = p.transaction_id
         WHERE t.deleted_at IS NULL AND p.date >= ? AND p.date <= ?`
      )
      .get(weekStartStr, today) as { s: number }).s
    const incomeWeekPrev = (db
      .prepare(
        `SELECT COALESCE(SUM(p.amount),0) AS s
         FROM payments p
         JOIN transactions t ON t.id = p.transaction_id
         WHERE t.deleted_at IS NULL AND p.date >= ? AND p.date <= ?`
      )
      .get(prevWeekStartStr, prevWeekEndStr) as { s: number }).s

    return {
      income_today: incomeToday,
      income_month: incomeMonth,
      tx_count_today: txCountToday,
      tx_count_month: txCountMonth,
      withdrawals_month: wdMonth,
      inventory_month: invMonth,
      rent_paid_month: rentPaid,
      rent_required_month: rentReq,
      rent_remaining_month: Math.max(0, rentReq - rentPaid),
      net_month: incomeMonth - wdMonth - invMonth - rentPaid,
      outstanding_total: outstandingRow.s,
      debtor_count: outstandingRow.c,
      active_clients_month: activeClientsRow.c,
      pending_pickups: pickupRow.c,
      bookings_today: bookingsToday,
      bookings_upcoming: bookingsUpcoming,
      reminders_due: remindersDue,
      income_week: incomeWeek,
      income_week_prev: incomeWeekPrev,
      top_items: topItems
    }
  },

  summary(filters: ReportFilters): ReportSummary {
    const db = getDb()
    const where: string[] = ['t.deleted_at IS NULL']
    const params: (string | number)[] = []
    if (filters.date_from) {
      where.push('t.date >= ?')
      params.push(filters.date_from)
    }
    if (filters.date_to) {
      where.push('t.date <= ?')
      params.push(filters.date_to)
    }
    if (filters.client_id) {
      where.push('t.client_id = ?')
      params.push(filters.client_id)
    }
    if (filters.staff_name) {
      where.push('t.staff_name = ?')
      params.push(filters.staff_name)
    }
    const w = `WHERE ${where.join(' AND ')}`

    // tx_count is "invoices created in this date range" — counted on the
    // transaction's own date and using the same filters.
    const txCountRow = db
      .prepare(`SELECT COUNT(*) AS c FROM transactions t ${w}`)
      .get(...params) as { c: number }

    // Income aggregations now sum the payments table by the payment's own
    // date — so a sale created on Jan 1 with 30 paid then and 70 paid on
    // Jan 5 contributes 30 to Jan 1 and 70 to Jan 5. Date filters apply
    // to payment.date; non-date filters still apply to the underlying
    // transaction (client, staff, etc.) via JOIN.
    const paymentsWhere: string[] = ['t.deleted_at IS NULL']
    const paymentsParams: (string | number)[] = []
    if (filters.date_from) {
      paymentsWhere.push('p.date >= ?')
      paymentsParams.push(filters.date_from)
    }
    if (filters.date_to) {
      paymentsWhere.push('p.date <= ?')
      paymentsParams.push(filters.date_to)
    }
    if (filters.client_id) {
      paymentsWhere.push('t.client_id = ?')
      paymentsParams.push(filters.client_id)
    }
    if (filters.staff_name) {
      paymentsWhere.push('t.staff_name = ?')
      paymentsParams.push(filters.staff_name)
    }
    const pw = `WHERE ${paymentsWhere.join(' AND ')}`

    const incomeRow = db
      .prepare(
        `SELECT COALESCE(SUM(p.amount),0) AS s
         FROM payments p
         JOIN transactions t ON t.id = p.transaction_id
         ${pw}`
      )
      .get(...paymentsParams) as { s: number }

    const byDay = db
      .prepare(
        `SELECT p.date AS date,
                COALESCE(SUM(p.amount), 0) AS income,
                COUNT(DISTINCT p.transaction_id) AS tx_count
         FROM payments p
         JOIN transactions t ON t.id = p.transaction_id
         ${pw}
         GROUP BY p.date
         ORDER BY p.date ASC`
      )
      .all(...paymentsParams) as { date: string; income: number; tx_count: number }[]

    const byPaymentMethod = db
      .prepare(
        `SELECT COALESCE(p.payment_method, t.payment_method, 'بدون') AS method,
                COALESCE(SUM(p.amount), 0) AS total,
                COUNT(*) AS count
         FROM payments p
         JOIN transactions t ON t.id = p.transaction_id
         ${pw}
         GROUP BY method
         ORDER BY total DESC`
      )
      .all(...paymentsParams) as { method: string; total: number; count: number }[]

    const itemWhere: string[] = [...where]
    const itemParams = [...params]
    if (filters.item_id) {
      itemWhere.push('ti.item_id = ?')
      itemParams.push(filters.item_id)
    }
    if (filters.category_id) {
      itemWhere.push('i.category_id = ?')
      itemParams.push(filters.category_id)
    }
    const itemW = `WHERE ${itemWhere.join(' AND ')}`

    const byItem = db
      .prepare(
        `SELECT COALESCE(i.name_ar, ti.custom_name) AS name,
                SUM(ti.quantity) AS quantity,
                SUM(ti.subtotal) AS revenue
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN items i ON i.id = ti.item_id
         ${itemW}
         GROUP BY name
         ORDER BY revenue DESC`
      )
      .all(...itemParams) as { name: string; quantity: number; revenue: number }[]

    const byCategory = db
      .prepare(
        `SELECT COALESCE(c.name_ar, 'بدون تصنيف') AS name,
                SUM(ti.subtotal) AS revenue
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         LEFT JOIN items i ON i.id = ti.item_id
         LEFT JOIN categories c ON c.id = i.category_id
         ${itemW}
         GROUP BY name
         ORDER BY revenue DESC`
      )
      .all(...itemParams) as { name: string; revenue: number }[]

    const dateWhere: string[] = ['deleted_at IS NULL']
    const dateParams: string[] = []
    if (filters.date_from) {
      dateWhere.push('date >= ?')
      dateParams.push(filters.date_from)
    }
    if (filters.date_to) {
      dateWhere.push('date <= ?')
      dateParams.push(filters.date_to)
    }
    const dW = `WHERE ${dateWhere.join(' AND ')}`
    const wdTotal =
      (db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals ${dW}`).get(...dateParams) as {
        s: number
      }).s ?? 0
    const invTotal =
      (db
        .prepare(`SELECT COALESCE(SUM(cost),0) AS s FROM inventory_purchases ${dW}`)
        .get(...dateParams) as { s: number }).s ?? 0

    const rentWhere: string[] = ['deleted_at IS NULL']
    const rentParams: string[] = []
    if (filters.date_from) {
      rentWhere.push('payment_date >= ?')
      rentParams.push(filters.date_from)
    }
    if (filters.date_to) {
      rentWhere.push('payment_date <= ?')
      rentParams.push(filters.date_to)
    }
    const rW = `WHERE ${rentWhere.join(' AND ')}`
    const rentTotal =
      (db.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM rent_payments ${rW}`).get(...rentParams) as {
        s: number
      }).s ?? 0

    return {
      income_total: incomeRow.s,
      withdrawals_total: wdTotal,
      rent_total: rentTotal,
      inventory_total: invTotal,
      net_total: incomeRow.s - wdTotal - invTotal - rentTotal,
      tx_count: txCountRow.c,
      by_day: byDay,
      by_item: byItem,
      by_category: byCategory,
      by_payment_method: byPaymentMethod
    }
  }
}
