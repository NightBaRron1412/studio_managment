import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtDateShort, todayISO } from '@/lib/format'
import { Plus, Trash2, Bell, Calendar, CheckCircle2 } from 'lucide-react'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'
import { cn } from '@/lib/cn'

export function Reminders(): JSX.Element {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [delId, setDelId] = useState<number | null>(null)

  const { data: list = [] } = useQuery({
    queryKey: ['reminders', showDone],
    queryFn: () => api.remindersList(!showDone)
  })

  const today = todayISO()

  const create = useMutation({
    mutationFn: () => api.reminderCreate({ text, due_date: due || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تمت الإضافة')
      setOpen(false)
      setText('')
      setDue('')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل')
  })

  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => api.reminderToggle(id, done),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })

  const del = useMutation({
    mutationFn: (id: number) => api.reminderDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم الحذف')
    }
  })

  return (
    <>
      <PageHeader
        title="التذكيرات"
        subtitle="مهام وملاحظات لا تنسى"
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => setShowDone(!showDone)}
            >
              {showDone ? 'إخفاء المُنجزة' : 'عرض الكل'}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setText('')
                setDue('')
                setOpen(true)
              }}
            >
              <Plus size={18} />
              تذكير جديد
            </button>
          </>
        }
      />

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="لا توجد تذكيرات"
            hint="أضف أي مهمة لا تريد نسيانها."
            icon={<Bell size={28} />}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-bg-subtle">
            {list.map((r) => {
              const overdue = r.due_date && r.due_date < today && !r.is_done
              return (
                <div key={r.id} className="p-4 flex items-center gap-3">
                  <button
                    className={cn(
                      'w-6 h-6 rounded-md border-2 flex items-center justify-center transition shrink-0',
                      r.is_done
                        ? 'bg-good border-good text-white'
                        : 'border-bg-subtle hover:border-brand-500'
                    )}
                    onClick={() => toggle.mutate({ id: r.id, done: !r.is_done })}
                  >
                    {!!r.is_done && <CheckCircle2 size={14} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={cn('font-semibold', r.is_done && 'line-through text-ink-soft')}>
                      {r.text}
                    </div>
                    {r.due_date && (
                      <div
                        className={cn(
                          'text-xs flex items-center gap-1 mt-1',
                          overdue ? 'text-bad font-bold' : 'text-ink-muted'
                        )}
                      >
                        <Calendar size={12} />
                        {fmtDateShort(r.due_date)}
                        {overdue && ' (متأخّر)'}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-ghost btn-sm text-bad hover:bg-red-50"
                    onClick={() => setDelId(r.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="تذكير جديد"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!text.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              حفظ
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">المهمة *</label>
            <textarea
              className="input"
              rows={3}
              autoFocus
              placeholder="مثال: اتصل بأحمد بخصوص الألبوم"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div>
            <label className="label">تاريخ الاستحقاق (اختياري)</label>
            <input
              type="date"
              className="input num"
              dir="ltr"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && del.mutate(delId)}
        title="حذف التذكير"
        message="هل تريد حذف هذا التذكير؟"
        confirmText="حذف"
        destructive
      />
    </>
  )
}
