import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtNumber, todayISO } from '@/lib/format'
import { StatCard } from '@/components/StatCard'
import { FileText, FileSpreadsheet, BarChart3, TrendingUp, Wallet, Receipt, Package } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { toast } from '@/store/toast'

function startOfMonthISO(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function Reports(): JSX.Element {
  const [from, setFrom] = useState(startOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [itemId, setItemId] = useState<number | null>(null)

  const { data: cats = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categoriesList() })
  const { data: items = [] } = useQuery({
    queryKey: ['items', 'all', categoryId],
    queryFn: () => api.itemsList({ category_id: categoryId ?? undefined })
  })

  const filters = useMemo(
    () => ({
      date_from: from || undefined,
      date_to: to || undefined,
      category_id: categoryId ?? undefined,
      item_id: itemId ?? undefined
    }),
    [from, to, categoryId, itemId]
  )

  const { data: summary, isLoading } = useQuery({
    queryKey: ['report', filters],
    queryFn: () => api.reportSummary(filters)
  })

  const exportPDF = useMutation({
    mutationFn: () => api.exportReportPDF(filters),
    onSuccess: (r) => {
      if ('canceled' in r) return
      toast.success('تم تصدير التقرير PDF')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل التصدير')
  })

  const exportExcel = useMutation({
    mutationFn: () => api.exportReportExcel(filters),
    onSuccess: (r) => {
      if ('canceled' in r) return
      toast.success('تم تصدير التقرير Excel')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل التصدير')
  })

  const setQuick = (kind: 'today' | 'week' | 'month' | 'year'): void => {
    const today = todayISO()
    const d = new Date()
    if (kind === 'today') {
      setFrom(today)
      setTo(today)
    } else if (kind === 'week') {
      const start = new Date(d)
      start.setDate(d.getDate() - 6)
      setFrom(start.toISOString().slice(0, 10))
      setTo(today)
    } else if (kind === 'month') {
      setFrom(startOfMonthISO())
      setTo(today)
    } else if (kind === 'year') {
      setFrom(`${d.getFullYear()}-01-01`)
      setTo(today)
    }
  }

  return (
    <>
      <PageHeader
        title="التقارير"
        subtitle="تحليل الأداء المالي حسب الفترة والصنف"
        actions={
          <>
            <button className="btn-secondary" onClick={() => exportPDF.mutate()}>
              <FileText size={18} />
              تصدير PDF
            </button>
            <button className="btn-secondary" onClick={() => exportExcel.mutate()}>
              <FileSpreadsheet size={18} />
              تصدير Excel
            </button>
          </>
        }
      />

      <div className="card p-5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="label">من</label>
            <input type="date" className="input num" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">إلى</label>
            <input type="date" className="input num" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label">التصنيف</label>
            <select
              className="input"
              value={categoryId ?? ''}
              onChange={(e) => {
                setCategoryId(e.target.value ? Number(e.target.value) : null)
                setItemId(null)
              }}
            >
              <option value="">كل التصنيفات</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name_ar}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">الصنف</label>
            <select
              className="input"
              value={itemId ?? ''}
              onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">كل الأصناف</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name_ar}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="chip" onClick={() => setQuick('today')}>اليوم</button>
          <button className="chip" onClick={() => setQuick('week')}>آخر ٧ أيام</button>
          <button className="chip" onClick={() => setQuick('month')}>هذا الشهر</button>
          <button className="chip" onClick={() => setQuick('year')}>هذا العام</button>
        </div>
      </div>

      {isLoading || !summary ? (
        <div className="card p-10 text-center text-ink-muted">جارِ التحميل...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard label="إجمالي الإيرادات" value={fmtMoney(summary.income_total)} icon={<TrendingUp size={20} />} tone="good" />
            <StatCard label="عدد المعاملات" value={fmtNumber(summary.tx_count)} icon={<Receipt size={20} />} tone="brand" />
            <StatCard label="السحوبات" value={fmtMoney(summary.withdrawals_total)} icon={<Wallet size={20} />} tone="warn" />
            <StatCard label="المشتريات" value={fmtMoney(summary.inventory_total)} icon={<Package size={20} />} />
          </div>

          <div className="card p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-base font-bold">الصافي بعد المصاريف</div>
              <BarChart3 size={18} className="text-ink-soft" />
            </div>
            <div className="text-3xl font-extrabold num">{fmtMoney(summary.net_total)}</div>
            <div className="text-xs text-ink-muted mt-1">
              الإيرادات − (السحوبات + الإيجار + المشتريات)
            </div>
          </div>

          {summary.by_day.length > 0 && (
            <div className="card p-5 mb-4">
              <div className="font-bold mb-4">الإيرادات اليومية</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...summary.by_day]}>
                    <CartesianGrid stroke="rgb(var(--bg-subtle))" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'rgb(var(--ink-muted))' }}
                      stroke="rgb(var(--ink-soft))"
                      reversed
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'rgb(var(--ink-muted))' }}
                      stroke="rgb(var(--ink-soft))"
                      orientation="right"
                    />
                    <Tooltip
                      contentStyle={{
                        direction: 'rtl' as const,
                        backgroundColor: 'rgb(var(--bg-card))',
                        border: '1px solid rgb(var(--bg-subtle))',
                        borderRadius: 12,
                        color: 'rgb(var(--ink))',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
                      }}
                      labelStyle={{ color: 'rgb(var(--ink))', fontWeight: 700 }}
                      itemStyle={{ color: 'rgb(var(--ink))' }}
                      cursor={{ stroke: 'rgb(var(--ink-soft))', strokeWidth: 1 }}
                    />
                    <Line type="monotone" dataKey="income" stroke="#2F857F" strokeWidth={2.5} dot={{ r: 3, fill: '#2F857F' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {summary.by_payment_method.length > 0 && (
            <div className="card p-5 mb-4">
              <div className="font-bold mb-3">حسب طريقة الدفع</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {summary.by_payment_method.map((p, i) => (
                  <div key={i} className="card p-3 text-center bg-bg-subtle/50">
                    <div className="text-xs text-ink-muted mb-1">{p.method}</div>
                    <div className="text-lg font-extrabold num">{fmtMoney(p.total)}</div>
                    <div className="text-[11px] text-ink-soft num mt-0.5">{p.count} معاملة</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-subtle font-bold">المبيعات حسب الصنف</div>
              {summary.by_item.length === 0 ? (
                <div className="p-6 text-center text-ink-muted text-sm">لا توجد بيانات</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>الصنف</th>
                      <th className="text-center">الكمية</th>
                      <th className="text-left">الإيراد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.by_item.map((it, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{it.name}</td>
                        <td className="text-center num">{fmtNumber(it.quantity)}</td>
                        <td className="text-left num font-bold">{fmtMoney(it.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-subtle font-bold">المبيعات حسب التصنيف</div>
              {summary.by_category.length === 0 ? (
                <div className="p-6 text-center text-ink-muted text-sm">لا توجد بيانات</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>التصنيف</th>
                      <th className="text-left">الإيراد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.by_category.map((c, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{c.name}</td>
                        <td className="text-left num font-bold">{fmtMoney(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
