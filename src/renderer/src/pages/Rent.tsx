import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateShort, monthLabel, todayISO } from '@/lib/format'
import { Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'
import { pushUndo } from '@/store/undo'

export function Rent(): JSX.Element {
  const qc = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [open, setOpen] = useState(false)
  const [delId, setDelId] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const { data } = useQuery({
    queryKey: ['rent', year, month],
    queryFn: () => api.rentForMonth(year, month)
  })

  const create = useMutation({
    mutationFn: () =>
      api.rentPaymentCreate({
        payment_date: date,
        period_year: year,
        period_month: month,
        amount: Number(amount),
        note: note || null
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rent'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم تسجيل الدفعة')
      setOpen(false)
      setAmount('')
      setNote('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const del = useMutation({
    mutationFn: (id: number) => api.rentPaymentDelete(id).then(() => id),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['rent'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      pushUndo({
        description: 'حذف دفعة إيجار',
        undo: async () => {
          await api.recycleRestore('rent', id)
          qc.invalidateQueries({ queryKey: ['rent'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
        }
      })
      toast.success('تم الحذف (Ctrl+Z للتراجع)')
    }
  })

  const goPrev = (): void => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }
  const goNext = (): void => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const required = data?.required ?? 0
  const paid = data?.paid ?? 0
  const remaining = data?.remaining ?? 0
  const pct = required > 0 ? Math.min(100, (paid / required) * 100) : 0

  return (
    <>
      <PageHeader
        title="الإيجار"
        subtitle="متابعة دفعات الإيجار شهرياً"
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} />
            تسجيل دفعة
          </button>
        }
      />

      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-5">
          <button className="btn-secondary btn-sm" onClick={goPrev}>
            <ChevronRight size={16} />
            الشهر السابق
          </button>
          <div className="text-2xl font-extrabold text-ink">{monthLabel(year, month)}</div>
          <button className="btn-secondary btn-sm" onClick={goNext}>
            الشهر التالي
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <div className="text-ink-muted text-sm">المطلوب</div>
            <div className="text-xl font-extrabold num mt-1">{fmtMoney(required)}</div>
          </div>
          <div>
            <div className="text-ink-muted text-sm">المدفوع</div>
            <div className="text-xl font-extrabold num mt-1 text-good">{fmtMoney(paid)}</div>
          </div>
          <div>
            <div className="text-ink-muted text-sm">المتبقي</div>
            <div className="text-xl font-extrabold num mt-1 text-bad">{fmtMoney(remaining)}</div>
          </div>
        </div>
        <div className="h-3 bg-bg-subtle rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${pct >= 100 ? 'bg-good' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-bg-subtle">
          <h3 className="font-bold">دفعات الشهر ({data?.payments.length ?? 0})</h3>
        </div>
        {!data || data.payments.length === 0 ? (
          <EmptyState title="لا توجد دفعات لهذا الشهر بعد" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>تاريخ الدفع</th>
                <th>ملاحظة</th>
                <th className="text-left">المبلغ</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{fmtDateShort(p.payment_date)}</td>
                  <td>{p.note || <span className="text-ink-soft">—</span>}</td>
                  <td className="text-left font-bold num text-good">{fmtMoney(p.amount)}</td>
                  <td>
                    <button
                      className="btn-ghost btn-sm text-bad hover:bg-red-50"
                      onClick={() => setDelId(p.id)}
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
        title={`تسجيل دفعة إيجار - ${monthLabel(year, month)}`}
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
            <label className="label">تاريخ الدفع</label>
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
            <div className="text-xs text-ink-muted mt-1">المتبقي: {fmtMoney(remaining)}</div>
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
        title="حذف الدفعة"
        message="هل تريد حذف هذه الدفعة نهائياً؟"
        confirmText="حذف"
        destructive
      />
    </>
  )
}
