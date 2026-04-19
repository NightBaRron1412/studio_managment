import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Booking, BookingStatus, Client } from '@shared/types'
import { PageHeader } from '@/components/PageHeader'
import { fmtDateLong, fmtDateShort, fmtMoney, todayISO } from '@/lib/format'
import { Plus, Pencil, Trash2, Calendar, Clock, User, Phone, CheckCircle2, XCircle, MessageCircle } from 'lucide-react'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ClientPicker } from '@/components/ClientPicker'
import { toast } from '@/store/toast'
import { cn } from '@/lib/cn'

const SESSION_TYPES = [
  'جلسة خطوبة',
  'جلسة زفاف',
  'جلسة عائلية',
  'جلسة أطفال',
  'جلسة بورتريه',
  'جلسة منتجات',
  'تصوير حدث',
  'تصوير جامعي / كروت',
  'أخرى'
]

const STATUS_LABEL: Record<BookingStatus, { ar: string; cls: string }> = {
  scheduled: { ar: 'محجوز', cls: 'bg-brand-50 text-brand-700' },
  completed: { ar: 'مُنجز', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { ar: 'ملغي', cls: 'bg-red-50 text-red-700' }
}

export function Bookings(): JSX.Element {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'upcoming' | 'today' | 'past' | 'all'>('upcoming')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Booking | null>(null)
  const [delId, setDelId] = useState<number | null>(null)

  const { data: list = [] } = useQuery({
    queryKey: ['bookings', filter],
    queryFn: () => {
      const today = todayISO()
      if (filter === 'today') return api.bookingsList({ date_from: today, date_to: today })
      if (filter === 'upcoming') return api.bookingsList({ date_from: today })
      if (filter === 'past') return api.bookingsList({ date_to: today })
      return api.bookingsList()
    }
  })

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: BookingStatus }) =>
      api.bookingUpdate(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم تحديث الحالة')
    }
  })
  const del = useMutation({
    mutationFn: (id: number) => api.bookingDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تم نقل الحجز إلى السلة')
    }
  })

  const groups = useMemo(() => {
    const m = new Map<string, Booking[]>()
    for (const b of list) {
      const arr = m.get(b.date) ?? []
      arr.push(b)
      m.set(b.date, arr)
    }
    return Array.from(m.entries()).sort((a, b) => (filter === 'past' ? (a[0] < b[0] ? 1 : -1) : a[0] < b[0] ? -1 : 1))
  }, [list, filter])

  const wa = (phone: string | null, name: string | null, date: string, time: string | null): void => {
    if (!phone) {
      toast.info('لا يوجد رقم هاتف لهذا العميل')
      return
    }
    const norm = phone.replace(/[^0-9]/g, '').replace(/^0(\d{10})$/, '20$1')
    const text = encodeURIComponent(
      `مرحباً ${name || ''}،\nنذكِّرك بموعد جلسة التصوير${time ? ` الساعة ${time}` : ''} يوم ${date}.\nفي انتظارك.`
    )
    window.open(`https://wa.me/${norm}?text=${text}`, '_blank')
  }

  return (
    <>
      <PageHeader
        title="حجوزات الجلسات"
        subtitle="مواعيد جلسات التصوير القادمة"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus size={18} />
            حجز جديد
          </button>
        }
      />

      <div className="card p-3 mb-4 flex flex-wrap gap-2">
        {(['today', 'upcoming', 'past', 'all'] as const).map((f) => (
          <button
            key={f}
            className={cn('chip', filter === f && 'bg-brand-600 text-white')}
            onClick={() => setFilter(f)}
          >
            {f === 'today' && 'اليوم'}
            {f === 'upcoming' && 'القادمة'}
            {f === 'past' && 'السابقة'}
            {f === 'all' && 'الكل'}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            title="لا توجد حجوزات"
            hint="ابدأ بإضافة موعد جلسة تصوير قادم."
            icon={<Calendar size={28} />}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, items]) => (
            <div key={date} className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-bg-subtle bg-bg-subtle/40 flex items-center gap-2">
                <Calendar size={16} className="text-brand-600" />
                <span className="font-bold">{fmtDateLong(date)}</span>
                <span className="text-xs text-ink-muted">({items.length} حجز)</span>
              </div>
              <div className="divide-y divide-bg-subtle">
                {items.map((b) => (
                  <div key={b.id} className="p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 min-w-[110px]">
                      <Clock size={16} className="text-ink-muted" />
                      <span className="num font-bold">{b.time || '—'}</span>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-bold">{b.session_type}</div>
                      <div className="text-sm text-ink-muted flex items-center gap-2 flex-wrap mt-1">
                        {b.client_name && (
                          <span className="flex items-center gap-1">
                            <User size={14} />
                            {b.client_name}
                          </span>
                        )}
                        {b.client_phone && (
                          <span className="flex items-center gap-1 num" dir="ltr">
                            <Phone size={14} />
                            {b.client_phone}
                          </span>
                        )}
                      </div>
                      {b.note && <div className="text-xs text-ink-muted mt-1 italic">"{b.note}"</div>}
                    </div>
                    <div className="text-end">
                      {b.deposit > 0 && (
                        <div className="text-xs text-ink-muted">
                          عربون: <span className="num font-bold">{fmtMoney(b.deposit)}</span>
                        </div>
                      )}
                      <span className={cn('chip', STATUS_LABEL[b.status].cls)}>
                        {STATUS_LABEL[b.status].ar}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {b.status === 'scheduled' && (
                        <>
                          {b.client_phone && (
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => wa(b.client_phone, b.client_name, b.date, b.time)}
                            >
                              <MessageCircle size={14} />
                            </button>
                          )}
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => setStatus.mutate({ id: b.id, status: 'completed' })}
                            title="مُنجز"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                          <button
                            className="btn-secondary btn-sm"
                            onClick={() => setStatus.mutate({ id: b.id, status: 'cancelled' })}
                            title="إلغاء"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setEditing(b)
                          setOpen(true)
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn-ghost btn-sm text-bad hover:bg-red-50"
                        onClick={() => setDelId(b.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <BookingDialog
        open={open}
        onClose={() => setOpen(false)}
        editing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['bookings'] })
          qc.invalidateQueries({ queryKey: ['dashboard'] })
        }}
      />

      <ConfirmDialog
        open={delId !== null}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && del.mutate(delId)}
        title="حذف الحجز"
        message="سيتم نقل الحجز إلى سلة المحذوفات."
        confirmText="حذف"
        destructive
      />
    </>
  )
}

function BookingDialog({
  open,
  onClose,
  editing,
  onSaved
}: {
  open: boolean
  onClose: () => void
  editing: Booking | null
  onSaved: () => void
}): JSX.Element {
  const [date, setDate] = useState(todayISO())
  const [time, setTime] = useState('')
  const [client, setClient] = useState<Client | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [type, setType] = useState(SESSION_TYPES[0])
  const [deposit, setDeposit] = useState('0')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      if (editing) {
        setDate(editing.date)
        setTime(editing.time || '')
        setManualName(editing.client_id ? '' : editing.client_name || '')
        setManualPhone(editing.client_id ? '' : editing.client_phone || '')
        setType(editing.session_type)
        setDeposit(String(editing.deposit || 0))
        setNote(editing.note || '')
        if (editing.client_id) {
          api.clientGet(editing.client_id).then(setClient)
        } else {
          setClient(null)
        }
      } else {
        setDate(todayISO())
        setTime('')
        setClient(null)
        setManualName('')
        setManualPhone('')
        setType(SESSION_TYPES[0])
        setDeposit('0')
        setNote('')
      }
    }
  }, [open, editing])

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        date,
        time: time || null,
        client_id: client?.id ?? null,
        client_name: client ? client.name : manualName.trim() || null,
        client_phone: client ? client.phone : manualPhone.trim() || null,
        session_type: type,
        deposit: Number(deposit) || 0,
        status: (editing?.status ?? 'scheduled') as BookingStatus,
        note: note.trim() || null
      }
      return editing ? api.bookingUpdate(editing.id, payload) : api.bookingCreate(payload)
    },
    onSuccess: () => {
      onSaved()
      toast.success(editing ? 'تم حفظ التعديل' : 'تم حفظ الحجز')
      onClose()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'تعديل حجز' : 'حجز جديد'}
      size="md"
      footer={
        <>
          <button
            className="btn-primary"
            disabled={save.isPending || !type.trim()}
            onClick={() => save.mutate()}
          >
            حفظ
          </button>
          <button className="btn-secondary" onClick={onClose}>إلغاء</button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">التاريخ</label>
            <input type="date" className="input num" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">الوقت (اختياري)</label>
            <input type="time" className="input num" dir="ltr" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">نوع الجلسة</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {SESSION_TYPES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">العميل</label>
          <ClientPicker value={client} onChange={setClient} />
        </div>
        {!client && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">أو اكتب اسم العميل</label>
              <input
                className="input"
                placeholder="اسم العميل"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">رقم الهاتف</label>
              <input
                className="input num"
                dir="ltr"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
              />
            </div>
          </div>
        )}
        <div>
          <label className="label">العربون / المقدم</label>
          <input
            type="number"
            min="0"
            step="0.5"
            className="input num text-center"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
          />
        </div>
        <div>
          <label className="label">ملاحظات</label>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {editing && (
          <div className="text-xs text-ink-muted">
            آخر تعديل: {fmtDateShort(editing.updated_at)}
          </div>
        )}
      </div>
    </Dialog>
  )
}
