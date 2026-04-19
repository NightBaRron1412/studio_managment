import { getDb } from '../db'
import type { ID, Reminder } from '@shared/types'

export const RemindersRepo = {
  list(only_open?: boolean): Reminder[] {
    const sql = only_open
      ? 'SELECT * FROM reminders WHERE is_done = 0 ORDER BY (due_date IS NULL), due_date ASC, id DESC'
      : 'SELECT * FROM reminders ORDER BY is_done ASC, (due_date IS NULL), due_date ASC, id DESC'
    return getDb().prepare(sql).all() as Reminder[]
  },
  create(input: { text: string; due_date: string | null; is_done?: number }): Reminder {
    const db = getDb()
    const info = db
      .prepare('INSERT INTO reminders (text, due_date, is_done) VALUES (?, ?, ?)')
      .run(input.text.trim(), input.due_date || null, input.is_done ?? 0)
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(info.lastInsertRowid) as Reminder
  },
  toggle(id: ID, done: boolean): Reminder {
    const db = getDb()
    db.prepare('UPDATE reminders SET is_done = ? WHERE id = ?').run(done ? 1 : 0, id)
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as Reminder
  },
  delete(id: ID): void {
    getDb().prepare('DELETE FROM reminders WHERE id = ?').run(id)
  },
  countDue(): number {
    const today = new Date().toISOString().slice(0, 10)
    const r = getDb()
      .prepare('SELECT COUNT(*) AS c FROM reminders WHERE is_done = 0 AND due_date IS NOT NULL AND due_date <= ?')
      .get(today) as { c: number }
    return r.c
  }
}
