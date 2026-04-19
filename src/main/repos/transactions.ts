import { getDb } from '../db'
import type {
  ID,
  Transaction,
  TransactionLine,
  TransactionWithLines,
  TransactionInput,
  DebtorRow
} from '@shared/types'

function nextTransactionNo(): string {
  const db = getDb()
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const prefix = `${y}${m}${d}`
  const row = db
    .prepare(
      `SELECT transaction_no FROM transactions WHERE transaction_no LIKE ? ORDER BY id DESC LIMIT 1`
    )
    .get(`${prefix}-%`) as { transaction_no: string } | undefined
  let n = 1
  if (row) {
    const m2 = row.transaction_no.match(/-(\d+)$/)
    if (m2) n = parseInt(m2[1], 10) + 1
  }
  return `${prefix}-${String(n).padStart(3, '0')}`
}

function fetchLines(txId: ID): TransactionLine[] {
  return getDb()
    .prepare(
      `SELECT ti.*, i.name_ar AS item_name
       FROM transaction_items ti
       LEFT JOIN items i ON i.id = ti.item_id
       WHERE ti.transaction_id = ?
       ORDER BY ti.id ASC`
    )
    .all(txId) as TransactionLine[]
}

function withRemaining(tx: Transaction, lines: TransactionLine[]): TransactionWithLines {
  const remaining = Math.max(0, Number((tx.total - tx.paid_amount).toFixed(2)))
  return { ...tx, lines, remaining, is_paid: remaining <= 0.0001 }
}

function fetchWithLines(id: ID): TransactionWithLines | null {
  const db = getDb()
  const tx = db
    .prepare(
      `SELECT t.*, c.name AS client_name
       FROM transactions t
       LEFT JOIN clients c ON c.id = t.client_id
       WHERE t.id = ?`
    )
    .get(id) as Transaction | undefined
  if (!tx) return null
  return withRemaining(tx, fetchLines(id))
}

interface TotalsBreakdown {
  subtotal: number
  discount_amount: number
  vat_amount: number
  total: number
}
function computeTotals(input: TransactionInput): TotalsBreakdown {
  const subtotal = input.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_price), 0)
  let discount_amount = 0
  if (input.discount_type === 'percent') {
    discount_amount = subtotal * (Number(input.discount_value) / 100)
  } else if (input.discount_type === 'fixed') {
    discount_amount = Number(input.discount_value) || 0
  }
  discount_amount = Math.min(discount_amount, subtotal)
  const taxable = subtotal - discount_amount
  const vat_percent = Number(input.vat_percent) || 0
  const vat_amount = taxable * (vat_percent / 100)
  const total = Number((taxable + vat_amount).toFixed(2))
  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount_amount: Number(discount_amount.toFixed(2)),
    vat_amount: Number(vat_amount.toFixed(2)),
    total
  }
}

export const TransactionsRepo = {
  list(filter?: {
    q?: string
    date_from?: string
    date_to?: string
    client_id?: ID
    only_unpaid?: boolean
  }): Transaction[] {
    const db = getDb()
    const where: string[] = ['t.deleted_at IS NULL']
    const params: (string | number)[] = []
    if (filter?.q && filter.q.trim()) {
      where.push(`(c.name LIKE ? OR c.phone LIKE ? OR t.transaction_no LIKE ? OR t.notes LIKE ?)`)
      const s = `%${filter.q.trim()}%`
      params.push(s, s, s, s)
    }
    if (filter?.date_from) {
      where.push('t.date >= ?')
      params.push(filter.date_from)
    }
    if (filter?.date_to) {
      where.push('t.date <= ?')
      params.push(filter.date_to)
    }
    if (filter?.client_id) {
      where.push('t.client_id = ?')
      params.push(filter.client_id)
    }
    if (filter?.only_unpaid) {
      where.push('(t.total - t.paid_amount) > 0.0001')
    }
    const sql = `
      SELECT t.*, c.name AS client_name
      FROM transactions t
      LEFT JOIN clients c ON c.id = t.client_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.date DESC, t.id DESC
      LIMIT 500
    `
    return db.prepare(sql).all(...params) as Transaction[]
  },

  get(id: ID): TransactionWithLines | null {
    return fetchWithLines(id)
  },

  create(input: TransactionInput): TransactionWithLines {
    const db = getDb()
    const tx = db.transaction(() => {
      const txNo = nextTransactionNo()
      const t = computeTotals(input)
      const paid = Math.min(Math.max(0, Number(input.paid_amount) || 0), t.total)
      const info = db
        .prepare(
          `INSERT INTO transactions (transaction_no, date, client_id, staff_name, notes,
            subtotal, discount_type, discount_value, discount_amount,
            vat_percent, vat_amount, total, paid_amount, payment_method,
            pickup_status, pickup_promised_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          txNo,
          input.date,
          input.client_id,
          input.staff_name,
          input.notes,
          t.subtotal,
          input.discount_type,
          Number(input.discount_value) || 0,
          t.discount_amount,
          Number(input.vat_percent) || 0,
          t.vat_amount,
          t.total,
          paid,
          input.payment_method,
          input.pickup_status ?? null,
          input.pickup_promised_date ?? null
        )
      const txId = info.lastInsertRowid as number
      const insLine = db.prepare(
        `INSERT INTO transaction_items (transaction_id, item_id, custom_name, quantity, unit_price, subtotal, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const l of input.lines) {
        const sub = Number(l.quantity) * Number(l.unit_price)
        insLine.run(txId, l.item_id, l.custom_name, Number(l.quantity), Number(l.unit_price), sub, l.note ?? null)
      }
      return txId
    })()
    return fetchWithLines(tx)!
  },

  update(id: ID, input: TransactionInput): TransactionWithLines {
    const db = getDb()
    db.transaction(() => {
      const t = computeTotals(input)
      const paid = Math.min(Math.max(0, Number(input.paid_amount) || 0), t.total)
      db.prepare(
        `UPDATE transactions SET date = ?, client_id = ?, staff_name = ?, notes = ?, payment_method = ?,
         subtotal = ?, discount_type = ?, discount_value = ?, discount_amount = ?,
         vat_percent = ?, vat_amount = ?, total = ?, paid_amount = ?,
         pickup_status = ?, pickup_promised_date = ?,
         updated_at = datetime('now') WHERE id = ?`
      ).run(
        input.date,
        input.client_id,
        input.staff_name,
        input.notes,
        input.payment_method,
        t.subtotal,
        input.discount_type,
        Number(input.discount_value) || 0,
        t.discount_amount,
        Number(input.vat_percent) || 0,
        t.vat_amount,
        t.total,
        paid,
        input.pickup_status ?? null,
        input.pickup_promised_date ?? null,
        id
      )
      db.prepare('DELETE FROM transaction_items WHERE transaction_id = ?').run(id)
      const insLine = db.prepare(
        `INSERT INTO transaction_items (transaction_id, item_id, custom_name, quantity, unit_price, subtotal, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const l of input.lines) {
        const sub = Number(l.quantity) * Number(l.unit_price)
        insLine.run(id, l.item_id, l.custom_name, Number(l.quantity), Number(l.unit_price), sub, l.note ?? null)
      }
    })()
    return fetchWithLines(id)!
  },

  delete(id: ID): void {
    getDb().prepare(`UPDATE transactions SET deleted_at = datetime('now') WHERE id = ?`).run(id)
  },

  markPaid(id: ID, additional: number): TransactionWithLines {
    const db = getDb()
    const tx = fetchWithLines(id)
    if (!tx) throw new Error('المعاملة غير موجودة')
    const add = Math.max(0, Number(additional) || 0)
    const newPaid = Math.min(tx.total, tx.paid_amount + add)
    db.prepare(`UPDATE transactions SET paid_amount = ?, updated_at = datetime('now') WHERE id = ?`).run(newPaid, id)
    return fetchWithLines(id)!
  },

  markPickup(id: ID, status: 'pending' | 'ready' | 'delivered' | null): TransactionWithLines {
    const db = getDb()
    if (status === 'delivered') {
      db.prepare(
        `UPDATE transactions SET pickup_status = ?, pickup_delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      ).run(status, id)
    } else {
      db.prepare(
        `UPDATE transactions SET pickup_status = ?, pickup_delivered_at = NULL, updated_at = datetime('now') WHERE id = ?`
      ).run(status, id)
    }
    return fetchWithLines(id)!
  },

  pendingPickups(): Transaction[] {
    return getDb()
      .prepare(
        `SELECT t.*, c.name AS client_name FROM transactions t
         LEFT JOIN clients c ON c.id = t.client_id
         WHERE t.deleted_at IS NULL AND t.pickup_status IN ('pending','ready')
         ORDER BY t.pickup_promised_date ASC NULLS LAST, t.date ASC`
      )
      .all() as Transaction[]
  },

  forClient(clientId: ID): TransactionWithLines[] {
    const db = getDb()
    const txs = db
      .prepare(
        `SELECT t.*, c.name AS client_name FROM transactions t
         LEFT JOIN clients c ON c.id = t.client_id
         WHERE t.client_id = ? AND t.deleted_at IS NULL
         ORDER BY t.date DESC, t.id DESC`
      )
      .all(clientId) as Transaction[]
    return txs.map((t) => withRemaining(t, fetchLines(t.id)))
  },

  debtors(): DebtorRow[] {
    return getDb()
      .prepare(
        `SELECT t.client_id AS client_id,
                COALESCE(c.name, 'بدون عميل') AS client_name,
                c.phone AS client_phone,
                SUM(t.total - t.paid_amount) AS outstanding,
                COUNT(*) AS open_count,
                MIN(t.date) AS oldest_date
         FROM transactions t
         LEFT JOIN clients c ON c.id = t.client_id
         WHERE t.deleted_at IS NULL AND (t.total - t.paid_amount) > 0.0001
         GROUP BY t.client_id, c.name, c.phone
         ORDER BY outstanding DESC`
      )
      .all() as DebtorRow[]
  }
}
