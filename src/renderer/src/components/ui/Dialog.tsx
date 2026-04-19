import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl'
}

export function Dialog({ open, onClose, title, children, size = 'md', footer }: DialogProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative card w-full', sizes[size], 'flex flex-col max-h-[90vh]')}>
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-bg-subtle">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-bg-subtle bg-bg-subtle/30 rounded-b-2xl flex items-center gap-2 justify-start">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'تأكيد العملية',
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  destructive = false
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}): JSX.Element | null {
  if (!open) return null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            className={destructive ? 'btn-danger' : 'btn-primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmText}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {cancelText}
          </button>
        </>
      }
    >
      <p className="text-ink leading-relaxed">{message}</p>
    </Dialog>
  )
}
