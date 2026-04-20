import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney } from '@/lib/format'
import { Plus, Pencil, Trash2, Save, Database, Tag, Package, Building, Download, Upload, Info, Mail, Phone, Heart, Camera, Image as ImageIcon, Lock, Unlock, FileSpreadsheet, RefreshCw, AlertTriangle, Eraser, Bomb, PackagePlus, Users } from 'lucide-react'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'
import type { Category, Item, Staff } from '@shared/types'
import { cn } from '@/lib/cn'

type Tab = 'items' | 'categories' | 'staff' | 'business' | 'security' | 'data' | 'about'

export function Settings(): JSX.Element {
  const [tab, setTab] = useState<Tab>('items')

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="إدارة الأصناف والتصنيفات وبيانات المحل" />

      <div className="card overflow-hidden">
        <div className="border-b border-bg-subtle flex flex-wrap">
          <TabButton active={tab === 'items'} onClick={() => setTab('items')} icon={<Package size={16} />}>الأصناف والأسعار</TabButton>
          <TabButton active={tab === 'categories'} onClick={() => setTab('categories')} icon={<Tag size={16} />}>التصنيفات</TabButton>
          <TabButton active={tab === 'staff'} onClick={() => setTab('staff')} icon={<Users size={16} />}>الموظفون</TabButton>
          <TabButton active={tab === 'business'} onClick={() => setTab('business')} icon={<Building size={16} />}>بيانات المحل</TabButton>
          <TabButton active={tab === 'security'} onClick={() => setTab('security')} icon={<Lock size={16} />}>الحماية</TabButton>
          <TabButton active={tab === 'data'} onClick={() => setTab('data')} icon={<Database size={16} />}>البيانات والنسخ الاحتياطي</TabButton>
          <TabButton active={tab === 'about'} onClick={() => setTab('about')} icon={<Info size={16} />}>حول البرنامج</TabButton>
        </div>
        <div className="p-5">
          {tab === 'items' && <ItemsTab />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'staff' && <StaffTab />}
          {tab === 'business' && <BusinessTab />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'data' && <DataTab />}
          {tab === 'about' && <AboutTab />}
        </div>
      </div>
    </>
  )
}

function TabButton({
  active,
  onClick,
  children,
  icon
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-5 py-3.5 font-semibold text-sm flex items-center gap-2 border-b-2 transition',
        active
          ? 'border-brand-600 text-brand-700 bg-brand-50/40'
          : 'border-transparent text-ink-muted hover:text-ink hover:bg-bg-subtle/50'
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function ItemsTab(): JSX.Element {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [delId, setDelId] = useState<number | null>(null)

  const { data: items = [] } = useQuery({ queryKey: ['items', 'all-settings'], queryFn: () => api.itemsList() })
  const { data: cats = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categoriesList() })

  const [name, setName] = useState('')
  const [size, setSize] = useState('')
  const [price, setPrice] = useState('')
  const [catId, setCatId] = useState<number | null>(null)
  const [active, setActive] = useState(true)
  const [tracksStock, setTracksStock] = useState(false)
  const [stockQty, setStockQty] = useState('')
  const [lowStock, setLowStock] = useState('')

  // Restock dialog state — separate from the item edit dialog so adding
  // stock to an existing item doesn't reopen the full edit form.
  const [restockItem, setRestockItem] = useState<Item | null>(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockCost, setRestockCost] = useState('')
  const [restockSupplier, setRestockSupplier] = useState('')

  const openNew = (): void => {
    setEditing(null)
    setName('')
    setSize('')
    setPrice('')
    setCatId(cats[0]?.id ?? null)
    setActive(true)
    setTracksStock(false)
    setStockQty('')
    setLowStock('')
    setOpen(true)
  }
  const openEdit = (it: Item): void => {
    setEditing(it)
    setName(it.name_ar)
    setSize(it.size || '')
    setPrice(String(it.default_price))
    setCatId(it.category_id)
    setActive(!!it.is_active)
    setTracksStock(!!it.tracks_stock)
    setStockQty(String(it.stock_qty ?? 0))
    setLowStock(String(it.low_stock_threshold ?? 0))
    setOpen(true)
  }
  const openRestock = (it: Item): void => {
    setRestockItem(it)
    setRestockQty('')
    setRestockCost('')
    setRestockSupplier('')
  }

  const save = useMutation({
    mutationFn: () => {
      const input = {
        category_id: catId,
        name_ar: name,
        size: size || null,
        default_price: Number(price) || 0,
        is_active: active ? 1 : 0,
        notes: null,
        tracks_stock: tracksStock ? 1 : 0,
        stock_qty: tracksStock ? Number(stockQty) || 0 : 0,
        low_stock_threshold: tracksStock ? Number(lowStock) || 0 : 0
      }
      return editing ? api.itemUpdate(editing.id, input) : api.itemCreate(input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['items', 'all-settings'] })
      toast.success('تم الحفظ')
      setOpen(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const del = useMutation({
    mutationFn: (id: number) => api.itemDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['items', 'all-settings'] })
      toast.success('تم الحذف')
    }
  })

  const restock = useMutation({
    mutationFn: () =>
      api.itemRestock({
        item_id: restockItem!.id,
        quantity: Number(restockQty) || 0,
        cost: Number(restockCost) || 0,
        supplier: restockSupplier.trim() || null
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['items', 'all-settings'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('تم تزويد المخزون')
      setRestockItem(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل التزويد')
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ink">الأصناف ({items.length})</h3>
        <button className="btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} />
          صنف جديد
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="لا توجد أصناف بعد" hint="أضف أول صنف لتظهر في شاشة المعاملات." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bg-subtle">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>التصنيف</th>
                <th>المقاس</th>
                <th className="text-left">السعر</th>
                <th className="text-center">المخزون</th>
                <th className="text-center">الحالة</th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const tracks = !!it.tracks_stock
                const isOut = tracks && it.stock_qty <= 0
                const isLow = tracks && !isOut && it.stock_qty <= it.low_stock_threshold
                return (
                <tr key={it.id}>
                  <td className="font-semibold">{it.name_ar}</td>
                  <td>{it.category_name || <span className="text-ink-soft">—</span>}</td>
                  <td>{it.size || <span className="text-ink-soft">—</span>}</td>
                  <td className="text-left font-bold num">{fmtMoney(it.default_price)}</td>
                  <td className="text-center">
                    {!tracks ? (
                      <span className="text-ink-soft text-xs">غير متتبَّع</span>
                    ) : (
                      <span
                        className={cn(
                          'chip num text-xs font-bold',
                          isOut
                            ? 'bg-red-50 text-bad'
                            : isLow
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {it.stock_qty}
                        {isLow && !isOut && ' ⚠'}
                        {isOut && ' • نفد'}
                      </span>
                    )}
                  </td>
                  <td className="text-center">
                    <span
                      className={cn(
                        'chip text-xs',
                        it.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-bg-subtle text-ink-muted'
                      )}
                    >
                      {it.is_active ? 'نشط' : 'مؤرشف'}
                    </span>
                  </td>
                  <td className="text-end">
                    {tracks && (
                      <button
                        className="btn-ghost btn-sm text-brand-700 hover:bg-brand-50"
                        onClick={() => openRestock(it)}
                        title="تزويد المخزون"
                      >
                        <PackagePlus size={16} />
                      </button>
                    )}
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(it)}>
                      <Pencil size={16} />
                    </button>
                    <button className="btn-ghost btn-sm text-bad hover:bg-red-50" onClick={() => setDelId(it.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل صنف' : 'صنف جديد'}
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              <Save size={18} />
              حفظ
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">اسم الصنف *</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">التصنيف</label>
              <select className="input" value={catId ?? ''} onChange={(e) => setCatId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">بدون تصنيف</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name_ar}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">المقاس</label>
              <input className="input" placeholder="مثل: 4×6 أو 30×40" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">السعر الافتراضي *</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input num text-center text-lg"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 select-none cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm font-semibold">نشط (يظهر في شاشة المعاملات)</span>
          </label>

          <div className="border-t border-bg-subtle pt-3 mt-1">
            <label className="flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={tracksStock}
                onChange={(e) => setTracksStock(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold">تتبَّع المخزون لهذا الصنف</span>
            </label>
            <div className="text-xs text-ink-muted mr-6 mt-1">
              فعِّلها للأصناف الملموسة (براويز، أقراص...). أبقِها مغلقة للخدمات (جلسات تصوير، تعديل...).
            </div>
            {tracksStock && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label">الكمية الحالية</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input num text-center"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">حد التنبيه</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input num text-center"
                    value={lowStock}
                    onChange={(e) => setLowStock(e.target.value)}
                  />
                  <div className="text-[10px] text-ink-muted mt-1">
                    تنبيه عند الوصول لهذه الكمية (0 = نبِّه فقط عند النفاد).
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!restockItem}
        onClose={() => (restock.isPending ? null : setRestockItem(null))}
        title={`تزويد المخزون — ${restockItem?.name_ar ?? ''}`}
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!restockQty || Number(restockQty) <= 0 || restock.isPending}
              onClick={() => restock.mutate()}
            >
              <PackagePlus size={16} />
              تأكيد التزويد
            </button>
            <button
              className="btn-secondary"
              disabled={restock.isPending}
              onClick={() => setRestockItem(null)}
            >
              إلغاء
            </button>
          </>
        }
      >
        {restockItem && (
          <div className="space-y-3">
            <div className="bg-bg-subtle rounded-xl p-3 flex justify-between text-sm">
              <span className="text-ink-muted">المخزون الحالي</span>
              <span className="num font-bold">{restockItem.stock_qty}</span>
            </div>
            <div>
              <label className="label">الكمية المضافة *</label>
              <input
                type="number"
                min="1"
                step="1"
                className="input num text-center text-lg"
                autoFocus
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">التكلفة الإجمالية (اختياري)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="input num text-center"
                  value={restockCost}
                  onChange={(e) => setRestockCost(e.target.value)}
                />
              </div>
              <div>
                <label className="label">المورِّد (اختياري)</label>
                <input
                  className="input"
                  value={restockSupplier}
                  onChange={(e) => setRestockSupplier(e.target.value)}
                />
              </div>
            </div>
            <div className="text-xs text-ink-muted">
              يضاف للمخزون فوراً، ويُسجَّل في صفحة المشتريات للرجوع إليه.
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && del.mutate(delId)}
        title="حذف الصنف"
        message="سيتم حذف الصنف. المعاملات السابقة ستحتفظ بالبيانات. هل تريد المتابعة؟"
        confirmText="حذف"
        destructive
      />
    </>
  )
}

function CategoriesTab(): JSX.Element {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [delId, setDelId] = useState<number | null>(null)

  const { data: cats = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categoriesList() })

  const openNew = (): void => {
    setEditing(null)
    setName('')
    setOpen(true)
  }
  const openEdit = (c: Category): void => {
    setEditing(c)
    setName(c.name_ar)
    setOpen(true)
  }

  const save = useMutation({
    mutationFn: () => {
      const input = { name_ar: name, sort_order: editing?.sort_order ?? 99, icon: editing?.icon ?? null }
      return editing ? api.categoryUpdate(editing.id, input) : api.categoryCreate(input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('تم الحفظ')
      setOpen(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const del = useMutation({
    mutationFn: (id: number) => api.categoryDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success('تم الحذف')
    }
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ink">التصنيفات ({cats.length})</h3>
        <button className="btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} />
          تصنيف جديد
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cats.map((c) => (
          <div key={c.id} className="card p-4 flex items-center justify-between">
            <span className="font-bold">{c.name_ar}</span>
            <div>
              <button className="btn-ghost btn-sm" onClick={() => openEdit(c)}>
                <Pencil size={14} />
              </button>
              <button className="btn-ghost btn-sm text-bad" onClick={() => setDelId(c.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل تصنيف' : 'تصنيف جديد'}
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              حفظ
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div>
          <label className="label">الاسم *</label>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && del.mutate(delId)}
        title="حذف التصنيف"
        message="هل تريد حذف هذا التصنيف؟ الأصناف المرتبطة ستبقى لكن بدون تصنيف."
        confirmText="حذف"
        destructive
      />
    </>
  )
}

function StaffTab(): JSX.Element {
  const qc = useQueryClient()
  const { data: staff = [] } = useQuery({ queryKey: ['staff', 'all'], queryFn: () => api.staffList() })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [delId, setDelId] = useState<number | null>(null)

  const openNew = (): void => {
    setEditing(null)
    setName('')
    setActive(true)
    setOpen(true)
  }
  const openEdit = (s: Staff): void => {
    setEditing(s)
    setName(s.name)
    setActive(!!s.is_active)
    setOpen(true)
  }

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.staffUpdate(editing.id, { name, is_active: active ? 1 : 0 })
        : api.staffCreate({ name, is_active: active ? 1 : 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['staff', 'all'] })
      toast.success('تم الحفظ')
      setOpen(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const del = useMutation({
    mutationFn: (id: number) => api.staffDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      qc.invalidateQueries({ queryKey: ['staff', 'all'] })
      toast.success('تم الحذف')
    }
  })

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-ink">الموظفون ({staff.length})</h3>
        <button className="btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} />
          موظف جديد
        </button>
      </div>
      {staff.length === 0 ? (
        <EmptyState
          title="لا يوجد موظفون بعد"
          hint="أضف الموظفين هنا لتختارهم من القائمة عند تسجيل أي معاملة بدلاً من كتابة الاسم في كل مرة."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bg-subtle">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th className="text-center">الحالة</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">{s.name}</td>
                  <td className="text-center">
                    <span
                      className={cn(
                        'chip text-xs',
                        s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-bg-subtle text-ink-muted'
                      )}
                    >
                      {s.is_active ? 'نشط' : 'مؤرشف'}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(s)}>
                      <Pencil size={16} />
                    </button>
                    <button
                      className="btn-ghost btn-sm text-bad hover:bg-red-50"
                      onClick={() => setDelId(s.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل موظف' : 'موظف جديد'}
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              <Save size={16} />
              حفظ
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">اسم الموظف *</label>
            <input
              className="input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-semibold">نشط (يظهر في قائمة المعاملات)</span>
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        title="حذف موظف"
        message="هل تريد حذف هذا الموظف؟ المعاملات السابقة تحتفظ بالاسم كنص."
        confirmText="حذف"
        destructive
        onConfirm={() => {
          if (delId !== null) del.mutate(delId)
          setDelId(null)
        }}
      />
    </>
  )
}

function BusinessTab(): JSX.Element {
  const qc = useQueryClient()
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: () => api.settingsAll() })
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [defaultRent, setDefaultRent] = useState('')
  const [currency, setCurrency] = useState('')
  const [numerals, setNumerals] = useState<'western' | 'arabic-indic'>('western')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [vatPercent, setVatPercent] = useState('14')

  useEffect(() => {
    setBusinessName(settings.business_name || '')
    setOwnerName(settings.owner_name || '')
    setPhone(settings.phone || '')
    setAddress(settings.address || '')
    setDefaultRent(settings.default_rent || '')
    setCurrency(settings.currency_symbol || 'ج.م')
    setNumerals((settings.numerals_style as 'western' | 'arabic-indic') || 'western')
    setVatEnabled(settings.vat_enabled === 'true')
    setVatPercent(settings.vat_default_percent || '14')
  }, [settings])

  const save = useMutation({
    mutationFn: async () => {
      await api.settingSet('business_name', businessName)
      await api.settingSet('owner_name', ownerName)
      await api.settingSet('phone', phone)
      await api.settingSet('address', address)
      await api.settingSet('default_rent', String(Number(defaultRent) || 0))
      await api.settingSet('currency_symbol', currency)
      await api.settingSet('numerals_style', numerals)
      await api.settingSet('vat_enabled', vatEnabled ? 'true' : 'false')
      await api.settingSet('vat_default_percent', String(Number(vatPercent) || 0))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم حفظ الإعدادات')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  return (
    <div className="max-w-2xl">
      <h3 className="font-bold text-ink mb-4">بيانات المحل</h3>
      <div className="space-y-4">
        <div>
          <label className="label">اسم المحل</label>
          <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">اسم المالك</label>
            <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <div>
            <label className="label">رقم الهاتف</label>
            <input className="input num" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">العنوان</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">الإيجار الشهري الافتراضي</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input num text-center"
              value={defaultRent}
              onChange={(e) => setDefaultRent(e.target.value)}
            />
          </div>
          <div>
            <label className="label">رمز العملة</label>
            <input className="input text-center" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div>
            <label className="label">شكل الأرقام</label>
            <select className="input" value={numerals} onChange={(e) => setNumerals(e.target.value as 'western' | 'arabic-indic')}>
              <option value="western">٠١٢٣ (غربية: 0123)</option>
              <option value="arabic-indic">عربية شرقية (٠١٢٣)</option>
            </select>
          </div>
        </div>

        <div className="card p-4 bg-bg-subtle/40">
          <label className="flex items-center gap-3 cursor-pointer mb-3">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={vatEnabled}
              onChange={(e) => setVatEnabled(e.target.checked)}
            />
            <span className="font-bold">تفعيل ضريبة القيمة المضافة (VAT)</span>
          </label>
          <p className="text-xs text-ink-muted mb-3">
            عند التفعيل، تظهر خانة الضريبة في شاشة المعاملة وعلى الفواتير المطبوعة.
          </p>
          {vatEnabled && (
            <div>
              <label className="label">النسبة الافتراضية %</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input num text-center max-w-[140px]"
                value={vatPercent}
                onChange={(e) => setVatPercent(e.target.value)}
              />
            </div>
          )}
        </div>

        <LogoSection />

        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          <Save size={18} />
          حفظ الإعدادات
        </button>
      </div>
    </div>
  )
}

function LogoSection(): JSX.Element {
  const qc = useQueryClient()
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: () => api.settingsAll() })
  const logoPath = settings.logo_path || ''
  const onPick = async (): Promise<void> => {
    try {
      const res = await api.pickLogo()
      if ('canceled' in res) return
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('تم رفع الشعار')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل')
    }
  }
  const onClear = async (): Promise<void> => {
    await api.clearLogo()
    qc.invalidateQueries({ queryKey: ['settings'] })
    toast.success('تم حذف الشعار')
  }
  return (
    <div className="card p-4 bg-bg-subtle/40">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon size={18} className="text-brand-600" />
        <h4 className="font-bold">شعار المحل</h4>
      </div>
      <p className="text-xs text-ink-muted mb-3">
        سيظهر الشعار في أعلى الفواتير المطبوعة. يُفضَّل صورة PNG مربعة بخلفية شفافة.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        {logoPath ? (
          <div className="w-20 h-20 rounded-xl bg-bg-card border border-bg-subtle p-2 flex items-center justify-center overflow-hidden">
            <img src={`file://${logoPath}`} alt="logo" className="max-w-full max-h-full" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-xl bg-bg-card border border-dashed border-bg-subtle flex items-center justify-center text-ink-soft">
            <ImageIcon size={24} />
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={onPick}>
            <Upload size={14} />
            {logoPath ? 'تغيير الشعار' : 'رفع شعار'}
          </button>
          {logoPath && (
            <button className="btn-ghost btn-sm text-bad" onClick={onClear}>
              <Trash2 size={14} />
              حذف
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function SecurityTab(): JSX.Element {
  const qc = useQueryClient()
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: () => api.settingsAll() })
  const enabled = settings.pin_enabled === 'true'
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')

  const setPinMut = useMutation({
    mutationFn: () => {
      if (pin !== confirm) throw new Error('الرقم السري غير متطابق')
      return api.pinSet(pin)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('تم تفعيل الرقم السري')
      setPin('')
      setConfirm('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل')
  })

  const clearPinMut = useMutation({
    mutationFn: () => api.pinClear(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('تم إلغاء الرقم السري')
    }
  })

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          {enabled ? <Lock size={18} className="text-brand-600" /> : <Unlock size={18} className="text-ink-muted" />}
          <h3 className="font-bold">قفل البرنامج برقم سري</h3>
        </div>
        <p className="text-sm text-ink-muted mb-4 leading-relaxed">
          عند التفعيل، سيُطلب منك إدخال الرقم السري في كل مرة تفتح فيها البرنامج.
          مفيد إذا كان الجهاز في مكان مفتوح أو يستخدمه أكثر من شخص.
        </p>

        {enabled ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm font-bold flex items-center gap-2">
              <Lock size={16} />
              الرقم السري مُفعَّل
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-danger"
                disabled={clearPinMut.isPending}
                onClick={() => clearPinMut.mutate()}
              >
                <Unlock size={16} />
                إلغاء الرقم السري
              </button>
            </div>
            <div className="border-t border-bg-subtle pt-3 mt-3">
              <div className="text-sm font-bold mb-2">تغيير الرقم السري</div>
              <PinChangeForm onDone={() => qc.invalidateQueries({ queryKey: ['settings'] })} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label">رقم سري جديد (٤ - ٨ أرقام)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                pattern="[0-9]*"
                className="input num text-center text-2xl tracking-[1rem] py-3"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
            <div>
              <label className="label">تأكيد الرقم السري</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                pattern="[0-9]*"
                className="input num text-center text-2xl tracking-[1rem] py-3"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </div>
            <button
              className="btn-primary w-full"
              disabled={pin.length < 4 || pin !== confirm || setPinMut.isPending}
              onClick={() => setPinMut.mutate()}
            >
              <Lock size={16} />
              تفعيل الرقم السري
            </button>
            {pin && confirm && pin !== confirm && (
              <div className="text-bad text-sm text-center">الرقم السري غير متطابق</div>
            )}
          </div>
        )}
      </div>

      <DangerZone />
    </div>
  )
}

function DangerZone(): JSX.Element {
  const [open, setOpen] = useState<null | 'data' | 'all'>(null)
  const [confirmText, setConfirmText] = useState('')
  const PHRASE = 'حذف'

  const reset = useMutation({
    mutationFn: async () => {
      if (open === 'data') return api.systemResetData()
      if (open === 'all') return api.systemResetAll()
    },
    onSuccess: () => {
      setOpen(null)
      setConfirmText('')
      if (open === 'data') {
        toast.success('تم مسح السجلات')
      }
      // 'all' triggers an app relaunch from the main process — no UI follow-up
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشلت العملية')
  })

  return (
    <div className="card p-5 border-2 border-red-200 dark:border-red-500/30 bg-red-50/30 dark:bg-red-500/5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={18} className="text-bad" />
        <h3 className="font-bold text-bad">المنطقة الخطرة</h3>
      </div>
      <p className="text-sm text-ink-muted mb-4 leading-relaxed">
        العمليات هنا لا يمكن التراجع عنها. اعمل نسخة احتياطية قبل أي إعادة ضبط.
      </p>

      <div className="space-y-3">
        <div className="card p-4 bg-bg-card">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="font-bold text-ink flex items-center gap-2">
                <Eraser size={16} />
                مسح كل السجلات
              </div>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                يحذف جميع المعاملات، العملاء، السحوبات، الإيجار، المشتريات، الحجوزات، والتذكيرات.
                <br />
                يحتفظ بالأصناف والأسعار وبيانات المحل.
              </p>
            </div>
            <button
              className="btn-danger btn-sm shrink-0"
              onClick={() => {
                setConfirmText('')
                setOpen('data')
              }}
            >
              <Eraser size={14} />
              مسح
            </button>
          </div>
        </div>

        <div className="card p-4 bg-bg-card">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="font-bold text-ink flex items-center gap-2">
                <Bomb size={16} />
                إعادة ضبط المصنع
              </div>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                يحذف <span className="font-bold">كل شيء</span> ويعيد البرنامج لحالته الأولى.
                ستظهر شاشة الإعداد الأول من جديد. سيُعاد تشغيل البرنامج تلقائياً.
              </p>
            </div>
            <button
              className="btn-danger btn-sm shrink-0"
              onClick={() => {
                setConfirmText('')
                setOpen('all')
              }}
            >
              <Bomb size={14} />
              ضبط مصنع
            </button>
          </div>
        </div>
      </div>

      <Dialog
        open={open !== null}
        onClose={() => {
          setOpen(null)
          setConfirmText('')
        }}
        title={open === 'all' ? 'إعادة ضبط المصنع' : 'مسح كل السجلات'}
        size="sm"
        footer={
          <>
            <button
              className="btn-danger"
              disabled={confirmText.trim() !== PHRASE || reset.isPending}
              onClick={() => reset.mutate()}
            >
              {reset.isPending ? 'جارٍ التنفيذ...' : open === 'all' ? 'تأكيد ضبط المصنع' : 'تأكيد المسح'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setOpen(null)
                setConfirmText('')
              }}
            >
              إلغاء
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-amber-50 text-amber-800 rounded-xl p-3 text-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-bold mb-1">
                {open === 'all'
                  ? 'سيتم حذف كل البيانات والإعدادات نهائياً.'
                  : 'سيتم حذف جميع السجلات نهائياً.'}
              </div>
              <div className="text-xs leading-relaxed">
                لا يمكن التراجع عن هذه العملية. تأكد أن لديك نسخة احتياطية حديثة من زر "نسخ احتياطي" بالأعلى.
              </div>
            </div>
          </div>
          <div>
            <label className="label">
              للمتابعة، اكتب كلمة <span className="num font-bold text-bad">«{PHRASE}»</span> في المربع
            </label>
            <input
              autoFocus
              className="input text-center text-xl"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function PinChangeForm({ onDone }: { onDone: () => void }): JSX.Element {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const change = useMutation({
    mutationFn: () => {
      if (pin !== confirm) throw new Error('الرقم السري غير متطابق')
      return api.pinSet(pin)
    },
    onSuccess: () => {
      toast.success('تم تغيير الرقم السري')
      setPin('')
      setConfirm('')
      onDone()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل')
  })
  return (
    <div className="space-y-2">
      <input
        type="password"
        inputMode="numeric"
        placeholder="رقم سري جديد"
        maxLength={8}
        className="input num text-center"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
      />
      <input
        type="password"
        inputMode="numeric"
        placeholder="تأكيد"
        maxLength={8}
        className="input num text-center"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value.replace(/[^0-9]/g, ''))}
      />
      <button
        className="btn-secondary btn-sm"
        disabled={pin.length < 4 || pin !== confirm || change.isPending}
        onClick={() => change.mutate()}
      >
        تحديث
      </button>
    </div>
  )
}

function DataTab(): JSX.Element {
  const qc = useQueryClient()
  const { data: info } = useQuery({ queryKey: ['app-info'], queryFn: () => api.appInfo() })
  const { data: settings = {} } = useQuery({ queryKey: ['settings'], queryFn: () => api.settingsAll() })
  const autoEnabled = settings.auto_backup_enabled === 'true'
  const autoDir = settings.auto_backup_dir || ''

  const setEnabled = useMutation({
    mutationFn: (v: boolean) => api.settingSet('auto_backup_enabled', v ? 'true' : 'false'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] })
  })

  const onBackup = async (): Promise<void> => {
    try {
      const res = await api.backup()
      if ('canceled' in res) return
      toast.success('تم حفظ النسخة الاحتياطية')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل النسخ')
    }
  }
  const onRestore = async (): Promise<void> => {
    try {
      const res = await api.restore()
      if ('canceled' in res) return
      toast.success('تم استعادة النسخة')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الاستعادة')
    }
  }
  const onPickDir = async (): Promise<void> => {
    try {
      const res = await api.pickAutoBackupDir()
      if ('canceled' in res) return
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('تم تحديد المجلد')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل')
    }
  }
  const onRunNow = async (): Promise<void> => {
    try {
      await api.runAutoBackupNow()
      toast.success('تم النسخ التلقائي')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل')
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card p-5">
        <h3 className="font-bold mb-2">نسخة احتياطية يدوية</h3>
        <p className="text-sm text-ink-muted mb-4">
          احفظ نسخة من جميع بياناتك في ملف واحد على جهازك أو فلاشة USB.
          يمكنك استعادة هذه النسخة في أي وقت.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={onBackup}>
            <Download size={18} />
            حفظ نسخة احتياطية
          </button>
          <button className="btn-secondary" onClick={onRestore}>
            <Upload size={18} />
            استعادة من نسخة
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold">النسخ الاحتياطي التلقائي</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-ink-muted">{autoEnabled ? 'مُفعّل' : 'متوقف'}</span>
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={autoEnabled}
              onChange={(e) => setEnabled.mutate(e.target.checked)}
            />
          </label>
        </div>
        <p className="text-sm text-ink-muted mb-3">
          عند التفعيل، يتم نسخ قاعدة البيانات تلقائياً مرة كل يوم عند فتح البرنامج،
          ويُحتفظ بآخر ٧ نسخ في المجلد المحدد.
        </p>
        <div className="bg-bg-subtle rounded-xl p-3 mb-3">
          <div className="text-xs text-ink-muted mb-1">المجلد:</div>
          <div className="font-mono text-xs text-ink break-all">{autoDir || 'لم يُحدَّد بعد'}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-secondary btn-sm" onClick={onPickDir}>
            <Upload size={16} />
            اختيار المجلد
          </button>
          <button className="btn-secondary btn-sm" disabled={!autoDir} onClick={onRunNow}>
            <Download size={16} />
            تشغيل الآن
          </button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-bold mb-2">تصدير بيانات</h3>
        <p className="text-sm text-ink-muted mb-3">احفظ قائمة العملاء كاملة في ملف Excel.</p>
        <button
          className="btn-secondary"
          onClick={async () => {
            try {
              const r = await api.exportClientsExcel()
              if ('canceled' in r) return
              toast.success('تم تصدير قائمة العملاء')
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'فشل')
            }
          }}
        >
          <FileSpreadsheet size={18} />
          تصدير العملاء Excel
        </button>
      </div>

      <UpdatesSection />

      <div className="card p-5">
        <h3 className="font-bold mb-2">معلومات التطبيق</h3>
        <div className="text-sm space-y-1 text-ink-muted">
          <div>الإصدار: <span className="num text-ink">{info?.version}</span></div>
          <div className="break-all">مكان قاعدة البيانات: <span className="font-mono text-xs text-ink">{info?.dbPath}</span></div>
        </div>
      </div>
    </div>
  )
}

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'up-to-date' }
  | { phase: 'error'; message: string }

function UpdatesSection(): JSX.Element {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })

  useEffect(() => {
    const offProgress = api.onUpdateProgress((p) => {
      const percent = Math.max(0, Math.min(100, Math.round((p as { percent?: number })?.percent ?? 0)))
      setState({ phase: 'downloading', percent })
    })
    const offDone = api.onUpdateDownloaded((info) => {
      setState({ phase: 'downloaded', version: (info as { version?: string })?.version ?? '' })
    })
    const offErr = api.onUpdateError((info) => {
      setState({ phase: 'error', message: (info as { message: string }).message })
    })
    return () => {
      offProgress()
      offDone()
      offErr()
    }
  }, [])

  const onCheck = async (): Promise<void> => {
    setState({ phase: 'checking' })
    try {
      const r = await api.updateCheck()
      if (r.error) {
        setState({ phase: 'error', message: r.error })
      } else if (r.available && r.version) {
        setState({ phase: 'available', version: r.version })
      } else {
        setState({ phase: 'up-to-date' })
      }
    } catch (e) {
      setState({ phase: 'error', message: e instanceof Error ? e.message : 'فشل الفحص' })
    }
  }

  const onDownload = async (): Promise<void> => {
    if (state.phase !== 'available') return
    setState({ phase: 'downloading', percent: 0 })
    try {
      await api.updateDownload()
      // 'update-downloaded' event will switch state to 'downloaded'
    } catch (e) {
      setState({ phase: 'error', message: e instanceof Error ? e.message : 'فشل التحميل' })
    }
  }

  const onInstall = async (): Promise<void> => {
    try {
      await api.updateInstall()
      // The app will quit and relaunch shortly after
      toast.info('سيُعاد تشغيل البرنامج لتثبيت التحديث...')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل التثبيت')
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold">التحديثات</h3>
      </div>
      <p className="text-sm text-ink-muted mb-3">
        تحقق من توفر إصدار جديد. إذا توفّر، يمكنك تحميله وتثبيته بضغطة زر — لا حاجة لإعادة تنزيل البرنامج.
      </p>

      {(state.phase === 'idle' || state.phase === 'up-to-date' || state.phase === 'error') && (
        <button className="btn-secondary" onClick={onCheck}>
          <RefreshCw size={18} />
          فحص التحديثات
        </button>
      )}

      {state.phase === 'checking' && (
        <button className="btn-secondary" disabled>
          <RefreshCw size={18} className="animate-spin" />
          جارٍ الفحص...
        </button>
      )}

      {state.phase === 'available' && (
        <div className="space-y-2">
          <div className="bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm flex items-center gap-2 font-bold">
            <RefreshCw size={16} />
            تتوفر نسخة جديدة: <span className="num">{state.version}</span>
          </div>
          <button className="btn-primary" onClick={onDownload}>
            <Download size={16} />
            تحميل التحديث
          </button>
        </div>
      )}

      {state.phase === 'downloading' && (
        <div className="space-y-2">
          <div className="text-sm text-ink-muted flex items-center justify-between">
            <span>جارٍ تحميل التحديث...</span>
            <span className="num font-bold">{state.percent}%</span>
          </div>
          <div className="h-2 bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-300"
              style={{ width: `${state.percent}%` }}
            />
          </div>
        </div>
      )}

      {state.phase === 'downloaded' && (
        <div className="space-y-2">
          <div className="bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm flex items-center gap-2 font-bold">
            ✓ اكتمل تحميل النسخة <span className="num">{state.version}</span>
          </div>
          <button className="btn-primary" onClick={onInstall}>
            <RefreshCw size={16} />
            إعادة التشغيل والتثبيت
          </button>
        </div>
      )}

      {state.phase === 'up-to-date' && (
        <div className="mt-3 text-sm text-ink-muted flex items-center gap-2">
          ✓ أنت تستخدم أحدث إصدار
        </div>
      )}

      {state.phase === 'error' && (
        <div className="mt-3 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
          <div className="font-bold mb-1">تعذّر فحص التحديثات</div>
          <div className="text-xs leading-relaxed">{state.message}</div>
        </div>
      )}
    </div>
  )
}

function AboutTab(): JSX.Element {
  const { data: info } = useQuery({ queryKey: ['app-info'], queryFn: () => api.appInfo() })
  const developer = 'أمير شتية'
  const email = 'ashetaia01@gmail.com'
  const phone = '+20 1015136243'
  const phoneTel = phone.replace(/\s+/g, '')

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card p-8 text-center bg-gradient-to-br from-brand-50 to-bg-card dark:from-brand-700/20 dark:to-bg-card">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-brand-600 text-white flex items-center justify-center shadow-soft mb-4">
          <Camera size={36} />
        </div>
        <h2 className="text-2xl font-extrabold text-ink mb-1">نظام إدارة مبيعات الاستوديو</h2>
        <div className="text-sm text-ink-muted mb-1">إدارة المعاملات • العملاء • المصاريف • التقارير</div>
        <div className="text-xs text-ink-soft num">الإصدار {info?.version ?? '1.0.0'}</div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Heart size={18} className="text-brand-600" />
          <h3 className="font-bold text-ink">المطوّر</h3>
        </div>
        <div className="text-center mb-5">
          <div className="text-xl font-extrabold text-ink">{developer}</div>
          <div className="text-sm text-ink-muted mt-1">صُمِّم وطُوِّر بالكامل بواسطة المهندس أمير شتية</div>
        </div>

        <div className="space-y-3">
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-bg-subtle hover:bg-brand-50 transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-600 group-hover:bg-brand-100">
              <Mail size={18} />
            </div>
            <div className="flex-1 text-right">
              <div className="text-xs text-ink-muted">البريد الإلكتروني</div>
              <div className="font-bold text-ink num" dir="ltr">{email}</div>
            </div>
          </a>

          <a
            href={`tel:${phoneTel}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-bg-subtle hover:bg-brand-50 transition group"
          >
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-600 group-hover:bg-brand-100">
              <Phone size={18} />
            </div>
            <div className="flex-1 text-right">
              <div className="text-xs text-ink-muted">للدعم الفني والاستفسارات</div>
              <div className="font-bold text-ink num" dir="ltr">{phone}</div>
            </div>
          </a>
        </div>
      </div>

      <div className="card p-5 text-center text-sm text-ink-muted leading-relaxed">
        <div className="mb-1">© ٢٠٢٦ {developer}. جميع الحقوق محفوظة.</div>
        <div className="text-xs text-ink-soft">
          هذا البرنامج مُلكية فكرية لمطوِّره ولا يجوز إعادة بيعه أو توزيعه دون إذن خطي مسبق.
        </div>
      </div>
    </div>
  )
}
