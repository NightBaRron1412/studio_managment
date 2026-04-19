import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function EmptyState({
  title,
  hint,
  icon,
  action
}: {
  title: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-subtle flex items-center justify-center text-ink-soft mb-4">
        {icon ?? <Inbox size={28} />}
      </div>
      <h3 className="text-lg font-bold text-ink mb-1">{title}</h3>
      {hint && <p className="text-ink-muted max-w-md leading-relaxed">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
