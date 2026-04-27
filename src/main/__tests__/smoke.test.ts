import { describe, expect, beforeEach, it } from 'vitest'
import { freshDb } from '../../../tests/helpers'
import { getDb } from '../db'

describe('test harness', () => {
  beforeEach(() => freshDb())

  it('opens an in-memory db with the schema migrated', () => {
    const tables = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: { name: string }) => r.name)
    expect(tables).toContain('transactions')
    expect(tables).toContain('payments')
    expect(tables).toContain('items')
    expect(tables).toContain('staff')
  })
})
