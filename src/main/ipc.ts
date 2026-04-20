import { ipcMain, dialog, BrowserWindow, app, shell, clipboard } from 'electron'
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { createHash } from 'node:crypto'
import { closeDb, getDbPath, initDb } from './db'
import { ClientsRepo } from './repos/clients'
import { CategoriesRepo } from './repos/categories'
import { ItemsRepo } from './repos/items'
import { TransactionsRepo } from './repos/transactions'
import { WithdrawalsRepo } from './repos/withdrawals'
import { RentRepo } from './repos/rent'
import { InventoryRepo } from './repos/inventory'
import { SettingsRepo } from './repos/settings'
import { ReportsRepo } from './repos/reports'
import { CashCloseRepo } from './repos/cashClose'
import { RecycleRepo } from './repos/recycle'
import { BookingsRepo } from './repos/bookings'
import { RemindersRepo } from './repos/reminders'
import { exportReportPDF, exportReceiptPDF } from './pdf'
import { exportReportExcel, exportClientsExcel } from './excel'
import { runAutoBackupNow as autoBackupNow } from './autoBackup'

function safe<T extends (...args: any[]) => any>(fn: T) {
  return async (_evt: unknown, ...args: Parameters<T>): Promise<ReturnType<T> | { __error: string }> => {
    try {
      return await fn(...(args as any[]))
    } catch (e) {
      const msg = (e instanceof Error && e.message) || 'حدث خطأ غير متوقع'
      return { __error: msg }
    }
  }
}

function hashPin(pin: string): string {
  return createHash('sha256').update(pin.trim()).digest('hex')
}

// Build a unique PDF path inside the OS temp dir. The timestamp suffix means
// the file never collides with a previously-opened receipt PDF (which on
// Windows would lock the file and cause EBUSY on the next write).
function uniqueTempPdf(stem: string): string {
  const stamp = Date.now().toString(36)
  return join(app.getPath('temp'), `${stem}-${stamp}.pdf`)
}

// Linux-friendly URL opener. shell.openExternal lies on Linux (resolves
// successfully even when nothing happens). On Linux we try xdg-open first,
// then fall back to popular browser binaries directly. On macOS/Windows we
// trust shell.openExternal.
async function openUrlRobust(url: string): Promise<boolean> {
  if (process.platform !== 'linux') {
    try {
      await shell.openExternal(url)
      return true
    } catch {
      const cmd = process.platform === 'darwin' ? 'open' : 'start'
      try {
        const child = spawn(cmd, [url], {
          detached: true,
          stdio: 'ignore',
          shell: process.platform === 'win32'
        })
        child.unref()
        return true
      } catch {
        return false
      }
    }
  }
  // Linux: try several launchers in order, taking exit code seriously
  const candidates = [
    'xdg-open',
    'gio',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    'firefox',
    'brave-browser'
  ]
  for (const bin of candidates) {
    const args = bin === 'gio' ? ['open', url] : [url]
    try {
      const child = spawn(bin, args, { detached: true, stdio: 'ignore' })
      child.unref()
      // If the binary doesn't exist, spawn emits 'error' synchronously after
      // a microtask. Wait briefly to catch that case and try the next one.
      const failed = await new Promise<boolean>((resolve) => {
        let settled = false
        const t = setTimeout(() => {
          if (!settled) {
            settled = true
            resolve(false)
          }
        }, 80)
        child.once('error', () => {
          if (!settled) {
            settled = true
            clearTimeout(t)
            resolve(true)
          }
        })
      })
      if (!failed) return true
    } catch {
      // try next
    }
  }
  // Last resort: shell.openExternal (might still work on some setups)
  try {
    await shell.openExternal(url)
    return true
  } catch {
    return false
  }
}

export function registerIpc(): void {
  // Clients
  ipcMain.handle('clients:list', safe((q?: string) => ClientsRepo.list(q)))
  ipcMain.handle('client:get', safe((id: number) => ClientsRepo.get(id)))
  ipcMain.handle('client:create', safe((input: any) => ClientsRepo.create(input)))
  ipcMain.handle('client:update', safe((id: number, input: any) => ClientsRepo.update(id, input)))
  ipcMain.handle('client:delete', safe((id: number) => ClientsRepo.delete(id)))
  ipcMain.handle('client:history', safe((id: number) => TransactionsRepo.forClient(id)))
  ipcMain.handle('client:suggestedItems', safe((id: number) => ItemsRepo.suggestedForClient(id)))

  // Categories
  ipcMain.handle('categories:list', safe(() => CategoriesRepo.list()))
  ipcMain.handle('category:create', safe((input: any) => CategoriesRepo.create(input)))
  ipcMain.handle('category:update', safe((id: number, input: any) => CategoriesRepo.update(id, input)))
  ipcMain.handle('category:delete', safe((id: number) => CategoriesRepo.delete(id)))

  // Items
  ipcMain.handle('items:list', safe((opts?: any) => ItemsRepo.list(opts)))
  ipcMain.handle('item:create', safe((input: any) => ItemsRepo.create(input)))
  ipcMain.handle('item:update', safe((id: number, input: any) => ItemsRepo.update(id, input)))
  ipcMain.handle('item:delete', safe((id: number) => ItemsRepo.delete(id)))

  // Transactions
  ipcMain.handle('transactions:list', safe((filter?: any) => TransactionsRepo.list(filter)))
  ipcMain.handle('transaction:get', safe((id: number) => TransactionsRepo.get(id)))
  ipcMain.handle('transaction:create', safe((input: any) => TransactionsRepo.create(input)))
  ipcMain.handle('transaction:update', safe((id: number, input: any) => TransactionsRepo.update(id, input)))
  ipcMain.handle('transaction:delete', safe((id: number) => TransactionsRepo.delete(id)))
  ipcMain.handle('transaction:markPaid', safe((id: number, additional: number) => TransactionsRepo.markPaid(id, additional)))
  ipcMain.handle('transaction:markPickup', safe((id: number, status: any) => TransactionsRepo.markPickup(id, status)))
  ipcMain.handle('debtors:list', safe(() => TransactionsRepo.debtors()))
  ipcMain.handle('pickups:pending', safe(() => TransactionsRepo.pendingPickups()))

  // Bookings
  ipcMain.handle('bookings:list', safe((filter?: any) => BookingsRepo.list(filter)))
  ipcMain.handle('booking:get', safe((id: number) => BookingsRepo.get(id)))
  ipcMain.handle('booking:create', safe((input: any) => BookingsRepo.create(input)))
  ipcMain.handle('booking:update', safe((id: number, input: any) => BookingsRepo.update(id, input)))
  ipcMain.handle('booking:delete', safe((id: number) => BookingsRepo.delete(id)))

  // Reminders
  ipcMain.handle('reminders:list', safe((only_open?: boolean) => RemindersRepo.list(only_open)))
  ipcMain.handle('reminder:create', safe((input: any) => RemindersRepo.create(input)))
  ipcMain.handle('reminder:toggle', safe((id: number, done: boolean) => RemindersRepo.toggle(id, done)))
  ipcMain.handle('reminder:delete', safe((id: number) => RemindersRepo.delete(id)))

  // Withdrawals
  ipcMain.handle('withdrawals:list', safe((filter?: any) => WithdrawalsRepo.list(filter)))
  ipcMain.handle('withdrawal:create', safe((input: any) => WithdrawalsRepo.create(input)))
  ipcMain.handle('withdrawal:update', safe((id: number, input: any) => WithdrawalsRepo.update(id, input)))
  ipcMain.handle('withdrawal:delete', safe((id: number) => WithdrawalsRepo.delete(id)))

  // Rent
  ipcMain.handle('rent:forMonth', safe((y: number, m: number) => RentRepo.forMonth(y, m)))
  ipcMain.handle('rent:create', safe((input: any) => RentRepo.create(input)))
  ipcMain.handle('rent:delete', safe((id: number) => RentRepo.delete(id)))

  // Inventory
  ipcMain.handle('inventory:list', safe((filter?: any) => InventoryRepo.list(filter)))
  ipcMain.handle('inventory:create', safe((input: any) => InventoryRepo.create(input)))
  ipcMain.handle('inventory:update', safe((id: number, input: any) => InventoryRepo.update(id, input)))
  ipcMain.handle('inventory:delete', safe((id: number) => InventoryRepo.delete(id)))

  // Cash close
  ipcMain.handle('cashClose:today', safe(() => {
    const today = new Date().toISOString().slice(0, 10)
    return CashCloseRepo.todayInfo(today)
  }))
  ipcMain.handle('cashClose:submit', safe((input: any) => CashCloseRepo.submit(input)))
  ipcMain.handle('cashClose:list', safe(() => CashCloseRepo.list()))

  // Recycle
  ipcMain.handle('recycle:list', safe(() => RecycleRepo.list()))
  ipcMain.handle('recycle:restore', safe((kind: any, id: number) => RecycleRepo.restore(kind, id)))
  ipcMain.handle('recycle:purge', safe((kind: any, id: number) => RecycleRepo.purge(kind, id)))
  ipcMain.handle('recycle:empty', safe(() => RecycleRepo.empty()))

  // Settings
  ipcMain.handle('settings:all', safe(() => SettingsRepo.all()))
  ipcMain.handle('setting:set', safe((key: string, value: string) => SettingsRepo.set(key, value)))

  // Logo
  ipcMain.handle(
    'logo:pick',
    safe(async () => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const res = await dialog.showOpenDialog(win!, {
        title: 'اختر شعار المحل',
        filters: [{ name: 'صورة PNG', extensions: ['png'] }],
        properties: ['openFile']
      })
      if (res.canceled || !res.filePaths[0]) return { canceled: true as const }
      const src = res.filePaths[0]
      const ext = extname(src).toLowerCase() || '.png'
      const dir = join(app.getPath('userData'), 'assets')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const dest = join(dir, `logo${ext}`)
      copyFileSync(src, dest)
      SettingsRepo.set('logo_path', dest)
      return { path: dest }
    })
  )
  ipcMain.handle('logo:clear', safe(() => SettingsRepo.set('logo_path', '')))

  // PIN
  ipcMain.handle(
    'pin:set',
    safe((pin: string) => {
      const trimmed = String(pin || '').trim()
      if (trimmed.length < 4 || trimmed.length > 8) {
        throw new Error('يجب أن يكون رقم سري من ٤ إلى ٨ أرقام')
      }
      SettingsRepo.set('pin_hash', hashPin(trimmed))
      SettingsRepo.set('pin_enabled', 'true')
    })
  )
  ipcMain.handle(
    'pin:clear',
    safe(() => {
      SettingsRepo.set('pin_hash', '')
      SettingsRepo.set('pin_enabled', 'false')
    })
  )
  ipcMain.handle(
    'pin:verify',
    safe((pin: string) => {
      const stored = SettingsRepo.get('pin_hash') || ''
      if (!stored) return true
      return hashPin(String(pin || '').trim()) === stored
    })
  )

  // Updates — bulletproof. electron-updater fails noisily in dev / unpackaged
  // / unconfigured states; we wrap every step so the renderer always gets a
  // clean { available, error? } shape instead of a crash.
  ipcMain.handle(
    'update:check',
    safe(async () => {
      try {
        const mod = await import('electron-updater').catch((e) => {
          throw new Error('وحدة التحديث غير مثبَّتة: ' + (e as Error).message)
        })
        const u: { checkForUpdates?: () => Promise<{ updateInfo?: { version?: string } }> } =
          (mod as Record<string, unknown>).autoUpdater as never ||
          ((mod as Record<string, unknown>).default as Record<string, unknown>)?.autoUpdater as never
        if (!u || typeof u.checkForUpdates !== 'function') {
          return { available: false, error: 'وحدة التحديث غير متاحة في هذه النسخة' }
        }
        let r: { updateInfo?: { version?: string } } | null = null
        try {
          r = await u.checkForUpdates()
        } catch (e) {
          // Common: no publish config baked, no internet, dev-mode disabled, etc.
          return { available: false, error: e instanceof Error ? e.message : 'تعذّر الاتصال بسيرفر التحديثات' }
        }
        const ver = r?.updateInfo?.version
        return { available: !!ver && ver !== app.getVersion(), version: ver }
      } catch (e) {
        return { available: false, error: e instanceof Error ? e.message : 'فشل فحص التحديث' }
      }
    })
  )

  // Excel client export
  ipcMain.handle(
    'export:clientsExcel',
    safe(async () => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const stamp = new Date().toISOString().slice(0, 10)
      const res = await dialog.showSaveDialog(win!, {
        title: 'حفظ قائمة العملاء Excel',
        defaultPath: `clients-${stamp}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      })
      if (res.canceled || !res.filePath) return { canceled: true as const }
      const clients = ClientsRepo.list()
      await exportClientsExcel(res.filePath, clients, SettingsRepo.all())
      shell.showItemInFolder(res.filePath)
      return { path: res.filePath }
    })
  )

  // Dashboard / Reports
  ipcMain.handle('dashboard', safe(() => ReportsRepo.dashboard()))
  ipcMain.handle('report:summary', safe((filters: any) => ReportsRepo.summary(filters)))

  // App info
  ipcMain.handle('app:info', safe(() => ({ version: app.getVersion(), dbPath: getDbPath() })))

  // Backup
  ipcMain.handle(
    'backup',
    safe(async () => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const res = await dialog.showSaveDialog(win!, {
        title: 'حفظ نسخة احتياطية',
        defaultPath: `studio-backup-${stamp}.db`,
        filters: [{ name: 'قاعدة بيانات', extensions: ['db'] }],
        buttonLabel: 'حفظ'
      })
      if (res.canceled || !res.filePath) return { canceled: true as const }
      copyFileSync(getDbPath(), res.filePath)
      return { path: res.filePath }
    })
  )

  // Restore
  ipcMain.handle(
    'restore',
    safe(async () => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const res = await dialog.showOpenDialog(win!, {
        title: 'استعادة من نسخة احتياطية',
        filters: [{ name: 'قاعدة بيانات', extensions: ['db'] }],
        properties: ['openFile'],
        buttonLabel: 'استعادة'
      })
      if (res.canceled || !res.filePaths[0]) return { canceled: true as const }
      const src = res.filePaths[0]
      if (!existsSync(src)) throw new Error('الملف غير موجود')
      const confirm = await dialog.showMessageBox(win!, {
        type: 'warning',
        message: 'هل أنت متأكد من استعادة هذه النسخة؟ سيتم استبدال البيانات الحالية بالكامل.',
        buttons: ['استعادة', 'إلغاء'],
        cancelId: 1,
        defaultId: 1
      })
      if (confirm.response === 1) return { canceled: true as const }
      closeDb()
      copyFileSync(src, getDbPath())
      initDb()
      win?.webContents.reload()
      return { ok: true as const }
    })
  )

  // Auto-backup
  ipcMain.handle(
    'autoBackup:pickDir',
    safe(async () => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const res = await dialog.showOpenDialog(win!, {
        title: 'اختر مجلد للنسخ الاحتياطي التلقائي',
        properties: ['openDirectory', 'createDirectory']
      })
      if (res.canceled || !res.filePaths[0]) return { canceled: true as const }
      SettingsRepo.set('auto_backup_dir', res.filePaths[0])
      return { path: res.filePaths[0] }
    })
  )
  ipcMain.handle('autoBackup:runNow', safe(() => ({ path: autoBackupNow() })))

  // Export PDF report
  ipcMain.handle(
    'export:reportPDF',
    safe(async (filters: any) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const stamp = new Date().toISOString().slice(0, 10)
      const res = await dialog.showSaveDialog(win!, {
        title: 'حفظ التقرير PDF',
        defaultPath: `report-${stamp}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (res.canceled || !res.filePath) return { canceled: true as const }
      const summary = ReportsRepo.summary(filters)
      const settings = SettingsRepo.all()
      await exportReportPDF(res.filePath, summary, filters, settings)
      shell.showItemInFolder(res.filePath)
      return { path: res.filePath }
    })
  )

  // Export Excel report
  ipcMain.handle(
    'export:reportExcel',
    safe(async (filters: any) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const stamp = new Date().toISOString().slice(0, 10)
      const res = await dialog.showSaveDialog(win!, {
        title: 'حفظ التقرير Excel',
        defaultPath: `report-${stamp}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      })
      if (res.canceled || !res.filePath) return { canceled: true as const }
      const summary = ReportsRepo.summary(filters)
      const settings = SettingsRepo.all()
      await exportReportExcel(res.filePath, summary, filters, settings)
      shell.showItemInFolder(res.filePath)
      return { path: res.filePath }
    })
  )

  // Print transaction
  ipcMain.handle(
    'print:transaction',
    safe(async (id: number) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const tx = TransactionsRepo.get(id)
      if (!tx) throw new Error('المعاملة غير موجودة')
      const settings = SettingsRepo.all()
      // Always use a unique filename: avoids EBUSY when the previous PDF is
      // still open in the user's PDF viewer (very common on Windows).
      const tmpPath = uniqueTempPdf(`receipt-${tx.transaction_no}`)
      await exportReceiptPDF(tmpPath, tx, settings)
      const res = await dialog.showSaveDialog(win!, {
        title: 'حفظ الفاتورة PDF',
        defaultPath: `receipt-${tx.transaction_no}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (res.canceled || !res.filePath) {
        shell.openPath(tmpPath)
        return { path: tmpPath }
      }
      try {
        copyFileSync(tmpPath, res.filePath)
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code
        if (code === 'EBUSY' || code === 'EPERM') {
          throw new Error('الملف مفتوح في برنامج آخر. أغلقه ثم حاول مرة أخرى.')
        }
        throw e
      }
      shell.showItemInFolder(res.filePath)
      return { path: res.filePath }
    })
  )

  // WhatsApp share
  ipcMain.handle(
    'whatsapp:share',
    safe(async (id: number, phoneOverride?: string | null) => {
      const tx = TransactionsRepo.get(id)
      if (!tx) throw new Error('المعاملة غير موجودة')
      const settings = SettingsRepo.all()
      const business = settings.business_name || 'نظام إدارة الاستوديو'
      const currency = settings.currency_symbol || 'ج.م'
      const lines: string[] = [
        `*${business}*`,
        `فاتورة رقم: ${tx.transaction_no}`,
        `التاريخ: ${tx.date}`,
        ...tx.lines.map((l) => `• ${l.item_name || l.custom_name} × ${l.quantity} = ${l.subtotal} ${currency}`),
        `الإجمالي: ${tx.total} ${currency}`,
        tx.remaining > 0 ? `الباقي: ${tx.remaining} ${currency}` : 'مدفوعة بالكامل ✓',
        '',
        'شكراً لتعاملكم معنا.'
      ]
      const text = encodeURIComponent(lines.join('\n'))
      let phone = (phoneOverride || '').replace(/[^0-9]/g, '')
      if (!phone && tx.client_id) {
        const c = ClientsRepo.get(tx.client_id)
        phone = (c?.phone || '').replace(/[^0-9]/g, '')
      }
      if (phone && phone.startsWith('0') && phone.length === 11) phone = '2' + phone
      const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
      try {
        clipboard.writeText(url)
      } catch {
        // ignore
      }
      const opened = await openUrlRobust(url)
      const tmpPath = uniqueTempPdf(`receipt-${tx.transaction_no}`)
      exportReceiptPDF(tmpPath, tx, settings)
        .then(() => {
          shell.openPath(tmpPath).catch(() => {})
        })
        .catch(() => {})
      return { url, opened, phone: phone || null, pdfPath: tmpPath }
    })
  )
}
