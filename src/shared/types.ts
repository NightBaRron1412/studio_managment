// Shared between main process and renderer

export type ID = number

export interface Category {
  id: ID
  name_ar: string
  sort_order: number
  icon: string | null
}

export interface Item {
  id: ID
  category_id: ID | null
  category_name?: string | null
  name_ar: string
  size: string | null
  default_price: number
  is_active: number
  notes: string | null
  created_at: string
}

export interface Client {
  id: ID
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface ClientWithStats extends Client {
  total_spent: number
  visit_count: number
  last_visit: string | null
  outstanding?: number
}

export type DiscountType = 'percent' | 'fixed' | null

export interface Transaction {
  id: ID
  transaction_no: string
  date: string
  client_id: ID | null
  client_name?: string | null
  staff_name: string | null
  notes: string | null
  subtotal: number
  discount_type: DiscountType
  discount_value: number
  discount_amount: number
  vat_percent: number
  vat_amount: number
  total: number
  paid_amount: number
  payment_method: string | null
  pickup_status: PickupStatus
  pickup_promised_date: string | null
  pickup_delivered_at: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface TransactionLine {
  id: ID
  transaction_id: ID
  item_id: ID | null
  item_name?: string | null
  custom_name: string | null
  quantity: number
  unit_price: number
  subtotal: number
  note: string | null
}

export interface TransactionWithLines extends Transaction {
  lines: TransactionLine[]
  remaining: number
  is_paid: boolean
}

export interface Withdrawal {
  id: ID
  date: string
  amount: number
  withdrawn_by: string | null
  reason: string | null
  created_at: string
  deleted_at?: string | null
}

export interface RentPayment {
  id: ID
  payment_date: string
  period_year: number
  period_month: number
  amount: number
  note: string | null
  created_at: string
  deleted_at?: string | null
}

export interface InventoryPurchase {
  id: ID
  date: string
  item_name: string
  quantity: number
  cost: number
  supplier: string | null
  note: string | null
  created_at: string
  deleted_at?: string | null
}

export type BookingStatus = 'scheduled' | 'completed' | 'cancelled'
export interface Booking {
  id: ID
  date: string
  time: string | null
  client_id: ID | null
  client_name: string | null
  client_phone: string | null
  session_type: string
  deposit: number
  status: BookingStatus
  note: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface Reminder {
  id: ID
  text: string
  due_date: string | null
  is_done: number
  created_at: string
}

export type PickupStatus = 'pending' | 'ready' | 'delivered' | null

export interface CashClose {
  id: ID
  date: string
  expected_cash: number
  actual_cash: number
  difference: number
  note: string | null
  created_at: string
}

export interface SettingRow {
  key: string
  value: string
}

export interface DashboardStats {
  income_today: number
  income_month: number
  tx_count_today: number
  tx_count_month: number
  withdrawals_month: number
  inventory_month: number
  rent_paid_month: number
  rent_required_month: number
  rent_remaining_month: number
  net_month: number
  outstanding_total: number
  debtor_count: number
  active_clients_month: number
  pending_pickups: number
  bookings_today: number
  bookings_upcoming: number
  reminders_due: number
  income_week: number
  income_week_prev: number
  top_items: { name: string; quantity: number; revenue: number }[]
}

export interface ReportFilters {
  date_from?: string
  date_to?: string
  category_id?: ID
  item_id?: ID
  client_id?: ID
  staff_name?: string
}

export interface ReportSummary {
  income_total: number
  withdrawals_total: number
  rent_total: number
  inventory_total: number
  net_total: number
  tx_count: number
  by_day: { date: string; income: number; tx_count: number }[]
  by_item: { name: string; quantity: number; revenue: number }[]
  by_category: { name: string; revenue: number }[]
  by_payment_method: { method: string; total: number; count: number }[]
}

export interface DebtorRow {
  client_id: ID
  client_name: string
  client_phone: string | null
  outstanding: number
  open_count: number
  oldest_date: string
}

export interface CashCloseToday {
  date: string
  expected_cash: number
  cash_in: number
  cash_out: number
  rent_paid: number
  inventory_paid: number
  closed: CashClose | null
}

export interface DeletedItem {
  kind: 'transaction' | 'client' | 'withdrawal' | 'rent' | 'inventory'
  id: ID
  label: string
  sub: string
  deleted_at: string
}

export interface TransactionInput {
  date: string
  client_id: ID | null
  staff_name: string | null
  notes: string | null
  payment_method: string | null
  discount_type: DiscountType
  discount_value: number
  vat_percent: number
  paid_amount: number
  pickup_status: PickupStatus
  pickup_promised_date: string | null
  lines: Array<Omit<TransactionLine, 'id' | 'transaction_id' | 'subtotal'>>
}

export interface API {
  // Clients
  clientsList: (q?: string) => Promise<ClientWithStats[]>
  clientGet: (id: ID) => Promise<Client | null>
  clientCreate: (input: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => Promise<Client>
  clientUpdate: (id: ID, input: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>) => Promise<Client>
  clientDelete: (id: ID) => Promise<void>
  clientHistory: (id: ID) => Promise<TransactionWithLines[]>

  // Categories
  categoriesList: () => Promise<Category[]>
  categoryCreate: (input: Omit<Category, 'id'>) => Promise<Category>
  categoryUpdate: (id: ID, input: Partial<Omit<Category, 'id'>>) => Promise<Category>
  categoryDelete: (id: ID) => Promise<void>

  // Items
  itemsList: (opts?: { only_active?: boolean; category_id?: ID }) => Promise<Item[]>
  itemCreate: (input: Omit<Item, 'id' | 'created_at'>) => Promise<Item>
  itemUpdate: (id: ID, input: Partial<Omit<Item, 'id' | 'created_at'>>) => Promise<Item>
  itemDelete: (id: ID) => Promise<void>

  // Transactions
  transactionsList: (filter?: { q?: string; date_from?: string; date_to?: string; client_id?: ID; only_unpaid?: boolean }) => Promise<Transaction[]>
  transactionGet: (id: ID) => Promise<TransactionWithLines | null>
  transactionCreate: (input: TransactionInput) => Promise<TransactionWithLines>
  transactionUpdate: (id: ID, input: TransactionInput) => Promise<TransactionWithLines>
  transactionDelete: (id: ID) => Promise<void>
  transactionMarkPaid: (id: ID, additional: number) => Promise<TransactionWithLines>
  debtorsList: () => Promise<DebtorRow[]>

  // Withdrawals
  withdrawalsList: (filter?: { date_from?: string; date_to?: string }) => Promise<Withdrawal[]>
  withdrawalCreate: (input: Omit<Withdrawal, 'id' | 'created_at' | 'deleted_at'>) => Promise<Withdrawal>
  withdrawalUpdate: (id: ID, input: Partial<Omit<Withdrawal, 'id' | 'created_at' | 'deleted_at'>>) => Promise<Withdrawal>
  withdrawalDelete: (id: ID) => Promise<void>

  // Rent
  rentForMonth: (year: number, month: number) => Promise<{ required: number; paid: number; remaining: number; payments: RentPayment[] }>
  rentPaymentCreate: (input: Omit<RentPayment, 'id' | 'created_at' | 'deleted_at'>) => Promise<RentPayment>
  rentPaymentDelete: (id: ID) => Promise<void>

  // Inventory
  inventoryList: (filter?: { date_from?: string; date_to?: string }) => Promise<InventoryPurchase[]>
  inventoryCreate: (input: Omit<InventoryPurchase, 'id' | 'created_at' | 'deleted_at'>) => Promise<InventoryPurchase>
  inventoryUpdate: (id: ID, input: Partial<Omit<InventoryPurchase, 'id' | 'created_at' | 'deleted_at'>>) => Promise<InventoryPurchase>
  inventoryDelete: (id: ID) => Promise<void>

  // Cash close
  cashCloseToday: () => Promise<CashCloseToday>
  cashCloseSubmit: (input: { date: string; actual_cash: number; note: string | null }) => Promise<CashClose>
  cashCloseList: () => Promise<CashClose[]>

  // Recycle bin
  recycleList: () => Promise<DeletedItem[]>
  recycleRestore: (kind: DeletedItem['kind'], id: ID) => Promise<void>
  recyclePurge: (kind: DeletedItem['kind'], id: ID) => Promise<void>
  recycleEmpty: () => Promise<void>

  // Settings
  settingsAll: () => Promise<Record<string, string>>
  settingSet: (key: string, value: string) => Promise<void>

  // Bookings
  bookingsList: (filter?: { date_from?: string; date_to?: string; status?: BookingStatus }) => Promise<Booking[]>
  bookingGet: (id: ID) => Promise<Booking | null>
  bookingCreate: (input: Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => Promise<Booking>
  bookingUpdate: (id: ID, input: Partial<Omit<Booking, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>) => Promise<Booking>
  bookingDelete: (id: ID) => Promise<void>

  // Reminders
  remindersList: (only_open?: boolean) => Promise<Reminder[]>
  reminderCreate: (input: Omit<Reminder, 'id' | 'created_at' | 'is_done'> & { is_done?: number }) => Promise<Reminder>
  reminderToggle: (id: ID, done: boolean) => Promise<Reminder>
  reminderDelete: (id: ID) => Promise<void>

  // Transactions: pickup
  transactionMarkPickup: (id: ID, status: PickupStatus) => Promise<TransactionWithLines>
  pendingPickupsList: () => Promise<Transaction[]>

  // Smart suggestions
  clientSuggestedItems: (clientId: ID) => Promise<{ item_id: ID; name: string; default_price: number; count: number }[]>

  // Logo
  pickLogo: () => Promise<{ path: string } | { canceled: true }>
  clearLogo: () => Promise<void>

  // PIN
  pinSet: (pin: string) => Promise<void>
  pinClear: () => Promise<void>
  pinVerify: (pin: string) => Promise<boolean>

  // Updates
  updateCheck: () => Promise<{ available: boolean; version?: string; error?: string }>

  // Excel client export
  exportClientsExcel: () => Promise<{ path: string } | { canceled: true }>

  // Dashboard / Reports
  dashboard: () => Promise<DashboardStats>
  reportSummary: (filters: ReportFilters) => Promise<ReportSummary>

  // Backup / Restore / Export
  backup: () => Promise<{ path: string } | { canceled: true }>
  restore: () => Promise<{ ok: true } | { canceled: true }>
  pickAutoBackupDir: () => Promise<{ path: string } | { canceled: true }>
  runAutoBackupNow: () => Promise<{ path: string }>
  exportReportPDF: (filters: ReportFilters) => Promise<{ path: string } | { canceled: true }>
  exportReportExcel: (filters: ReportFilters) => Promise<{ path: string } | { canceled: true }>
  printTransaction: (id: ID) => Promise<{ path: string } | { canceled: true }>
  whatsappShareTransaction: (id: ID, phone?: string | null) => Promise<{
    url: string
    opened: boolean
    phone: string | null
    pdfPath: string
  }>
  appInfo: () => Promise<{ version: string; dbPath: string }>
}
