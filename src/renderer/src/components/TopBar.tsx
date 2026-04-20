import { useEffect, useState } from 'react'
import { Database, Download, Upload, PlusCircle, Search, Sun, Moon, Eye, EyeOff } from 'lucide-react'
import { fmtDateLong } from '@/lib/format'
import { api } from '@/lib/api'
import { toast } from '@/store/toast'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from './ui/Dialog'

interface Props {
  businessName: string
  theme: 'light' | 'dark'
  privacyMode: boolean
  onToggleTheme: () => void
  onTogglePrivacy: () => void
  onOpenSpotlight: () => void
}

export function TopBar({
  businessName,
  theme,
  privacyMode,
  onToggleTheme,
  onTogglePrivacy,
  onOpenSpotlight
}: Props): JSX.Element {
  const [now, setNow] = useState(new Date())
  const [askRestore, setAskRestore] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const onBackup = async (): Promise<void> => {
    try {
      const res = await api.backup()
      if ('canceled' in res) return
      toast.success('تم حفظ النسخة الاحتياطية')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل النسخ الاحتياطي')
    }
  }

  const onRestore = async (): Promise<void> => {
    try {
      const res = await api.restore()
      if ('canceled' in res) return
      toast.success('تم استعادة النسخة بنجاح')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الاستعادة')
    }
  }

  return (
    <header className="h-16 shrink-0 bg-bg-card border-b border-bg-subtle px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div>
          <div className="text-base font-bold text-ink">{businessName || 'نظام إدارة الاستوديو'}</div>
          <div className="text-xs text-ink-muted">{fmtDateLong(now)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSpotlight}
          title="بحث ذكي (Ctrl+K)"
          className="hidden md:flex items-center gap-2 w-72 h-9 px-3 rounded-xl bg-bg-subtle border border-bg-subtle hover:border-brand-300 hover:bg-bg-card transition text-sm text-ink-muted whitespace-nowrap"
        >
          <Search size={16} className="shrink-0" />
          <span className="flex-1 text-right truncate">ابحث في كل شيء...</span>
          <kbd className="shrink-0 text-[10px] bg-bg-card text-ink-muted border border-bg-subtle rounded px-1.5 py-0.5 num font-bold">
            Ctrl+K
          </kbd>
        </button>
        <button
          onClick={onOpenSpotlight}
          title="بحث"
          className="md:hidden btn-secondary btn-sm"
        >
          <Search size={16} />
        </button>
        <button className="btn-primary btn-sm" onClick={() => nav('/transactions/new')}>
          <PlusCircle size={18} />
          معاملة جديدة
        </button>
        <button className="btn-secondary btn-sm" onClick={onBackup} title="حفظ نسخة احتياطية">
          <Download size={18} />
          نسخ احتياطي
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setAskRestore(true)} title="استعادة من نسخة">
          <Upload size={18} />
          استعادة
        </button>
        <button
          className="btn-secondary btn-sm"
          onClick={onTogglePrivacy}
          title={privacyMode ? 'إظهار الأرقام' : 'إخفاء الأرقام (Ctrl+H)'}
        >
          {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button
          className="btn-secondary btn-sm"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="hidden lg:flex items-center gap-1 text-xs text-ink-soft px-2">
          <Database size={14} />
          <span>محلي</span>
        </div>
      </div>
      <ConfirmDialog
        open={askRestore}
        onClose={() => setAskRestore(false)}
        onConfirm={onRestore}
        title="استعادة من نسخة احتياطية"
        message="هل أنت متأكد؟ سيتم استبدال البيانات الحالية بالكامل بعد اختيار الملف."
        confirmText="متابعة"
        destructive
      />
    </header>
  )
}
