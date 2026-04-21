import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateShort } from '@/lib/format'
import { Package, CheckCircle2, Clock, MessageCircle, AlertTriangle, Wallet, AlertCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Dialog } from '@/components/ui/Dialog'
import { toast } from '@/store/toast'
import { cn } from '@/lib/cn'
import type { Transaction } from '@shared/types'

export function Pickups(): JSX.Element {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { data: list = [] } = useQuery({
    queryKey: ['pickups'],
    queryFn: () => api.pendingPickupsList()
  })

  const today = new Date().toISOString().slice(0, 10)
  const overdue = list.filter((t) => t.pickup_promised_date && t.pickup_promised_date < today)

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ready' | 'delivered' }) =>
      api.transactionMarkPickup(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pickups'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('تم التحديث')
    }
  })

  // When delivering, intercept if there's an unpaid balance so the owner is
  // reminded to collect it. The dialog lets them either record a payment
  // (then deliver) or deliver as-is and leave the remainder on the client's tab.
  const [unpaidTx, setUnpaidTx] = useState<Transaction | null>(null)
  const [payAmount, setPayAmount] = useState('')

  const remaining = unpaidTx ? Math.max(0, unpaidTx.total - unpaidTx.paid_amount) : 0

  const closeUnpaid = (): void => {
    setUnpaidTx(null)
    setPayAmount('')
  }

  const payAndDeliver = useMutation({
    mutationFn: async () => {
      if (!unpaidTx) return
      const amt = Number(payAmount) || 0
      if (amt > 0) {
        await api.transactionMarkPaid(unpaidTx.id, amt)
      }
      await api.transactionMarkPickup(unpaidTx.id, 'delivered')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pickups'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['debtors'] })
      toast.success(Number(payAmount) > 0 ? 'تم تسجيل الدفعة وتسليم الطلب' : 'تم تسليم الطلب')
      closeUnpaid()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const handleDeliverClick = (t: Transaction): void => {
    const rem = Math.max(0, t.total - t.paid_amount)
    if (rem > 0.001) {
      setUnpaidTx(t)
      setPayAmount(rem.toFixed(2))
    } else {
      setStatus.mutate({ id: t.id, status: 'delivered' })
    }
  }

  const wa = useMutation({
    mutationFn: (id: number) => api.whatsappShareTransaction(id),
    onSuccess: (r) => {
      if (r.opened) toast.success('فُتحت واتساب')
      else toast.info('تم نسخ رابط واتساب إلى الحافظة')
    }
  })

  return (
    <>
      <PageHeader
        title="طلبات قيد التسليم"
        subtitle="المعاملات التي لم تُسلَّم للعميل بعد"
      />

      {overdue.length > 0 && (
        <div className="card p-4 mb-4 border-r-4 border-r-bad bg-red-50/50 flex items-center gap-3">
          <AlertTriangle className="text-bad shrink-0" size={20} />
          <div className="flex-1">
            <div className="font-bold text-ink">{overdue.length} طلب متأخر عن موعد التسليم</div>
            <div className="text-xs text-ink-muted">يرجى التواصل مع العملاء.</div>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="لا يوجد طلبات قيد التسليم"
            hint="جميع الطلبات تم تسليمها للعملاء ✓"
            icon={<CheckCircle2 size={28} className="text-good" />}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>الفاتورة</th>
                <th>العميل</th>
                <th>تاريخ المعاملة</th>
                <th>موعد التسليم</th>
                <th>الحالة</th>
                <th className="text-center">الدفع</th>
                <th className="text-left">الإجمالي</th>
                <th className="w-48"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const isOverdue = t.pickup_promised_date && t.pickup_promised_date < today
                const rem = Math.max(0, Number((t.total - t.paid_amount).toFixed(2)))
                const fullyPaid = rem <= 0.0001
                const partial = !fullyPaid && t.paid_amount > 0.0001
                return (
                  <tr
                    key={t.id}
                    className={cn(
                      'cursor-pointer',
                      !fullyPaid && 'bg-amber-50/40 hover:bg-amber-50'
                    )}
                    onClick={() => nav(`/transactions/${t.id}`)}
                  >
                    <td className="font-bold num">{t.transaction_no}</td>
                    <td>{t.client_name || <span className="text-ink-soft">—</span>}</td>
                    <td className="num text-sm">{fmtDateShort(t.date)}</td>
                    <td className={cn('num text-sm', isOverdue && 'text-bad font-bold')}>
                      {t.pickup_promised_date ? fmtDateShort(t.pickup_promised_date) : '—'}
                    </td>
                    <td>
                      <span
                        className={cn(
                          'chip',
                          t.pickup_status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        )}
                      >
                        {t.pickup_status === 'ready' ? (
                          <>
                            <CheckCircle2 size={12} />
                            جاهز
                          </>
                        ) : (
                          <>
                            <Clock size={12} />
                            قيد التحضير
                          </>
                        )}
                      </span>
                    </td>
                    <td className="text-center">
                      {fullyPaid ? (
                        <span className="chip text-xs bg-emerald-50 text-emerald-700">
                          <CheckCircle2 size={12} />
                          مدفوع
                        </span>
                      ) : (
                        <span className="chip text-xs bg-amber-50 text-amber-700 num">
                          <AlertCircle size={12} />
                          {partial ? `متبقّي ${fmtMoney(rem)}` : `آجل ${fmtMoney(rem)}`}
                        </span>
                      )}
                    </td>
                    <td className="text-left font-bold num">{fmtMoney(t.total)}</td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => wa.mutate(t.id)}
                        title="تنبيه واتساب"
                      >
                        <MessageCircle size={14} />
                      </button>
                      {t.pickup_status !== 'ready' && (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => setStatus.mutate({ id: t.id, status: 'ready' })}
                          title="جاهز للاستلام"
                        >
                          <Package size={14} />
                          جاهز
                        </button>
                      )}
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => handleDeliverClick(t)}
                        title="تم التسليم"
                      >
                        <CheckCircle2 size={14} />
                        تسليم
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
        open={!!unpaidTx}
        onClose={() => (payAndDeliver.isPending ? null : closeUnpaid())}
        title="الطلب لم يُسدَّد بالكامل"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={payAndDeliver.isPending}
              onClick={() => payAndDeliver.mutate()}
            >
              <Wallet size={14} />
              {Number(payAmount) > 0 ? 'تسجيل الدفعة وتسليم' : 'تسليم بدون دفع'}
            </button>
            <button
              className="btn-secondary"
              disabled={payAndDeliver.isPending}
              onClick={closeUnpaid}
            >
              إلغاء
            </button>
          </>
        }
      >
        {unpaidTx && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
              <div className="font-bold mb-1">⚠️ يوجد مبلغ متبقّي على هذا الطلب</div>
              <div>
                ذكِّر العميل <span className="font-bold">{unpaidTx.client_name || '—'}</span> بسداد المتبقّي قبل تسليم الطلب.
              </div>
            </div>

            <div className="bg-bg-subtle rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">فاتورة</span>
                <span className="num font-bold">{unpaidTx.transaction_no}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">إجمالي الفاتورة</span>
                <span className="num font-bold">{fmtMoney(unpaidTx.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">المدفوع سابقاً</span>
                <span className="num font-bold text-good">{fmtMoney(unpaidTx.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-bg pt-2 mt-2">
                <span className="text-ink-muted">الباقي</span>
                <span className="num font-bold text-warn">{fmtMoney(remaining)}</span>
              </div>
            </div>

            <div>
              <label className="label">المبلغ المستلم الآن</label>
              <input
                type="number"
                min="0"
                max={remaining}
                step="0.5"
                className="input num text-center text-lg"
                autoFocus
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
              <div className="text-xs text-ink-muted mt-1">
                اتركه <span className="num">0</span> لتسليم الطلب وترك المتبقّي على العميل (آجل).
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
