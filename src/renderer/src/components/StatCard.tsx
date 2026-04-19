import { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default'
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'brand'
}): JSX.Element {
  const toneStyles =
    tone === 'good'
      ? 'bg-emerald-50 text-emerald-700'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-700'
        : tone === 'bad'
          ? 'bg-red-50 text-red-700'
          : tone === 'brand'
            ? 'bg-brand-50 text-brand-700'
            : 'bg-bg-subtle text-ink-muted'

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-muted">{label}</span>
        {icon && (
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', toneStyles)}>
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-extrabold text-ink num mt-1">{value}</div>
      {hint && <div className="text-xs text-ink-muted">{hint}</div>}
    </div>
  )
}
