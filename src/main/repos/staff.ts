import { getDb } from '../db'
import type { ID, Staff } from '@shared/types'

export const StaffRepo = {
  list(opts?: { only_active?: boolean }): Staff[] {
    const where = opts?.only_active ? 'WHERE is_active = 1' : ''
    return getDb()
      .prepare(`SELECT * FROM staff ${where} ORDER BY is_active DESC, name ASC`)
      .all() as Staff[]
  },
  create(input: { name: string; is_active?: number }): Staff {
    const db = getDb()
    const name = input.name.trim()
    if (!name) throw new Error('الاسم مطلوب')
    const info = db
      .prepare('INSERT INTO staff (name, is_active) VALUES (?, ?)')
      .run(name, input.is_active ?? 1)
    return db.prepare('SELECT * FROM staff WHERE id = ?').get(info.lastInsertRowid as number) as Staff
  },
  update(id: ID, input: Partial<Pick<Staff, 'name' | 'is_active'>>): Staff {
    const db = getDb()
    const cur = db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as Staff | undefined
    if (!cur) throw new Error('الموظف غير موجود')
    const merged = { ...cur, ...input }
    db.prepare('UPDATE staff SET name = ?, is_active = ? WHERE id = ?').run(
      merged.name.trim(),
      merged.is_active ?? 1,
      id
    )
    return db.prepare('SELECT * FROM staff WHERE id = ?').get(id) as Staff
  },
  delete(id: ID): void {
    getDb().prepare('DELETE FROM staff WHERE id = ?').run(id)
  }
}
