import { getDb } from '../db'
import type { Booking, BookingStatus, ID } from '@shared/types'

export const BookingsRepo = {
  list(filter?: { date_from?: string; date_to?: string; status?: BookingStatus }): Booking[] {
    const where: string[] = ['deleted_at IS NULL']
    const params: string[] = []
    if (filter?.date_from) {
      where.push('date >= ?')
      params.push(filter.date_from)
    }
    if (filter?.date_to) {
      where.push('date <= ?')
      params.push(filter.date_to)
    }
    if (filter?.status) {
      where.push('status = ?')
      params.push(filter.status)
    }
    const sql = `SELECT * FROM bookings WHERE ${where.join(' AND ')} ORDER BY date ASC, time ASC, id ASC`
    return getDb().prepare(sql).all(...params) as Booking[]
  },
  get(id: ID): Booking | null {
    const r = getDb().prepare('SELECT * FROM bookings WHERE id = ? AND deleted_at IS NULL').get(id) as
      | Booking
      | undefined
    return r ?? null
  },
  create(input: Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): Booking {
    const db = getDb()
    const info = db
      .prepare(
        `INSERT INTO bookings (date, time, client_id, client_name, client_phone, session_type, deposit, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.date,
        input.time || null,
        input.client_id ?? null,
        input.client_name || null,
        input.client_phone || null,
        input.session_type.trim(),
        Number(input.deposit) || 0,
        input.status || 'scheduled',
        input.note || null
      )
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid) as Booking
  },
  update(id: ID, input: Partial<Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>): Booking {
    const db = getDb()
    const cur = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Booking | undefined
    if (!cur) throw new Error('الحجز غير موجود')
    const m = { ...cur, ...input }
    db.prepare(
      `UPDATE bookings SET date = ?, time = ?, client_id = ?, client_name = ?, client_phone = ?,
       session_type = ?, deposit = ?, status = ?, note = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(
      m.date,
      m.time || null,
      m.client_id ?? null,
      m.client_name || null,
      m.client_phone || null,
      m.session_type.trim(),
      Number(m.deposit) || 0,
      m.status || 'scheduled',
      m.note || null,
      id
    )
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Booking
  },
  delete(id: ID): void {
    getDb().prepare(`UPDATE bookings SET deleted_at = datetime('now') WHERE id = ?`).run(id)
  }
}
