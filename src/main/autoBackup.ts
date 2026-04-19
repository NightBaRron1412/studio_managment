import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { getDbPath } from './db'
import { SettingsRepo } from './repos/settings'

const KEEP = 7
const PREFIX = 'studio-autobackup-'

export function runAutoBackupIfDue(): { path?: string; skipped?: string } {
  const enabled = SettingsRepo.get('auto_backup_enabled') === 'true'
  if (!enabled) return { skipped: 'disabled' }
  const dir = SettingsRepo.get('auto_backup_dir')
  if (!dir) return { skipped: 'no_dir' }
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      return { skipped: 'no_dir' }
    }
  }
  const last = lastBackupTime(dir)
  const now = Date.now()
  if (last && now - last < 1000 * 60 * 60 * 23) {
    return { skipped: 'too_recent' }
  }
  return { path: runAutoBackupNow(dir) }
}

export function runAutoBackupNow(dir?: string): string {
  const targetDir = dir || SettingsRepo.get('auto_backup_dir') || ''
  if (!targetDir) throw new Error('لم يتم تحديد مجلد النسخ التلقائي')
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const out = join(targetDir, `${PREFIX}${stamp}.db`)
  copyFileSync(getDbPath(), out)
  pruneOld(targetDir)
  return out
}

function lastBackupTime(dir: string): number | null {
  try {
    const files = readdirSync(dir).filter((f) => f.startsWith(PREFIX) && f.endsWith('.db'))
    if (files.length === 0) return null
    let newest = 0
    for (const f of files) {
      const t = statSync(join(dir, f)).mtime.getTime()
      if (t > newest) newest = t
    }
    return newest
  } catch {
    return null
  }
}

function pruneOld(dir: string): void {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.startsWith(PREFIX) && f.endsWith('.db'))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtime.getTime() }))
      .sort((a, b) => b.t - a.t)
    const toDelete = files.slice(KEEP)
    for (const x of toDelete) {
      try {
        unlinkSync(join(dir, x.f))
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
