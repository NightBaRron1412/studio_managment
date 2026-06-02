import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtMoney, monthRange } from '@/lib/format'
import { Wallet, Package, Building2 } from 'lucide-react'

// Combined spending for one month: withdrawals + supplier purchases + rent
// paid. Query keys match the Withdrawals/Inventory/Rent pages so react-query
// dedupes the fetches when this card sits alongside one of those lists.
export function MonthlySpendSummary({ year, month }: { year: number; month: number }): JSX.Element {
  const { from, to } = monthRange(year, month)

  const { data: withdrawals = [] } = useQuery({
    queryKey: ['withdrawals', from, to],
    queryFn: () => api.withdrawalsList({ date_from: from, date_to: to })
  })
  const { data: purchases = [] } = useQuery({
    queryKey: ['inventory', from, to],
    queryFn: () => api.inventoryList({ date_from: from, date_to: to })
  })
  const { data: rent } = useQuery({
    queryKey: ['rent', year, month],
    queryFn: () => api.rentForMonth(year, month)
  })

  const withdrawalsTotal = withdrawals.reduce((s, w) => s + w.amount, 0)
  const purchasesTotal = purchases.reduce((s, p) => s + p.cost, 0)
  const rentTotal = rent?.paid ?? 0
  const total = withdrawalsTotal + purchasesTotal + rentTotal

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-ink-muted">إجمالي مصاريف الشهر</span>
        <span className="text-2xl font-extrabold num text-warn">{fmtMoney(total)}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-bg-subtle p-3">
          <div className="flex items-center justify-center gap-1.5 text-ink-muted text-xs mb-1">
            <Wallet size={14} />
            السحوبات
          </div>
          <div className="num font-bold">{fmtMoney(withdrawalsTotal)}</div>
        </div>
        <div className="rounded-xl bg-bg-subtle p-3">
          <div className="flex items-center justify-center gap-1.5 text-ink-muted text-xs mb-1">
            <Package size={14} />
            المشتريات
          </div>
          <div className="num font-bold">{fmtMoney(purchasesTotal)}</div>
        </div>
        <div className="rounded-xl bg-bg-subtle p-3">
          <div className="flex items-center justify-center gap-1.5 text-ink-muted text-xs mb-1">
            <Building2 size={14} />
            الإيجار
          </div>
          <div className="num font-bold">{fmtMoney(rentTotal)}</div>
        </div>
      </div>
    </div>
  )
}
