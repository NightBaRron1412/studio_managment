import { useToast } from '@/store/toast'
import { CheckCircle2, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Toaster(): JSX.Element {
  const items = useToast((s) => s.items)
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-2xl px-5 py-3 shadow-lift text-[15px] font-semibold',
            t.kind === 'success' && 'bg-good text-white',
            t.kind === 'error' && 'bg-bad text-white',
            t.kind === 'info' && 'bg-brand-700 text-white'
          )}
        >
          {t.kind === 'success' && <CheckCircle2 size={20} />}
          {t.kind === 'error' && <XCircle size={20} />}
          {t.kind === 'info' && <Info size={20} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
