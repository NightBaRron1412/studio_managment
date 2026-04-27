import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateShort, todayISO } from '@/lib/format'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'
import { pushUndo } from '@/store/undo'

export function Inventory(): JSX.Element {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [delId, setDelId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [note, setNote] = useState('')

  const { data: list = [] } = useQuery({ queryKey: ['inventory'], queryFn: () => api.inventoryList() })
  const total = list.reduce((s, it) => s + it.cost, 0)

  const create = useMutation({
    mutationFn: () =>
      api.inventoryCreate({
        date,
        item_name: name,
        quantity: Number(qty),
        cost: Number(cost),
        supplier: supplier || null,
        note: note || null
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم تسجيل الشراء')
      setOpen(false)
      setName('')
      setQty('1')
      setCost('')
      setSupplier('')
      setNote('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const del = useMutation({
    mutationFn: (id: number) => api.inventoryDelete(id).then(() => id),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      pushUndo({
        description: 'حذف فاتورة شراء',
        undo: async () => {
          await api.recycleRestore('inventory', id)
          qc.invalidateQueries({ queryKey: ['inventory'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
        }
      })
      toast.success('تم الحذف (Ctrl+Z للتراجع)')
    }
  })

  return (
    <>
      <PageHeader
        title="مشتريات الموردين"
        subtitle="سجل المشتريات من الموردين. لتتبّع كميات المخزون افتح الإعدادات → الأصناف."
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} />
            تسجيل شراء
          </button>
        }
      />

      <div className="card p-5 mb-4 flex items-center justify-between">
        <span className="text-ink-muted">إجمالي المشتريات المعروضة</span>
        <span className="text-2xl font-extrabold num">{fmtMoney(total)}</span>
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState title="لم تُسجل أي مشتريات بعد" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الصنف</th>
                <th className="text-center">الكمية</th>
                <th>المورد</th>
                <th className="text-left">التكلفة</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((it) => (
                <tr key={it.id}>
                  <td className="num">{fmtDateShort(it.date)}</td>
                  <td>
                    <div className="font-bold">{it.item_name}</div>
                    {it.note && <div className="text-xs text-ink-muted">{it.note}</div>}
                  </td>
                  <td className="text-center num">{it.quantity}</td>
                  <td>{it.supplier || <span className="text-ink-soft">—</span>}</td>
                  <td className="text-left font-bold num">{fmtMoney(it.cost)}</td>
                  <td>
                    <button
                      className="btn-ghost btn-sm text-bad hover:bg-red-50"
                      onClick={() => setDelId(it.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="تسجيل عملية شراء"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!name.trim() || !cost || Number(cost) <= 0 || create.isPending}
              onClick={() => create.mutate()}
            >
              حفظ
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">التاريخ</label>
            <input type="date" className="input num" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">اسم الصنف *</label>
            <input
              className="input"
              autoFocus
              placeholder="مثل: ورق طباعة، حبر، براويز..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">الكمية</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input num text-center"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div>
              <label className="label">التكلفة الإجمالية *</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="input num text-center"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">المورد</label>
            <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div>
            <label className="label">ملاحظة</label>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && del.mutate(delId)}
        title="حذف السجل"
        message="هل تريد حذف هذا السجل نهائياً؟"
        confirmText="حذف"
        destructive
      />
    </>
  )
}
