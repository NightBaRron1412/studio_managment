// Shared test helpers — every repo test calls freshDb() in beforeEach to
// get a clean in-memory SQLite that has been migrated and seeded the same
// way a real first-launch would.
import { closeDb, initDb } from '../src/main/db'

export function freshDb(): void {
  closeDb()
  initDb(':memory:')
}

export function reset(): void {
  closeDb()
}
