import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  PlusCircle,
  ListChecks,
  Users,
  Wallet,
  Building2,
  Package,
  BarChart3,
  Settings as SettingsIcon,
  HandCoins,
  CalculatorIcon,
  Trash2,
  Camera,
  Calendar,
  PackageOpen,
  Bell
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface LinkDef {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  isActive?: (pathname: string) => boolean
}

const links: LinkDef[] = [
  { to: '/', label: 'الرئيسية', icon: Home, end: true },
  {
    to: '/transactions/new',
    label: 'معاملة جديدة',
    icon: PlusCircle,
    isActive: (p) => p === '/transactions/new' || p.endsWith('/edit')
  },
  {
    to: '/transactions',
    label: 'المعاملات',
    icon: ListChecks,
    isActive: (p) =>
      p === '/transactions' ||
      (p.startsWith('/transactions/') && p !== '/transactions/new' && !p.endsWith('/edit'))
  },
  {
    to: '/clients',
    label: 'العملاء',
    icon: Users,
    isActive: (p) => p === '/clients' || p.startsWith('/clients/')
  },
  { to: '/debtors', label: 'العملاء المدينون', icon: HandCoins, end: true },
  { to: '/pickups', label: 'طلبات قيد التسليم', icon: PackageOpen, end: true },
  { to: '/bookings', label: 'حجوزات الجلسات', icon: Calendar, end: true },
  { to: '/reminders', label: 'التذكيرات', icon: Bell, end: true },
  { to: '/cash-close', label: 'تقفيلة اليوم', icon: CalculatorIcon, end: true },
  { to: '/withdrawals', label: 'السحوبات النقدية', icon: Wallet, end: true },
  { to: '/rent', label: 'الإيجار', icon: Building2, end: true },
  { to: '/inventory', label: 'المشتريات', icon: Package, end: true },
  { to: '/reports', label: 'التقارير', icon: BarChart3, end: true },
  { to: '/recycle', label: 'سلة المحذوفات', icon: Trash2, end: true },
  { to: '/settings', label: 'الإعدادات', icon: SettingsIcon, end: true }
]

export function Sidebar(): JSX.Element {
  const loc = useLocation()
  return (
    <aside className="w-64 shrink-0 bg-bg-card border-l border-bg-subtle flex flex-col">
      <div className="px-5 py-5 border-b border-bg-subtle">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-soft">
            <Camera size={22} />
          </div>
          <div className="flex flex-col">
            <div className="text-base font-extrabold text-ink leading-tight">نظام إدارة الاستوديو</div>
            <div className="text-xs text-ink-muted">مبيعات • عملاء • مصاريف</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((l) => {
          const Icon = l.icon
          const active = l.isActive
            ? l.isActive(loc.pathname)
            : l.end
              ? loc.pathname === l.to
              : loc.pathname.startsWith(l.to)
          return (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={() => cn('nav-link', active && 'active')}
            >
              <Icon size={20} />
              <span>{l.label}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="px-5 py-4 border-t border-bg-subtle">
        <div className="text-xs text-ink-muted text-center leading-relaxed">
          صُمِّم وطُوِّر بواسطة
          <div className="font-bold text-ink mt-0.5">أمير شتية</div>
          <div className="text-[10px] text-ink-soft mt-1">© ٢٠٢٦ جميع الحقوق محفوظة</div>
        </div>
      </div>
    </aside>
  )
}
