// Arabic-aware formatting helpers.

let currencySymbol = 'ج.م'
let numeralsStyle: 'western' | 'arabic-indic' = 'western'

export function setFormatPrefs(opts: { currency?: string; numerals?: 'western' | 'arabic-indic' }): void {
  if (opts.currency) currencySymbol = opts.currency
  if (opts.numerals) numeralsStyle = opts.numerals
}

export function getCurrency(): string {
  return currencySymbol
}

const arabicIndicMap: Record<string, string> = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'
}

function maybeArabic(s: string): string {
  if (numeralsStyle !== 'arabic-indic') return s
  return s.replace(/[0-9]/g, (d) => arabicIndicMap[d] || d)
}

export function fmtNumber(n: number | string | null | undefined, decimals = 0): string {
  const v = Number(n) || 0
  const s = v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  return maybeArabic(s)
}

export function fmtMoney(n: number | string | null | undefined, decimals = 2): string {
  const v = Number(n) || 0
  const isWhole = Math.abs(v - Math.round(v)) < 0.0001
  const dec = isWhole ? 0 : decimals
  return `${fmtNumber(v, dec)} ${currencySymbol}`
}

const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

export function fmtDateLong(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (isNaN(d.getTime())) return ''
  return `${arabicDays[d.getDay()]} ${maybeArabic(String(d.getDate()))} ${arabicMonths[d.getMonth()]} ${maybeArabic(String(d.getFullYear()))}`
}

export function fmtDateShort(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return maybeArabic(`${day}/${month}/${d.getFullYear()}`)
}

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthLabel(year: number, month: number): string {
  return `${arabicMonths[month - 1]} ${maybeArabic(String(year))}`
}
