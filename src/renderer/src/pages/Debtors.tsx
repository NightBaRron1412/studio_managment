import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DebtorRow, TransactionWithLines } from '@shared/types'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateShort } from '@/lib/format'
import { Phone, MessageCircle, User, Wallet, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'
import { pushUndo } from '@/store/undo'

export function Debtors(): JSX.Element {
  const { data: list = [], isLoading } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => api.debtorsList()
  })
  const total = list.reduce((s, r) => s + r.outstanding, 0)

  return (
    <>
      <PageHeader
        title="العملاء المدينون"
        subtitle="من عليهم مبالغ آجلة لم تُحصَّل بعد"
      />

      <div className="card p-5 mb-4 flex items-center justify-between">
        <div>
          <div className="text-ink-muted text-sm">إجمالي المستحق</div>
          <div className="text-3xl font-extrabold num text-warn">{fmtMoney(total)}</div>
        </div>
        <div className="text-end">
          <div className="text-ink-muted text-sm">عدد العملاء المدينين</div>
          <div className="text-3xl font-extrabold num">{list.length}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-10 text-center text-ink-muted">جارِ التحميل...</div>
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="لا يوجد عملاء مدينون"
            hint="جميع المعاملات مدفوعة بالكامل ✓"
            icon={<CheckCircle2 size={28} className="text-good" />}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <DebtorCard key={`${r.client_id}`} row={r} />
          ))}
        </div>
      )}
    </>
  )
}

function DebtorCard({ row }: { row: DebtorRow }): JSX.Element {
  const [open, setOpen] = useState(false)
  const { data: history = [] } = useQuery({
    queryKey: ['client-history', row.client_id],
    queryFn: () => api.clientHistory(row.client_id),
    enabled: open && !!row.client_id
  })
  const unpaid = history.filter((t) => t.remaining > 0)

  return (
    <div className="card overflow-hidden">
      <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-warn/10 text-warn flex items-center justify-center">
            <User size={20} />
          </div>
          <div>
            {row.client_id ? (
              <Link to={`/clients/${row.client_id}`} className="font-bold text-ink hover:text-brand-700">
                {row.client_name}
              </Link>
            ) : (
              <div className="font-bold text-ink">{row.client_name}</div>
            )}
            <div className="text-xs text-ink-muted flex items-center gap-2">
              {row.client_phone && (
                <span className="num" dir="ltr">
                  {row.client_phone}
                </span>
              )}
              <span>•</span>
              <span>{row.open_count} فاتورة آجلة</span>
              <span>•</span>
              <span>أقدمها {fmtDateShort(row.oldest_date)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-end">
            <div className="text-xs text-ink-muted">المستحق</div>
            <div className="text-xl font-extrabold num text-warn">{fmtMoney(row.outstanding)}</div>
          </div>
          {row.client_phone && (
            <a
              href={`tel:${row.client_phone.replace(/\s+/g, '')}`}
              className="btn-secondary btn-sm"
              title="اتصال"
            >
              <Phone size={16} />
            </a>
          )}
          <button className="btn-secondary btn-sm" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {open ? 'إخفاء' : 'الفواتير'}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-bg-subtle bg-bg-subtle/30 p-3 space-y-2">
          {unpaid.length === 0 ? (
            <div className="text-center text-ink-muted py-4">لا توجد فواتير آجلة</div>
          ) : (
            unpaid.map((t) => <DebtorTxRow key={t.id} tx={t} clientPhone={row.client_phone} />)
          )}
        </div>
      )}
    </div>
  )
}

function DebtorTxRow({ tx, clientPhone }: { tx: TransactionWithLines; clientPhone: string | null }): JSX.Element {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')

  const pay = useMutation({
    mutationFn: () => api.transactionMarkPaid(tx.id, Number(amount)),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['debtors'] })
      qc.invalidateQueries({ queryKey: ['client-history'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['transaction', String(tx.id)] })
      qc.invalidateQueries({ queryKey: ['cash-close-today'] })
      qc.invalidateQueries({ queryKey: ['cash-close-list'] })
      const newPayment = updated.payments[updated.payments.length - 1]
      if (newPayment) {
        pushUndo({
          description: `تسوية ${fmtMoney(newPayment.amount)}`,
          undo: async () => {
            await api.paymentDelete(newPayment.id)
            qc.invalidateQueries({ queryKey: ['debtors'] })
            qc.invalidateQueries({ queryKey: ['client-history'] })
            qc.invalidateQueries({ queryKey: ['transactions'] })
            qc.invalidateQueries({ queryKey: ['dashboard'] })
            qc.invalidateQueries({ queryKey: ['transaction', String(tx.id)] })
            qc.invalidateQueries({ queryKey: ['cash-close-today'] })
            qc.invalidateQueries({ queryKey: ['cash-close-list'] })
          }
        })
      }
      toast.success('تم تحديث الدفع')
      setOpen(false)
      setAmount('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل')
  })

  const wa = useMutation({
    mutationFn: () => api.whatsappShareTransaction(tx.id, clientPhone),
    onSuccess: (r) => {
      if (r.opened) toast.success('فُتحت واتساب')
      else toast.info('تم نسخ رابط واتساب إلى الحافظة')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل المشاركة')
  })

  return (
    <div className="bg-white rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
      <button
        className="text-right flex-1 min-w-[180px]"
        onClick={() => nav(`/transactions/${tx.id}`)}
      >
        <div className="font-bold num text-ink">{tx.transaction_no}</div>
        <div className="text-xs text-ink-muted">{fmtDateShort(tx.date)} • إجمالي {fmtMoney(tx.total)}</div>
      </button>
      <div className="text-end">
        <div className="text-xs text-ink-muted">الباقي</div>
        <div className="font-extrabold num text-warn">{fmtMoney(tx.remaining)}</div>
      </div>
      <button className="btn-secondary btn-sm" onClick={() => wa.mutate()}>
        <MessageCircle size={14} />
        تذكير
      </button>
      <button
        className="btn-primary btn-sm"
        onClick={() => {
          setAmount(String(tx.remaining.toFixed(2)))
          setOpen(true)
        }}
      >
        <Wallet size={14} />
        تسوية
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="تسجيل دفعة"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!amount || Number(amount) <= 0 || pay.isPending}
              onClick={() => pay.mutate()}
            >
              حفظ الدفعة
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-ink-muted">
            فاتورة <span className="num font-bold text-ink">{tx.transaction_no}</span>
          </div>
          <div className="bg-bg-subtle rounded-xl p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">إجمالي الفاتورة</span>
              <span className="num font-bold">{fmtMoney(tx.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">المدفوع سابقاً</span>
              <span className="num font-bold text-good">{fmtMoney(tx.paid_amount)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-bg pt-2 mt-2">
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <button
                className="chip flex-1 justify-center"
                onClick={() => setAmount(String(tx.remaining.toFixed(2)))}
              >
                دفع كامل
              </button>
              <button
                className="chip flex-1 justify-center"
                onClick={() => setAmount(String((tx.remaining / 2).toFixed(2)))}
              >
                نصف المتبقي
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
