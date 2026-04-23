import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Client, Item, TransactionLine, DiscountType, PickupStatus } from '@shared/types'
import { PageHeader } from '@/components/PageHeader'
import { ClientPicker } from '@/components/ClientPicker'
import { ItemPicker } from '@/components/ItemPicker'
import { fmtMoney, todayISO } from '@/lib/format'
import { Plus, Search, Trash2, FilePenLine, ShoppingBag, Percent, Receipt as ReceiptIcon, PackageOpen, Sparkles } from 'lucide-react'
import { toast } from '@/store/toast'

interface DraftLine {
  key: string
  item_id: number | null
  item_name: string
  custom_name: string | null
  quantity: number
  unit_price: number
  note: string | null
}

let lineKey = 0
const newKey = (): string => `l-${++lineKey}-${Date.now()}`

export function NewTransaction(): JSX.Element {
  const { id } = useParams<{ id?: string }>()
  const editing = !!id
  const nav = useNavigate()
  const loc = useLocation()
  const qc = useQueryClient()

  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: () => api.settingsAll() })
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.staffList({ only_active: true })
  })
  const vatEnabled = settings.vat_enabled === 'true'
  const defaultVat = Number(settings.vat_default_percent) || 0

  const [date, setDate] = useState(todayISO())
  const [client, setClient] = useState<Client | null>(null)
  const [staff, setStaff] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('نقدي')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const [discountType, setDiscountType] = useState<DiscountType>(null)
  const [discountValue, setDiscountValue] = useState('0')
  const [vatPercent, setVatPercent] = useState<string>(vatEnabled ? String(defaultVat) : '0')
  const [paidAmount, setPaidAmount] = useState('')
  const [paidTouched, setPaidTouched] = useState(false)
  // Default to "قيد التحضير" — most studio orders aren't handed over the
  // same minute they're paid for, so making this the default reduces clicks
  // and makes the طلبات قيد التسليم list reflect reality without owners
  // having to remember to flip the dropdown each time.
  const [pickupStatus, setPickupStatus] = useState<PickupStatus>('pending')
  const [pickupDate, setPickupDate] = useState('')

  // Load existing transaction (for editing) OR duplicate from state
  const dupSource = (loc.state as { duplicateFrom?: number } | null)?.duplicateFrom
  const { data: existing } = useQuery({
    queryKey: ['transaction', id ?? `dup-${dupSource}`],
    queryFn: () => api.transactionGet(Number(id ?? dupSource)),
    enabled: editing || !!dupSource
  })

  useEffect(() => {
    if (existing) {
      if (editing) setDate(existing.date)
      setStaff(existing.staff_name || '')
      setPaymentMethod(existing.payment_method || 'نقدي')
      setNotes(existing.notes || '')
      setDiscountType(existing.discount_type)
      setDiscountValue(String(existing.discount_value || 0))
      setVatPercent(String(existing.vat_percent || 0))
      if (editing) {
        setPaidAmount(String(existing.paid_amount || 0))
        setPaidTouched(true)
        setPickupStatus(existing.pickup_status)
        setPickupDate(existing.pickup_promised_date || '')
      }
      setLines(
        existing.lines.map((l: TransactionLine) => ({
          key: newKey(),
          item_id: l.item_id,
          item_name: l.item_name || l.custom_name || '',
          custom_name: l.custom_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          note: l.note
        }))
      )
      if (existing.client_id && editing) {
        api.clientGet(existing.client_id).then((c) => setClient(c))
      }
    }
  }, [existing, editing])

  // Default VAT to 0 unless user toggled it on while editing/new
  useEffect(() => {
    if (!editing && !dupSource) {
      setVatPercent(vatEnabled ? String(defaultVat) : '0')
    }
  }, [vatEnabled, defaultVat, editing, dupSource])

  // Smart suggestions for the picked client
  const { data: suggested = [] } = useQuery({
    queryKey: ['client-suggested', client?.id],
    queryFn: () => api.clientSuggestedItems(client!.id),
    enabled: !!client?.id
  })

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)
    let discount_amount = 0
    if (discountType === 'percent') {
      discount_amount = subtotal * ((Number(discountValue) || 0) / 100)
    } else if (discountType === 'fixed') {
      discount_amount = Number(discountValue) || 0
    }
    discount_amount = Math.min(discount_amount, subtotal)
    const taxable = subtotal - discount_amount
    const vat_amount = taxable * ((Number(vatPercent) || 0) / 100)
    const total = Number((taxable + vat_amount).toFixed(2))
    return { subtotal, discount_amount, vat_amount, total }
  }, [lines, discountType, discountValue, vatPercent])

  // Auto-fill paid amount with the total when user hasn't edited it.
  // Skip when we're loading an existing transaction — the existing-effect
  // sets paidAmount/paidTouched, but if this auto-fill ran in the same
  // effect phase it would race and clobber paidAmount with the (still-stale)
  // totals.total value of 0, leaving the field stuck at zero forever.
  useEffect(() => {
    if (existing) return
    if (!paidTouched) setPaidAmount(String(totals.total.toFixed(2)))
  }, [totals.total, paidTouched, existing])

  const remaining = Math.max(0, totals.total - (Number(paidAmount) || 0))

  const addItem = (it: Item): void => {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        item_id: it.id,
        item_name: it.name_ar,
        custom_name: null,
        quantity: 1,
        unit_price: it.default_price,
        note: null
      }
    ])
  }

  const addCustom = (): void => {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        item_id: null,
        item_name: 'صنف مخصص',
        custom_name: '',
        quantity: 1,
        unit_price: 0,
        note: null
      }
    ])
  }

  const updateLine = (key: string, patch: Partial<DraftLine>): void => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  const removeLine = (key: string): void => {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        date,
        client_id: client?.id ?? null,
        staff_name: staff.trim() || null,
        notes: notes.trim() || null,
        payment_method: paymentMethod || null,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        vat_percent: Number(vatPercent) || 0,
        paid_amount: Math.min(Number(paidAmount) || 0, totals.total),
        pickup_status: pickupStatus,
        pickup_promised_date: pickupDate || null,
        lines: lines.map((l) => ({
          item_id: l.item_id,
          custom_name: l.item_id ? null : (l.custom_name || l.item_name || 'صنف').trim(),
          quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) || 0,
          note: l.note || null
        }))
      }
      return editing ? api.transactionUpdate(Number(id), payload) : api.transactionCreate(payload)
    },
    onSuccess: (tx) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      // Invalidate the single-transaction cache key TransactionDetail reads,
      // otherwise the redirect lands on a stale view of the unedited row.
      qc.invalidateQueries({ queryKey: ['transaction', String(tx.id)] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['debtors'] })
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      toast.success(editing ? 'تم حفظ التعديل' : 'تم حفظ المعاملة')
      // Surface any items that this sale drove to/below zero so the owner
      // remembers to restock. The repo attaches negative_stock_items only
      // when at least one tracked item went non-positive.
      const neg = tx.negative_stock_items
      if (neg && neg.length) {
        const list = neg.map((n) => `${n.name} (${n.stock})`).join(' • ')
        toast.error(`⚠️ المخزون نفد: ${list}`)
      }
      nav(`/transactions/${tx.id}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  // Customer + staff are required so every sale traces to who-bought-from-whom.
  const canSave =
    !!client &&
    !!staff.trim() &&
    lines.length > 0 &&
    lines.every((l) => (l.item_id || (l.custom_name || l.item_name).trim()) && Number(l.quantity) > 0)

  return (
    <>
      <PageHeader
        title={editing ? 'تعديل معاملة' : 'معاملة جديدة'}
        subtitle="سجّل عملية بيع جديدة وأضف الأصناف بسرعة"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">التاريخ</label>
                <input
                  type="date"
                  className="input num"
                  dir="ltr"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">العميل *</label>
                <ClientPicker value={client} onChange={setClient} />
                {client && suggested.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-ink-muted flex items-center gap-1 mb-1">
                      <Sparkles size={12} className="text-brand-500" />
                      عادةً يطلب:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggested.map((s) => (
                        <button
                          key={s.item_id}
                          className="chip hover:bg-brand-100"
                          title={`أضف ${s.name} (طُلب ${s.count} مرة)`}
                          onClick={() =>
                            setLines((prev) => [
                              ...prev,
                              {
                                key: newKey(),
                                item_id: s.item_id,
                                item_name: s.name,
                                custom_name: null,
                                quantity: 1,
                                unit_price: s.default_price,
                                note: null
                              }
                            ])
                          }
                        >
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="label">طريقة الدفع</label>
                <select
                  className="input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option>نقدي</option>
                  <option>بطاقة</option>
                  <option>تحويل بنكي</option>
                  <option>محفظة إلكترونية</option>
                  <option>آجل</option>
                </select>
              </div>
              <div>
                <label className="label">الموظف *</label>
                {staffList.length > 0 ? (
                  <select
                    className="input"
                    value={staff}
                    onChange={(e) => setStaff(e.target.value)}
                  >
                    <option value="">— اختر الموظف —</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    className="input text-right text-ink-muted hover:bg-bg-subtle"
                    onClick={() => nav('/settings')}
                  >
                    أضف الموظفين من الإعدادات أولاً ←
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-bg-subtle flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-brand-600" />
                <h3 className="font-bold text-ink">الأصناف</h3>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary btn-sm" onClick={addCustom}>
                  <FilePenLine size={16} />
                  صنف مخصص
                </button>
                <button className="btn-primary btn-sm" onClick={() => setPickerOpen(true)}>
                  <Plus size={16} />
                  إضافة صنف
                </button>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="py-12 text-center">
                <button className="btn-primary btn-lg" onClick={() => setPickerOpen(true)}>
                  <Search size={18} />
                  اختر صنفاً للبدء
                </button>
                <div className="mt-3 text-sm text-ink-muted">أو أضف صنفاً مخصصاً يدوياً</div>
              </div>
            ) : (
              <div className="divide-y divide-bg-subtle">
                {lines.map((l, idx) => (
                  <div key={l.key} className="p-4 grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-12 md:col-span-5">
                      <label className="label text-xs">الصنف #{idx + 1}</label>
                      {l.item_id ? (
                        <div className="input bg-brand-50 dark:bg-brand-700/25 border-brand-100 dark:border-brand-700/40 text-ink font-bold">
                          {l.item_name}
                        </div>
                      ) : (
                        <input
                          className="input"
                          placeholder="اسم الصنف المخصص"
                          value={l.custom_name ?? ''}
                          onChange={(e) => updateLine(l.key, { custom_name: e.target.value, item_name: e.target.value })}
                        />
                      )}
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <label className="label text-xs">الكمية</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="input num text-center"
                        value={l.quantity}
                        onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <label className="label text-xs">السعر</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="input num text-center"
                        value={l.unit_price}
                        onChange={(e) => updateLine(l.key, { unit_price: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2 text-center">
                      <label className="label text-xs">الإجمالي</label>
                      <div className="font-bold text-brand-700 num text-base py-2.5">
                        {fmtMoney(l.quantity * l.unit_price)}
                      </div>
                    </div>
                    <div className="col-span-12 md:col-span-1 flex md:justify-end">
                      <button
                        className="btn-ghost btn-sm text-bad hover:bg-red-50"
                        onClick={() => removeLine(l.key)}
                        aria-label="حذف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="col-span-12">
                      <input
                        className="input text-sm"
                        placeholder="ملاحظة على الصنف (اختياري)"
                        value={l.note ?? ''}
                        onChange={(e) => updateLine(l.key, { note: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discount + VAT card */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Percent size={18} className="text-brand-600" />
              <h3 className="font-bold text-ink">الخصم والضريبة (اختياري)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">نوع الخصم</label>
                <select
                  className="input"
                  value={discountType ?? ''}
                  onChange={(e) => {
                    const v = e.target.value as '' | 'percent' | 'fixed'
                    setDiscountType(v === '' ? null : v)
                    if (v === '') setDiscountValue('0')
                  }}
                >
                  <option value="">بدون خصم</option>
                  <option value="percent">نسبة مئوية %</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
              </div>
              <div>
                <label className="label">قيمة الخصم</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  disabled={!discountType}
                  className="input num text-center disabled:bg-bg-subtle disabled:text-ink-soft"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
              {vatEnabled && (
                <div>
                  <label className="label">ضريبة القيمة المضافة %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="input num text-center"
                    value={vatPercent}
                    onChange={(e) => setVatPercent(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <PackageOpen size={18} className="text-brand-600" />
              <h3 className="font-bold text-ink">حالة التسليم</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">الحالة</label>
                <select
                  className="input"
                  value={pickupStatus ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setPickupStatus(v === '' ? null : (v as PickupStatus))
                  }}
                >
                  <option value="">سُلِّم فوراً</option>
                  <option value="pending">قيد التحضير</option>
                  <option value="ready">جاهز للاستلام</option>
                </select>
              </div>
              <div>
                <label className="label">تاريخ التسليم المتوقع</label>
                <input
                  type="date"
                  className="input num"
                  dir="ltr"
                  disabled={!pickupStatus}
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-ink-muted mt-2">
              غيّرها إلى "سُلِّم فوراً" إذا أخذ العميل المنتج معه الآن.
            </p>
          </div>

          <div className="card p-5">
            <label className="label">ملاحظات على المعاملة</label>
            <textarea
              className="input"
              rows={3}
              placeholder="ملاحظات اختيارية للسجل"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 self-start">
          <div className="card p-6 space-y-3">
            <div className="text-sm text-ink-muted">إجمالي المعاملة</div>
            <div className="text-4xl font-extrabold num">{fmtMoney(totals.total)}</div>

            <div className="space-y-2 text-sm border-t border-bg-subtle pt-3 mt-3">
              <div className="flex justify-between text-ink-muted">
                <span>المجموع قبل الخصم</span>
                <span className="num">{fmtMoney(totals.subtotal)}</span>
              </div>
              {totals.discount_amount > 0 && (
                <div className="flex justify-between text-bad">
                  <span>الخصم</span>
                  <span className="num">- {fmtMoney(totals.discount_amount)}</span>
                </div>
              )}
              {totals.vat_amount > 0 && (
                <div className="flex justify-between text-warn">
                  <span>ضريبة القيمة المضافة</span>
                  <span className="num">+ {fmtMoney(totals.vat_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-muted">
                <span>عدد الأصناف</span>
                <span className="num">{lines.length}</span>
              </div>
            </div>

            <div className="border-t border-bg-subtle pt-3 mt-1 space-y-2">
              <label className="label flex items-center gap-1">
                <ReceiptIcon size={14} />
                المبلغ المدفوع
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input num text-center text-lg"
                value={paidAmount}
                onChange={(e) => {
                  setPaidAmount(e.target.value)
                  setPaidTouched(true)
                }}
              />
              <div className="flex gap-2">
                <button
                  className="chip flex-1 justify-center"
                  onClick={() => {
                    setPaidAmount(String(totals.total.toFixed(2)))
                    setPaidTouched(true)
                  }}
                >
                  دفع كامل
                </button>
                <button
                  className="chip flex-1 justify-center"
                  onClick={() => {
                    setPaidAmount('0')
                    setPaidTouched(true)
                  }}
                >
                  آجل (لم يدفع)
                </button>
              </div>
              {remaining > 0 && (
                <div className="bg-amber-50 text-amber-800 rounded-xl px-3 py-2 text-sm flex justify-between font-bold">
                  <span>الباقي على العميل</span>
                  <span className="num">{fmtMoney(remaining)}</span>
                </div>
              )}
              {remaining <= 0 && totals.total > 0 && (
                <div className="bg-emerald-50 text-emerald-800 rounded-xl px-3 py-2 text-sm flex justify-center font-bold">
                  مدفوعة بالكامل ✓
                </div>
              )}
            </div>

            <button
              className="btn-primary btn-lg w-full"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'جارِ الحفظ...' : editing ? 'حفظ التعديل' : 'حفظ المعاملة'}
            </button>
            <button className="btn-ghost w-full mt-2" onClick={() => nav(-1)}>
              إلغاء
            </button>
          </div>
        </aside>
      </div>

      <ItemPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addItem} />
    </>
  )
}
