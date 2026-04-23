import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Search, UserPlus, X } from 'lucide-react'
import type { Client, ClientWithStats } from '@shared/types'
import { Dialog } from './ui/Dialog'
import { toast } from '@/store/toast'

interface Props {
  value: Client | null
  onChange: (c: Client | null) => void
}

export function ClientPicker({ value, onChange }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const qc = useQueryClient()

  const { data: list = [] } = useQuery({
    queryKey: ['clients', q],
    queryFn: () => api.clientsList(q),
    enabled: open
  })

  const createMutation = useMutation({
    mutationFn: () => api.clientCreate({ name, phone: phone || null, address: address || null, notes: notes || null }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      onChange(c)
      setCreateOpen(false)
      setOpen(false)
      setName('')
      setPhone('')
      setAddress('')
      setNotes('')
      toast.success('تمت إضافة العميل')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  return (
    <>
      <div className="flex items-center gap-2">
        {value ? (
          <div className="flex-1 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-brand-50 border border-brand-100">
            <div>
              <div className="font-bold text-brand-800">{value.name}</div>
              {value.phone && <div className="text-xs text-brand-700/70 num">{value.phone}</div>}
            </div>
            <button className="btn-ghost btn-sm" onClick={() => onChange(null)} aria-label="إزالة">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button className="btn-secondary flex-1 justify-start" onClick={() => setOpen(true)}>
            <Search size={18} />
            <span className="text-ink-muted">اختر عميلاً</span>
          </button>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="اختيار عميل"
        size="md"
        footer={
          <>
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <UserPlus size={18} />
              عميل جديد
            </button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>إغلاق</button>
          </>
        }
      >
        <div className="relative mb-4">
          <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-ink-soft" size={18} />
          <input
            autoFocus
            className="input pr-10"
            placeholder="ابحث بالاسم أو رقم الهاتف"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto -mx-1">
          {list.length === 0 ? (
            <div className="text-center py-8 text-ink-muted">
              لا توجد نتائج. يمكنك إضافة عميل جديد.
            </div>
          ) : (
            list.map((c: ClientWithStats) => (
              <button
                key={c.id}
                className="w-full text-right p-3 rounded-xl hover:bg-bg-subtle flex items-center justify-between gap-2"
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
              >
                <div>
                  <div className="font-bold">{c.name}</div>
                  {c.phone && <div className="text-xs text-ink-muted num">{c.phone}</div>}
                </div>
                <div className="text-xs text-ink-muted">
                  {c.visit_count > 0 ? `${c.visit_count} زيارة` : 'عميل جديد'}
                </div>
              </button>
            ))
          )}
        </div>
      </Dialog>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إضافة عميل جديد"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              حفظ
            </button>
            <button className="btn-secondary" onClick={() => setCreateOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">الاسم *</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">رقم الهاتف</label>
            <input className="input num" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">العنوان</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </Dialog>
    </>
  )
}
