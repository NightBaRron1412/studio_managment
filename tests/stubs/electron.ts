// Vitest electron stub — only the bits db.ts and friends touch at import
// time. Tests that need a database always pass an explicit ':memory:' path
// to initDb(), so getDbPath() (the only consumer of app.getPath here) is
// never actually called from a test.
import { tmpdir } from 'node:os'

export const app = {
  getPath: (_name: string): string => tmpdir(),
  getVersion: (): string => '0.0.0-test'
}

export const ipcMain = {
  handle: (): void => {},
  removeHandler: (): void => {}
}

export const BrowserWindow = {
  getAllWindows: (): unknown[] => []
}

export const dialog = {
  showMessageBox: async (): Promise<{ response: number }> => ({ response: 0 })
}

export const shell = {
  openPath: async (): Promise<string> => ''
}
