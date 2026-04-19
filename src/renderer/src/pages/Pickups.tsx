import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateShort } from '@/lib/format'
import { Package, CheckCircle2, Clock, MessageCircle, AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'
import { cn } from '@/lib/cn'

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
                <th className="text-left">الإجمالي</th>
                <th className="w-48"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const isOverdue = t.pickup_promised_date && t.pickup_promised_date < today
                return (
                  <tr key={t.id} className="cursor-pointer" onClick={() => nav(`/transactions/${t.id}`)}>
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
                        onClick={() => setStatus.mutate({ id: t.id, status: 'delivered' })}
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
    </>
  )
}
