import { ChevronRight, ChevronLeft } from 'lucide-react'
import { monthLabel } from '@/lib/format'

// Prev/next month header. Month is 1-based; rollover across year boundaries
// is handled internally so callers just store {year, month} state.
export function MonthNav({
  year,
  month,
  onChange
}: {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}): JSX.Element {
  const goPrev = (): void => {
    if (month === 1) onChange(year - 1, 12)
    else onChange(year, month - 1)
  }
  const goNext = (): void => {
    if (month === 12) onChange(year + 1, 1)
    else onChange(year, month + 1)
  }

  return (
    <div className="flex items-center justify-between">
      <button className="btn-secondary btn-sm" onClick={goPrev}>
        <ChevronRight size={16} />
        الشهر السابق
      </button>
      <div className="text-2xl font-extrabold text-ink">{monthLabel(year, month)}</div>
      <button className="btn-secondary btn-sm" onClick={goNext}>
        الشهر التالي
        <ChevronLeft size={16} />
      </button>
    </div>
  )
}
