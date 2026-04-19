import { getDb } from '../db'
import type { Category, ID } from '@shared/types'

export const CategoriesRepo = {
  list(): Category[] {
    return getDb()
      .prepare('SELECT * FROM categories ORDER BY sort_order ASC, name_ar ASC')
      .all() as Category[]
  },
  create(input: Omit<Category, 'id'>): Category {
    const db = getDb()
    const info = db
      .prepare('INSERT INTO categories (name_ar, sort_order, icon) VALUES (?, ?, ?)')
      .run(input.name_ar.trim(), input.sort_order ?? 0, input.icon ?? null)
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) as Category
  },
  update(id: ID, input: Partial<Omit<Category, 'id'>>): Category {
    const db = getDb()
    const cur = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined
    if (!cur) throw new Error('التصنيف غير موجود')
    const merged = { ...cur, ...input }
    db.prepare('UPDATE categories SET name_ar = ?, sort_order = ?, icon = ? WHERE id = ?').run(
      merged.name_ar.trim(),
      merged.sort_order ?? 0,
      merged.icon ?? null,
      id
    )
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category
  },
  delete(id: ID): void {
    getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
  }
}
