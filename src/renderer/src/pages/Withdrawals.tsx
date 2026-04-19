import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateShort, todayISO } from '@/lib/format'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'

export function Withdrawals(): JSX.Element {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [delId, setDelId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [by, setBy] = useState('')
  const [reason, setReason] = useState('')

  const { data: list = [] } = useQuery({ queryKey: ['withdrawals'], queryFn: () => api.withdrawalsList() })
  const total = list.reduce((s, w) => s + w.amount, 0)

  const create = useMutation({
    mutationFn: () =>
      api.withdrawalCreate({
        date,
        amount: Number(amount),
        withdrawn_by: by || null,
        reason: reason || null
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdrawals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setOpen(false)
      setDate(todayISO())
      setAmount('')
      setBy('')
      setReason('')
      toast.success('تم تسجيل السحب')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const del = useMutation({
    mutationFn: (id: number) => api.withdrawalDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdrawals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم حذف السحب')
    }
  })

  return (
    <>
      <PageHeader
        title="السحوبات النقدية"
        subtitle="تسجيل ومتابعة المبالغ المسحوبة من الخزنة"
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} />
            تسجيل سحب
          </button>
        }
      />

      <div className="card p-5 mb-4 flex items-center justify-between">
        <span className="text-ink-muted">إجمالي السحوبات المعروضة</span>
        <span className="text-2xl font-extrabold num text-warn">{fmtMoney(total)}</span>
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState title="لا توجد سحوبات بعد" hint="سجّل أول سحب نقدي." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الشخص</th>
                <th>السبب</th>
                <th className="text-left">المبلغ</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id}>
                  <td className="num">{fmtDateShort(w.date)}</td>
                  <td>{w.withdrawn_by || '—'}</td>
                  <td>{w.reason || <span className="text-ink-soft">—</span>}</td>
                  <td className="text-left font-bold num text-warn">{fmtMoney(w.amount)}</td>
                  <td>
                    <button
                      className="btn-ghost btn-sm text-bad hover:bg-red-50"
                      onClick={() => setDelId(w.id)}
                      aria-label="حذف"
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
        title="تسجيل سحب نقدي"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!amount || Number(amount) <= 0 || create.isPending}
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
            <label className="label">المبلغ *</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input num text-center text-lg"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">الشخص</label>
            <input className="input" placeholder="من سحب المبلغ" value={by} onChange={(e) => setBy(e.target.value)} />
          </div>
          <div>
            <label className="label">السبب / ملاحظة</label>
            <textarea
              className="input"
              rows={2}
              placeholder="مثل: مصاريف يومية، شراء مستلزمات..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && del.mutate(delId)}
        title="حذف السحب"
        message="هل تريد حذف هذا السحب نهائياً؟"
        confirmText="حذف"
        destructive
      />
    </>
  )
}
