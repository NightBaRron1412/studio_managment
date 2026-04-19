import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { fmtMoney, fmtNumber } from '@/lib/format'
import { StatCard } from '@/components/StatCard'
import { PageHeader } from '@/components/PageHeader'
import {
  Banknote,
  Receipt,
  Wallet,
  Building2,
  Package,
  TrendingUp,
  AlertCircle,
  Users,
  HandCoins,
  Calendar,
  PackageOpen,
  Bell,
  TrendingDown
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/ui/EmptyState'

function WeeklyTile({ current, previous }: { current: number; previous: number }): JSX.Element {
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0
  const up = delta >= 0
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-muted">إيرادات الأسبوع</span>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {up ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
        </div>
      </div>
      <div className="text-2xl font-extrabold text-ink num mt-1">{fmtMoney(current)}</div>
      <div className={`text-xs num ${up ? 'text-good' : 'text-bad'}`}>
        {up ? '+' : ''}
        {Math.abs(delta).toFixed(0)}% من الأسبوع السابق
      </div>
    </div>
  )
}

export function Dashboard(): JSX.Element {
  const nav = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.dashboard() })

  if (isLoading || !data) {
    return (
      <>
        <PageHeader title="الرئيسية" subtitle="نظرة عامة على نشاط الاستوديو اليوم وهذا الشهر" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-28" />
          ))}
        </div>
      </>
    )
  }

  const rentOverdue = data.rent_remaining_month > 0 && new Date().getDate() >= 25

  return (
    <>
      <PageHeader title="الرئيسية" subtitle="نظرة عامة على نشاط الاستوديو اليوم وهذا الشهر" />

      {/* Alerts row */}
      <div className="space-y-3 mb-6">
        {data.outstanding_total > 0 && (
          <div
            className="card p-4 border-r-4 border-r-warn bg-amber-50/50 flex items-center gap-3 cursor-pointer hover:bg-amber-50"
            onClick={() => nav('/debtors')}
          >
            <HandCoins className="text-warn shrink-0" size={22} />
            <div className="flex-1">
              <div className="font-bold text-ink">
                {fmtNumber(data.debtor_count)} عميل عليهم {fmtMoney(data.outstanding_total)}
              </div>
              <div className="text-sm text-ink-muted">اضغط لعرض المدينين وتسجيل الدفعات.</div>
            </div>
            <span className="chip">عرض</span>
          </div>
        )}
        {data.pending_pickups > 0 && (
          <div
            className="card p-4 border-r-4 border-r-brand-500 bg-brand-50/50 flex items-center gap-3 cursor-pointer hover:bg-brand-50"
            onClick={() => nav('/pickups')}
          >
            <PackageOpen className="text-brand-600 shrink-0" size={22} />
            <div className="flex-1">
              <div className="font-bold text-ink">
                {fmtNumber(data.pending_pickups)} طلب قيد التسليم
              </div>
              <div className="text-sm text-ink-muted">اضغط لإدارة الطلبات وتحديث الحالة.</div>
            </div>
            <span className="chip">عرض</span>
          </div>
        )}
        {data.bookings_today > 0 && (
          <div
            className="card p-4 border-r-4 border-r-brand-500 bg-brand-50/50 flex items-center gap-3 cursor-pointer hover:bg-brand-50"
            onClick={() => nav('/bookings')}
          >
            <Calendar className="text-brand-600 shrink-0" size={22} />
            <div className="flex-1">
              <div className="font-bold text-ink">
                {fmtNumber(data.bookings_today)} حجز جلسة اليوم
              </div>
              <div className="text-sm text-ink-muted">اضغط لعرض مواعيد جلسات اليوم.</div>
            </div>
            <span className="chip">عرض</span>
          </div>
        )}
        {data.reminders_due > 0 && (
          <div
            className="card p-4 border-r-4 border-r-bad bg-red-50/50 flex items-center gap-3 cursor-pointer hover:bg-red-50"
            onClick={() => nav('/reminders')}
          >
            <Bell className="text-bad shrink-0" size={22} />
            <div className="flex-1">
              <div className="font-bold text-ink">
                {fmtNumber(data.reminders_due)} تذكير مستحق
              </div>
              <div className="text-sm text-ink-muted">اضغط لمراجعة المهام التي حان موعدها.</div>
            </div>
            <span className="chip">عرض</span>
          </div>
        )}
      </div>

      {rentOverdue && (
        <div className="mb-6 card p-4 border-r-4 border-r-amber-400 bg-amber-50/50 flex items-center gap-3">
          <AlertCircle className="text-amber-600 shrink-0" size={22} />
          <div className="flex-1">
            <div className="font-bold text-ink">باقي على الإيجار {fmtMoney(data.rent_remaining_month)}</div>
            <div className="text-sm text-ink-muted">قارب الشهر على الانتهاء — لا تنسَ تسوية مبلغ الإيجار.</div>
          </div>
          <button className="btn-secondary btn-sm" onClick={() => nav('/rent')}>
            متابعة الإيجار
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="إيرادات اليوم"
          value={fmtMoney(data.income_today)}
          hint={`${fmtNumber(data.tx_count_today)} معاملة`}
          icon={<Banknote size={20} />}
          tone="brand"
        />
        <StatCard
          label="إيرادات الشهر"
          value={fmtMoney(data.income_month)}
          hint={`${fmtNumber(data.tx_count_month)} معاملة`}
          icon={<TrendingUp size={20} />}
          tone="good"
        />
        <StatCard
          label="السحوبات (الشهر)"
          value={fmtMoney(data.withdrawals_month)}
          icon={<Wallet size={20} />}
          tone="warn"
        />
        <StatCard
          label="المشتريات (الشهر)"
          value={fmtMoney(data.inventory_month)}
          icon={<Package size={20} />}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="عملاء نشطون (الشهر)"
          value={fmtNumber(data.active_clients_month)}
          hint="عملاء عملوا معاملة على الأقل"
          icon={<Users size={20} />}
          tone="brand"
        />
        <StatCard
          label="مستحقات آجلة"
          value={fmtMoney(data.outstanding_total)}
          hint={`${fmtNumber(data.debtor_count)} عميل مدين`}
          icon={<HandCoins size={20} />}
          tone={data.outstanding_total > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="إيجار متبقي"
          value={fmtMoney(data.rent_remaining_month)}
          hint={`من أصل ${fmtMoney(data.rent_required_month)}`}
          icon={<Building2 size={20} />}
          tone={data.rent_remaining_month > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="صافي الشهر"
          value={fmtMoney(data.net_month)}
          hint="بعد المصاريف"
          icon={<Receipt size={20} />}
          tone={data.net_month >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="حجوزات قادمة"
          value={fmtNumber(data.bookings_upcoming)}
          hint={data.bookings_today > 0 ? `${fmtNumber(data.bookings_today)} اليوم` : 'لا يوجد اليوم'}
          icon={<Calendar size={20} />}
          tone="brand"
        />
        <StatCard
          label="طلبات قيد التسليم"
          value={fmtNumber(data.pending_pickups)}
          icon={<PackageOpen size={20} />}
          tone={data.pending_pickups > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="تذكيرات مستحقة"
          value={fmtNumber(data.reminders_due)}
          icon={<Bell size={20} />}
          tone={data.reminders_due > 0 ? 'bad' : 'good'}
        />
        <WeeklyTile current={data.income_week} previous={data.income_week_prev} />
      </div>

      <div className="card p-5" id="top-items">
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-bold text-ink">الأكثر مبيعاً هذا الشهر</div>
        </div>
        {data.top_items.length === 0 ? (
          <EmptyState title="لم تُسجّل أي مبيعات بعد هذا الشهر" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-bg-subtle">
            <table className="table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th className="text-center">الكمية</th>
                  <th className="text-left">الإيراد</th>
                </tr>
              </thead>
              <tbody>
                {data.top_items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.name}</td>
                    <td className="text-center num">{fmtNumber(it.quantity)}</td>
                    <td className="text-left num font-semibold">{fmtMoney(it.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
