import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Tests run in plain Node, not Electron — so any code that imports from
// 'electron' (only db.ts, via getDbPath) gets the local stub instead of
// the real module. Tests that need a database call initDb(':memory:'),
// which sidesteps getDbPath entirely.
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: false,
    pool: 'forks',
    // better-sqlite3 is a native module — single-fork keeps the C++ side happy
    // and is plenty fast for our test count. (Vitest 4 lifted poolOptions to
    // top-level pool config keys; single-fork is the default behavior here.)
    fileParallelism: false
  },
  resolve: {
    alias: {
      electron: resolve(__dirname, 'tests/stubs/electron.ts'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
})
