import { app } from 'electron'
import { existsSync, unlinkSync } from 'node:fs'
import { closeDb, getDbPath, initDb } from '../db'
import type Database from 'better-sqlite3'

function runBatch(d: Database.Database, sql: string): void {
  const fn = (d as unknown as Record<string, (s: string) => void>)['exec']
  fn.call(d, sql)
}

export const SystemRepo = {
  // Wipe all data tables (transactions, clients, money movements, schedules)
  // but keep configuration: items, categories, settings.
  resetData(d: Database.Database): void {
    const tx = d.transaction(() => {
      runBatch(
        d,
        `DELETE FROM transaction_items;
         DELETE FROM transactions;
         DELETE FROM withdrawals;
         DELETE FROM rent_payments;
         DELETE FROM inventory_purchases;
         DELETE FROM cash_closes;
         DELETE FROM bookings;
         DELETE FROM reminders;
         DELETE FROM clients;`
      )
      // Reset autoincrement counters so transaction numbers start fresh
      runBatch(
        d,
        `DELETE FROM sqlite_sequence WHERE name IN
          ('transactions','transaction_items','withdrawals','rent_payments',
           'inventory_purchases','cash_closes','bookings','reminders','clients');`
      )
    })
    tx()
    runBatch(d, 'VACUUM;')
  },

  // Full factory reset: delete the database file entirely. The fresh init
  // recreates the schema and seeds the four default items + categories.
  // Settings (including onboarding_done) reset to defaults so the wizard runs
  // again on next launch.
  resetAll(): void {
    closeDb()
    const path = getDbPath()
    if (existsSync(path)) {
      try {
        unlinkSync(path)
      } catch (e) {
        // If file is locked, re-init the DB so we don't end up with no DB
        initDb()
        throw e
      }
    }
    // Also delete WAL/SHM sidecar files left by SQLite
    for (const sfx of ['-wal', '-shm', '-journal']) {
      const sidecar = path + sfx
      if (existsSync(sidecar)) {
        try {
          unlinkSync(sidecar)
        } catch {
          // ignore
        }
      }
    }
    initDb()
  },

  // Helper to relaunch the app cleanly after a reset so the renderer
  // re-fetches all queries and the onboarding wizard appears.
  relaunch(): void {
    app.relaunch()
    app.exit(0)
  }
}
