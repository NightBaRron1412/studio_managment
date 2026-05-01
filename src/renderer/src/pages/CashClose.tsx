import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateLong, fmtDateShort, todayISO } from '@/lib/format'
import { Calculator, ArrowDownCircle, ArrowUpCircle, History, Save, ChevronRight, ChevronLeft } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'

export function CashClose(): JSX.Element {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [actual, setActual] = useState('')
  const [opening, setOpening] = useState('')
  const [note, setNote] = useState('')

  // Selected date — defaults to today, but the URL ?date= param lets the
  // dashboard alert and the missed-close toast deep-link straight to a
  // specific past day so the user can backfill it without manual nav.
  const todayStr = todayISO()
  const selectedDate = searchParams.get('date') || todayStr
  const isToday = selectedDate === todayStr

  const { data: today, isLoading } = useQuery({
    queryKey: ['cash-close-today', selectedDate],
    queryFn: () => api.cashCloseToday(selectedDate)
  })
  const { data: history = [] } = useQuery({
    queryKey: ['cash-close-list'],
    queryFn: () => api.cashCloseList()
  })

  useEffect(() => {
    if (today?.closed) {
      setActual(String(today.closed.actual_cash))
      setOpening(String(today.closed.opening_float ?? 0))
      setNote(today.closed.note || '')
    } else if (today) {
      // First time closing today: opening defaults to yesterday's actual
      // (or 0 for the very first day). Expected starts at the suggested
      // value which already includes the float.
      setOpening(String(today.opening_float))
      setActual(String(today.expected_cash))
    }
  }, [today])

  // Recompute the expected number live as the user adjusts the opening
  // float — matches the same formula the repo uses on submit.
  const openingNum = Number(opening) || 0
  const liveExpected = Number(
    (openingNum + (today?.cash_in ?? 0) - (today?.cash_out ?? 0)).toFixed(2)
  )

  const submit = useMutation({
    mutationFn: () =>
      api.cashCloseSubmit({
        date: today?.date ?? new Date().toISOString().slice(0, 10),
        actual_cash: Number(actual) || 0,
        opening_float: openingNum,
        note: note.trim() || null
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-close-today'] })
      qc.invalidateQueries({ queryKey: ['cash-close-list'] })
      qc.invalidateQueries({ queryKey: ['cash-close-missed'] })
      toast.success(isToday ? 'تم تسجيل تقفيلة اليوم' : `تم تسجيل تقفيلة ${fmtDateShort(today!.date)}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  if (isLoading || !today) return <div className="p-6 text-ink-muted">جارِ التحميل...</div>

  const diff = Number(actual || 0) - liveExpected
  const diffColor = Math.abs(diff) < 0.01 ? 'text-good' : diff > 0 ? 'text-brand-700' : 'text-bad'

  return (
    <>
      <PageHeader
        title={isToday ? 'تقفيلة اليوم' : `تقفيلة ${fmtDateShort(today.date)}`}
        subtitle={fmtDateLong(today.date)}
      />

      {/* Date navigation — lets the user backfill a day they forgot to
          close. Future dates are blocked at the input level. The "اليوم"
          button is a one-click reset to the current date. */}
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-2">
        <button
          className="btn-secondary btn-sm"
          onClick={() => {
            const d = new Date(today.date + 'T00:00:00')
            d.setDate(d.getDate() - 1)
            const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            setSearchParams({ date: prev })
          }}
          title="اليوم السابق"
        >
          <ChevronRight size={16} />
          السابق
        </button>
        <input
          type="date"
          className="input num text-center w-44"
          dir="ltr"
          max={todayStr}
          value={selectedDate}
          onChange={(e) => {
            const v = e.target.value
            if (!v) return
            if (v > todayStr) return
            if (v === todayStr) setSearchParams({})
            else setSearchParams({ date: v })
          }}
        />
        <button
          className="btn-secondary btn-sm"
          disabled={isToday}
          onClick={() => {
            const d = new Date(today.date + 'T00:00:00')
            d.setDate(d.getDate() + 1)
            const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            if (next > todayStr) setSearchParams({})
            else setSearchParams({ date: next })
          }}
          title="اليوم التالي"
        >
          التالي
          <ChevronLeft size={16} />
        </button>
        {!isToday && (
          <button className="btn-primary btn-sm mr-auto" onClick={() => setSearchParams({})}>
            ↻ اليوم
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={20} className="text-brand-600" />
              <h3 className="font-bold text-lg">حساب اليوم</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="card p-4 bg-emerald-50/50 border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-700 mb-1">
                  <ArrowDownCircle size={16} />
                  <span className="text-sm font-semibold">داخل (نقدي)</span>
                </div>
                <div className="text-2xl font-extrabold num text-emerald-700">{fmtMoney(today.cash_in)}</div>
                <div className="text-xs text-ink-muted mt-1">المبيعات النقدية اليوم</div>
              </div>
              <div className="card p-4 bg-red-50/50 border-red-100">
                <div className="flex items-center gap-2 text-red-700 mb-1">
                  <ArrowUpCircle size={16} />
                  <span className="text-sm font-semibold">خارج</span>
                </div>
                <div className="text-2xl font-extrabold num text-red-700">{fmtMoney(today.cash_out)}</div>
                <div className="text-xs text-ink-muted mt-1">
                  سحوبات + إيجار + مشتريات
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-bg-subtle p-4 mb-5 space-y-3">
              <div>
                <label className="label">المبلغ الافتتاحي في الخزنة (باقي الأمس)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="input num text-center"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                />
                <div className="text-[10px] text-ink-muted mt-1">
                  يُملأ تلقائياً بقيمة آخر تقفيلة. عدِّله إذا أخذت بعض النقود معك ليلة أمس.
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-bg pt-3">
                <span className="text-ink-muted">المبلغ المتوقع في الخزنة</span>
                <span className="text-2xl font-extrabold num">{fmtMoney(liveExpected)}</span>
              </div>
              <div className="text-xs text-ink-muted mt-1">الافتتاحي + داخل − خارج</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">المبلغ الفعلي في الخزنة</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="input num text-center text-2xl py-4"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                />
              </div>

              <div className={`rounded-xl p-3 text-center font-bold ${
                Math.abs(diff) < 0.01 ? 'bg-emerald-50' : diff > 0 ? 'bg-brand-50' : 'bg-red-50'
              }`}>
                <div className="text-sm text-ink-muted mb-1">الفرق</div>
                <div className={`text-2xl num ${diffColor}`}>
                  {diff >= 0 ? '+' : ''}
                  {fmtMoney(diff)}
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  {Math.abs(diff) < 0.01 ? 'مطابق ✓' : diff > 0 ? 'زيادة في الخزنة' : 'نقص في الخزنة'}
                </div>
              </div>

              <div>
                <label className="label">ملاحظة (اختياري)</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="سبب الفرق إن وُجد..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button
                className="btn-primary btn-lg w-full"
                disabled={submit.isPending}
                onClick={() => submit.mutate()}
              >
                <Save size={18} />
                {today.closed ? 'تحديث التقفيلة' : 'تأكيد التقفيلة'}
              </button>

              {today.closed && (
                <div className="text-sm text-ink-muted text-center">
                  تم التقفيل سابقاً — يمكنك التعديل في أي وقت
                </div>
              )}
            </div>
          </div>
        </div>

        <aside>
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-2">
              <History size={18} className="text-brand-600" />
              <h3 className="font-bold">تقفيلات سابقة</h3>
            </div>
            {history.length === 0 ? (
              <EmptyState title="لا توجد تقفيلات سابقة" />
            ) : (
              <div className="divide-y divide-bg-subtle max-h-[600px] overflow-y-auto">
                {history.map((c) => (
                  <div key={c.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold num">{fmtDateShort(c.date)}</div>
                      <div className={`num font-bold ${
                        Math.abs(c.difference) < 0.01 ? 'text-good' : c.difference > 0 ? 'text-brand-700' : 'text-bad'
                      }`}>
                        {c.difference >= 0 ? '+' : ''}
                        {fmtMoney(c.difference)}
                      </div>
                    </div>
                    <div className="text-xs text-ink-muted">
                      متوقع <span className="num">{fmtMoney(c.expected_cash)}</span> •
                      فعلي <span className="num">{fmtMoney(c.actual_cash)}</span>
                    </div>
                    {c.note && <div className="text-xs text-ink-muted mt-1 italic">"{c.note}"</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
