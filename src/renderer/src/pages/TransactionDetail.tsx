import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateLong, fmtDateShort } from '@/lib/format'
import {
  ArrowRight,
  Pencil,
  Printer,
  Trash2,
  User,
  MessageCircle,
  Copy,
  Wallet,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { toast } from '@/store/toast'

export function TransactionDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [askDelete, setAskDelete] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')

  const { data: tx, isLoading } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => api.transactionGet(Number(id)),
    enabled: !!id
  })

  const del = useMutation({
    mutationFn: () => api.transactionDelete(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['debtors'] })
      toast.success('تم نقل المعاملة إلى سلة المحذوفات')
      nav('/transactions')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحذف')
  })

  const print = useMutation({
    mutationFn: () => api.printTransaction(Number(id)),
    onSuccess: (r) => {
      if ('canceled' in r) return
      toast.success('تم تجهيز الفاتورة PDF')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل التصدير')
  })

  const wa = useMutation({
    mutationFn: () => api.whatsappShareTransaction(Number(id)),
    onSuccess: (r) => {
      if (r.opened) {
        toast.success('فُتحت واتساب — اسحب ملف PDF من النافذة المفتوحة إلى المحادثة')
      } else {
        toast.info('تم نسخ رابط واتساب إلى الحافظة — الصِقه في المتصفح')
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل المشاركة')
  })

  const pay = useMutation({
    mutationFn: () => api.transactionMarkPaid(Number(id), Number(payAmount)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transaction', id] })
      qc.invalidateQueries({ queryKey: ['debtors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['cash-close-today'] })
      qc.invalidateQueries({ queryKey: ['cash-close-list'] })
      toast.success('تم تحديث الدفع')
      setPayOpen(false)
      setPayAmount('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  if (isLoading || !tx) return <div className="p-6 text-ink-muted">جارِ التحميل...</div>

  return (
    <>
      <PageHeader
        title={`فاتورة ${tx.transaction_no}`}
        subtitle={fmtDateLong(tx.date)}
        actions={
          <>
            <button className="btn-secondary" onClick={() => nav(-1)}>
              <ArrowRight size={18} />
              رجوع
            </button>
            <button
              className="btn-secondary"
              onClick={() => nav('/transactions/new', { state: { duplicateFrom: tx.id } })}
              title="إنشاء معاملة جديدة بنفس الأصناف"
            >
              <Copy size={18} />
              تكرار
            </button>
            <button className="btn-secondary" onClick={() => wa.mutate()}>
              <MessageCircle size={18} />
              واتساب
            </button>
            <button className="btn-secondary" onClick={() => print.mutate()}>
              <Printer size={18} />
              PDF
            </button>
            <button className="btn-secondary" onClick={() => nav(`/transactions/${tx.id}/edit`)}>
              <Pencil size={18} />
              تعديل
            </button>
            <button className="btn-danger" onClick={() => setAskDelete(true)}>
              <Trash2 size={18} />
              حذف
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-ink text-lg">تفاصيل الأصناف</h3>
              <span className="text-sm text-ink-muted">{tx.lines.length} صنف</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th className="text-center">الكمية</th>
                  <th className="text-center">السعر</th>
                  <th className="text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {tx.lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="font-semibold">{l.item_name || l.custom_name}</div>
                      {l.note && <div className="text-xs text-ink-muted">{l.note}</div>}
                    </td>
                    <td className="text-center num">{l.quantity}</td>
                    <td className="text-center num">{fmtMoney(l.unit_price)}</td>
                    <td className="text-left num font-bold">{fmtMoney(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-left text-ink-muted pt-3">المجموع قبل الخصم</td>
                  <td className="text-left num pt-3">{fmtMoney(tx.subtotal)}</td>
                </tr>
                {tx.discount_amount > 0 && (
                  <tr>
                    <td colSpan={3} className="text-left text-bad">
                      الخصم {tx.discount_type === 'percent' ? `(${tx.discount_value}%)` : ''}
                    </td>
                    <td className="text-left num text-bad">- {fmtMoney(tx.discount_amount)}</td>
                  </tr>
                )}
                {tx.vat_amount > 0 && (
                  <tr>
                    <td colSpan={3} className="text-left text-warn">
                      ضريبة القيمة المضافة ({tx.vat_percent}%)
                    </td>
                    <td className="text-left num text-warn">+ {fmtMoney(tx.vat_amount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={3} className="text-left font-bold text-base pt-3 border-t border-bg-subtle">الإجمالي</td>
                  <td className="text-left num font-extrabold text-lg pt-3 border-t border-bg-subtle text-brand-700">
                    {fmtMoney(tx.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {tx.notes && (
            <div className="card p-5">
              <div className="text-sm font-semibold text-ink-muted mb-1">ملاحظات</div>
              <div className="text-ink leading-relaxed">{tx.notes}</div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="text-sm text-ink-muted">رقم الفاتورة</div>
            <div className="text-2xl font-extrabold num">{tx.transaction_no}</div>
            <div className="mt-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-muted">التاريخ</span>
                <span className="num font-semibold">{fmtDateLong(tx.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">طريقة الدفع</span>
                <span className="font-semibold">{tx.payment_method || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">الموظف</span>
                <span className="font-semibold">{tx.staff_name || '—'}</span>
              </div>
            </div>
          </div>

          {/* Payment status */}
          <div className={`card p-5 ${tx.is_paid ? 'border-r-4 border-r-good' : 'border-r-4 border-r-warn'}`}>
            <div className="flex items-center gap-2 mb-2">
              {tx.is_paid ? (
                <>
                  <CheckCircle2 size={18} className="text-good" />
                  <span className="font-bold text-good">مدفوعة بالكامل</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} className="text-warn" />
                  <span className="font-bold text-warn">آجل / دفع جزئي</span>
                </>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">المدفوع</span>
                <span className="num font-bold text-good">{fmtMoney(tx.paid_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">الباقي</span>
                <span className={`num font-bold ${tx.remaining > 0 ? 'text-warn' : ''}`}>
                  {fmtMoney(tx.remaining)}
                </span>
              </div>
            </div>
            {!tx.is_paid && (
              <button
                className="btn-primary w-full mt-4"
                onClick={() => {
                  setPayAmount(String(tx.remaining.toFixed(2)))
                  setPayOpen(true)
                }}
              >
                <Wallet size={16} />
                تسجيل دفعة
              </button>
            )}

            {tx.payments && tx.payments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-bg-subtle">
                <div className="text-xs font-bold text-ink-muted mb-2">سجل الدفعات</div>
                <ul className="space-y-1">
                  {tx.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex justify-between items-center text-sm py-1"
                    >
                      <span className="num text-ink-muted">{fmtDateShort(p.date)}</span>
                      <span className="num font-bold text-good">{fmtMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="text-sm text-ink-muted mb-2">العميل</div>
            {tx.client_id && tx.client_name ? (
              <Link
                to={`/clients/${tx.client_id}`}
                className="flex items-center gap-3 p-3 -m-1 rounded-xl hover:bg-bg-subtle"
              >
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                  <User size={18} />
                </div>
                <div>
                  <div className="font-bold">{tx.client_name}</div>
                  <div className="text-xs text-ink-muted">عرض ملف العميل</div>
                </div>
              </Link>
            ) : (
              <div className="text-ink-muted text-sm">معاملة بدون عميل مسجل</div>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={askDelete}
        onClose={() => setAskDelete(false)}
        onConfirm={() => del.mutate()}
        title="حذف المعاملة"
        message="سيتم نقل المعاملة إلى سلة المحذوفات. يمكنك استعادتها لاحقاً."
        confirmText="حذف"
        destructive
      />

      <Dialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="تسجيل دفعة"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!payAmount || Number(payAmount) <= 0 || pay.isPending}
              onClick={() => pay.mutate()}
            >
              حفظ
            </button>
            <button className="btn-secondary" onClick={() => setPayOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="bg-bg-subtle rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-ink-muted">إجمالي الفاتورة</span>
              <span className="num font-bold">{fmtMoney(tx.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">المدفوع سابقاً</span>
              <span className="num font-bold text-good">{fmtMoney(tx.paid_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-bg pt-1 mt-1">
              <span className="text-ink-muted">الباقي</span>
              <span className="num font-bold text-warn">{fmtMoney(tx.remaining)}</span>
            </div>
          </div>
          <div>
            <label className="label">المبلغ المستلم الآن</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input num text-center text-lg"
              autoFocus
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </>
  )
}
