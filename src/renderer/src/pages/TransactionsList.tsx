import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateShort } from '@/lib/format'
import { Search, Plus } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export function TransactionsList(): JSX.Element {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['transactions', q, from, to],
    queryFn: () =>
      api.transactionsList({
        q: q || undefined,
        date_from: from || undefined,
        date_to: to || undefined
      })
  })

  return (
    <>
      <PageHeader
        title="المعاملات"
        subtitle="جميع عمليات البيع المسجلة"
        actions={
          <button className="btn-primary" onClick={() => nav('/transactions/new')}>
            <Plus size={18} />
            معاملة جديدة
          </button>
        }
      />

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-ink-soft" size={18} />
            <input
              className="input pr-10"
              placeholder="بحث بالاسم، الهاتف، رقم المعاملة..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <input
              type="date"
              className="input num"
              dir="ltr"
              placeholder="من"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <input
              type="date"
              className="input num"
              dir="ltr"
              placeholder="إلى"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-ink-muted">جارِ التحميل...</div>
        ) : list.length === 0 ? (
          <EmptyState
            title="لا توجد معاملات بعد"
            hint="ابدأ بتسجيل أول معاملة لك."
            action={
              <button className="btn-primary" onClick={() => nav('/transactions/new')}>
                <Plus size={16} />
                معاملة جديدة
              </button>
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>رقم المعاملة</th>
                <th>التاريخ</th>
                <th>العميل</th>
                <th>الموظف</th>
                <th className="text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => nav(`/transactions/${t.id}`)}
                >
                  <td className="font-bold num">{t.transaction_no}</td>
                  <td className="num">{fmtDateShort(t.date)}</td>
                  <td>{t.client_name || <span className="text-ink-soft">—</span>}</td>
                  <td>{t.staff_name || <span className="text-ink-soft">—</span>}</td>
                  <td className="text-left font-bold num">{fmtMoney(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
