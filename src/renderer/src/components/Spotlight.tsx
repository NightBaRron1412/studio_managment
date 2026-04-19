import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Search, Receipt, User, ArrowLeft, Hash, Home, PlusCircle, ListChecks, Users, Wallet, Building2, Package, BarChart3, Settings as SettingsIcon, HandCoins, CalculatorIcon, Trash2 } from 'lucide-react'
import { fmtMoney, fmtDateShort } from '@/lib/format'

const PAGES = [
  { to: '/', label: 'الرئيسية', icon: Home, hint: 'لوحة المعلومات' },
  { to: '/transactions/new', label: 'معاملة جديدة', icon: PlusCircle, hint: 'تسجيل بيع' },
  { to: '/transactions', label: 'المعاملات', icon: ListChecks, hint: 'قائمة المعاملات' },
  { to: '/clients', label: 'العملاء', icon: Users, hint: 'قائمة العملاء' },
  { to: '/debtors', label: 'المدينون', icon: HandCoins, hint: 'العملاء الآجلون' },
  { to: '/cash-close', label: 'تقفيلة اليوم', icon: CalculatorIcon, hint: 'حساب الخزنة' },
  { to: '/withdrawals', label: 'السحوبات النقدية', icon: Wallet, hint: '' },
  { to: '/rent', label: 'الإيجار', icon: Building2, hint: '' },
  { to: '/inventory', label: 'المشتريات', icon: Package, hint: '' },
  { to: '/reports', label: 'التقارير', icon: BarChart3, hint: '' },
  { to: '/recycle', label: 'سلة المحذوفات', icon: Trash2, hint: '' },
  { to: '/settings', label: 'الإعدادات', icon: SettingsIcon, hint: '' }
]

interface Props {
  open: boolean
  onClose: () => void
}

export function Spotlight({ open, onClose }: Props): JSX.Element | null {
  const nav = useNavigate()
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', q],
    queryFn: () => api.clientsList(q),
    enabled: open && q.trim().length > 0
  })
  const { data: txs = [] } = useQuery({
    queryKey: ['transactions', q],
    queryFn: () => api.transactionsList({ q }),
    enabled: open && q.trim().length > 0
  })

  const filteredPages = useMemo(() => {
    const s = q.trim()
    if (!s) return PAGES
    return PAGES.filter((p) => p.label.includes(s) || p.hint.includes(s))
  }, [q])

  if (!open) return null

  const hasQuery = q.trim().length > 0

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl card overflow-hidden flex flex-col max-h-[70vh]">
        <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-3">
          <Search className="text-ink-muted shrink-0" size={22} />
          <input
            autoFocus
            className="flex-1 bg-transparent text-xl outline-none text-ink placeholder:text-ink-soft py-1"
            placeholder="ابحث عن صفحة، عميل، أو فاتورة..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd className="text-xs text-ink-muted bg-bg-subtle rounded-md px-2 py-1 num font-bold">Esc</kbd>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredPages.length > 0 && (
            <Section title="صفحات">
              {filteredPages.map((p) => {
                const Icon = p.icon
                return (
                  <Row
                    key={p.to}
                    icon={<Icon size={16} />}
                    label={p.label}
                    sub={p.hint}
                    onClick={() => {
                      nav(p.to)
                      onClose()
                    }}
                  />
                )
              })}
            </Section>
          )}
          {hasQuery && clients.length > 0 && (
            <Section title="عملاء">
              {clients.slice(0, 5).map((c) => (
                <Row
                  key={c.id}
                  icon={<User size={16} />}
                  label={c.name}
                  sub={[c.phone, c.visit_count > 0 ? `${c.visit_count} زيارة` : null]
                    .filter(Boolean)
                    .join(' • ')}
                  onClick={() => {
                    nav(`/clients/${c.id}`)
                    onClose()
                  }}
                />
              ))}
            </Section>
          )}
          {hasQuery && txs.length > 0 && (
            <Section title="معاملات">
              {txs.slice(0, 5).map((t) => (
                <Row
                  key={t.id}
                  icon={<Receipt size={16} />}
                  label={`${t.transaction_no} — ${t.client_name || 'بدون عميل'}`}
                  sub={`${fmtDateShort(t.date)} • ${fmtMoney(t.total)}`}
                  onClick={() => {
                    nav(`/transactions/${t.id}`)
                    onClose()
                  }}
                />
              ))}
            </Section>
          )}
          {hasQuery && filteredPages.length === 0 && clients.length === 0 && txs.length === 0 && (
            <div className="text-center py-12 text-ink-muted">لا توجد نتائج</div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-bg-subtle text-xs text-ink-muted flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Hash size={12} />
            البحث الذكي
          </span>
          <span className="me-auto" />
          <span className="flex items-center gap-1">
            <ArrowLeft size={12} />
            للاختيار
          </span>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-xs font-bold text-ink-muted uppercase tracking-wide">
        {title}
      </div>
      <div>{children}</div>
    </div>
  )
}
function Row({
  icon,
  label,
  sub,
  onClick
}: {
  icon: React.ReactNode
  label: string
  sub?: string | null
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="w-full text-right px-4 py-3 hover:bg-bg-subtle flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-lg bg-bg-subtle flex items-center justify-center text-ink-muted shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-ink truncate">{label}</div>
        {sub && <div className="text-xs text-ink-muted truncate">{sub}</div>}
      </div>
    </button>
  )
}
