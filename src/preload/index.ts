import { contextBridge, ipcRenderer } from 'electron'

function call<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args).then((res) => {
    if (res && typeof res === 'object' && '__error' in res) {
      throw new Error((res as { __error: string }).__error)
    }
    return res as T
  })
}

const api = {
  // Clients
  clientsList: (q?: string) => call('clients:list', q),
  clientGet: (id: number) => call('client:get', id),
  clientCreate: (input: unknown) => call('client:create', input),
  clientUpdate: (id: number, input: unknown) => call('client:update', id, input),
  clientDelete: (id: number) => call('client:delete', id),
  clientHistory: (id: number) => call('client:history', id),
  clientSuggestedItems: (id: number) => call('client:suggestedItems', id),

  // Categories
  categoriesList: () => call('categories:list'),
  categoryCreate: (input: unknown) => call('category:create', input),
  categoryUpdate: (id: number, input: unknown) => call('category:update', id, input),
  categoryDelete: (id: number) => call('category:delete', id),

  // Items
  itemsList: (opts?: unknown) => call('items:list', opts),
  itemCreate: (input: unknown) => call('item:create', input),
  itemUpdate: (id: number, input: unknown) => call('item:update', id, input),
  itemDelete: (id: number) => call('item:delete', id),

  // Transactions
  transactionsList: (filter?: unknown) => call('transactions:list', filter),
  transactionGet: (id: number) => call('transaction:get', id),
  transactionCreate: (input: unknown) => call('transaction:create', input),
  transactionUpdate: (id: number, input: unknown) => call('transaction:update', id, input),
  transactionDelete: (id: number) => call('transaction:delete', id),
  transactionMarkPaid: (id: number, additional: number) => call('transaction:markPaid', id, additional),
  transactionMarkPickup: (id: number, status: string | null) => call('transaction:markPickup', id, status),
  debtorsList: () => call('debtors:list'),
  pendingPickupsList: () => call('pickups:pending'),

  // Bookings
  bookingsList: (filter?: unknown) => call('bookings:list', filter),
  bookingGet: (id: number) => call('booking:get', id),
  bookingCreate: (input: unknown) => call('booking:create', input),
  bookingUpdate: (id: number, input: unknown) => call('booking:update', id, input),
  bookingDelete: (id: number) => call('booking:delete', id),

  // Reminders
  remindersList: (only_open?: boolean) => call('reminders:list', only_open),
  reminderCreate: (input: unknown) => call('reminder:create', input),
  reminderToggle: (id: number, done: boolean) => call('reminder:toggle', id, done),
  reminderDelete: (id: number) => call('reminder:delete', id),

  // Withdrawals
  withdrawalsList: (filter?: unknown) => call('withdrawals:list', filter),
  withdrawalCreate: (input: unknown) => call('withdrawal:create', input),
  withdrawalUpdate: (id: number, input: unknown) => call('withdrawal:update', id, input),
  withdrawalDelete: (id: number) => call('withdrawal:delete', id),

  // Rent
  rentForMonth: (year: number, month: number) => call('rent:forMonth', year, month),
  rentPaymentCreate: (input: unknown) => call('rent:create', input),
  rentPaymentDelete: (id: number) => call('rent:delete', id),

  // Inventory
  inventoryList: (filter?: unknown) => call('inventory:list', filter),
  inventoryCreate: (input: unknown) => call('inventory:create', input),
  inventoryUpdate: (id: number, input: unknown) => call('inventory:update', id, input),
  inventoryDelete: (id: number) => call('inventory:delete', id),

  // Cash close
  cashCloseToday: () => call('cashClose:today'),
  cashCloseSubmit: (input: unknown) => call('cashClose:submit', input),
  cashCloseList: () => call('cashClose:list'),

  // Recycle
  recycleList: () => call('recycle:list'),
  recycleRestore: (kind: string, id: number) => call('recycle:restore', kind, id),
  recyclePurge: (kind: string, id: number) => call('recycle:purge', kind, id),
  recycleEmpty: () => call('recycle:empty'),

  // Settings
  settingsAll: () => call('settings:all'),
  settingSet: (key: string, value: string) => call('setting:set', key, value),

  // Logo
  pickLogo: () => call('logo:pick'),
  clearLogo: () => call('logo:clear'),

  // PIN
  pinSet: (pin: string) => call('pin:set', pin),
  pinClear: () => call('pin:clear'),
  pinVerify: (pin: string) => call('pin:verify', pin),

  // Updates
  updateCheck: () => call('update:check'),
  updateDownload: () => call('update:download'),
  updateInstall: () => call('update:install'),
  onUpdateProgress: (cb: (p: unknown) => void) => {
    const listener = (_e: unknown, p: unknown): void => cb(p)
    ipcRenderer.on('update:progress', listener)
    return () => ipcRenderer.removeListener('update:progress', listener)
  },
  onUpdateDownloaded: (cb: (info: unknown) => void) => {
    const listener = (_e: unknown, info: unknown): void => cb(info)
    ipcRenderer.on('update:downloaded', listener)
    return () => ipcRenderer.removeListener('update:downloaded', listener)
  },
  onUpdateError: (cb: (info: unknown) => void) => {
    const listener = (_e: unknown, info: unknown): void => cb(info)
    ipcRenderer.on('update:error', listener)
    return () => ipcRenderer.removeListener('update:error', listener)
  },

  // System reset
  systemResetData: () => call('system:resetData'),
  systemResetAll: () => call('system:resetAll'),

  // Dashboard / Reports
  dashboard: () => call('dashboard'),
  reportSummary: (filters: unknown) => call('report:summary', filters),

  // Backup / Restore / Export
  backup: () => call('backup'),
  restore: () => call('restore'),
  pickAutoBackupDir: () => call('autoBackup:pickDir'),
  runAutoBackupNow: () => call('autoBackup:runNow'),
  exportReportPDF: (filters: unknown) => call('export:reportPDF', filters),
  exportReportExcel: (filters: unknown) => call('export:reportExcel', filters),
  exportClientsExcel: () => call('export:clientsExcel'),
  printTransaction: (id: number) => call('print:transaction', id),
  whatsappShareTransaction: (id: number, phone?: string | null) => call('whatsapp:share', id, phone),
  appInfo: () => call('app:info')
}

contextBridge.exposeInMainWorld('api', api)
