import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Search } from 'lucide-react'
import type { Item } from '@shared/types'
import { Dialog } from './ui/Dialog'
import { fmtMoney } from '@/lib/format'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (item: Item) => void
}

export function ItemPicker({ open, onClose, onPick }: Props): JSX.Element {
  const [q, setQ] = useState('')
  const [catId, setCatId] = useState<number | null>(null)
  const { data: cats = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.categoriesList() })
  const { data: items = [] } = useQuery({
    queryKey: ['items', 'active', catId],
    queryFn: () => api.itemsList({ only_active: true, category_id: catId ?? undefined })
  })

  const filtered = items.filter((i) => !q.trim() || i.name_ar.includes(q.trim()))

  return (
    <Dialog open={open} onClose={onClose} title="اختيار صنف" size="lg">
      <div className="flex flex-col gap-3 mb-4">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-ink-soft" size={18} />
          <input
            autoFocus
            className="input pr-10"
            placeholder="ابحث عن صنف"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={`chip ${catId === null ? 'bg-brand-600 text-white' : ''}`}
            onClick={() => setCatId(null)}
          >
            الكل
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              className={`chip ${catId === c.id ? 'bg-brand-600 text-white' : ''}`}
              onClick={() => setCatId(c.id)}
            >
              {c.name_ar}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
        {filtered.map((it) => (
          <button
            key={it.id}
            className="text-right p-3 rounded-xl border border-bg-subtle hover:border-brand-300 hover:bg-brand-50/30 transition"
            onClick={() => {
              onPick(it)
              onClose()
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-ink">{it.name_ar}</div>
                <div className="text-xs text-ink-muted">
                  {it.category_name || 'بدون تصنيف'}
                  {it.size ? ` • ${it.size}` : ''}
                </div>
              </div>
              <div className="font-bold text-brand-700 num shrink-0">{fmtMoney(it.default_price)}</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-10 text-ink-muted">
            لا توجد أصناف. يمكنك إضافتها من الإعدادات.
          </div>
        )}
      </div>
    </Dialog>
  )
}
