import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateShort } from '@/lib/format'
import { Search, Plus, User, AlertCircle } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'
import { cn } from '@/lib/cn'

export function ClientsList(): JSX.Element {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const { data: list = [] } = useQuery({
    queryKey: ['clients', q],
    queryFn: () => api.clientsList(q)
  })

  const create = useMutation({
    mutationFn: () =>
      api.clientCreate({
        name,
        phone: phone || null,
        address: address || null,
        notes: notes || null
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('تمت إضافة العميل')
      setOpen(false)
      setName('')
      setPhone('')
      setAddress('')
      setNotes('')
      nav(`/clients/${c.id}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  return (
    <>
      <PageHeader
        title="العملاء"
        subtitle="قائمة بجميع العملاء وسجلاتهم"
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={18} />
            عميل جديد
          </button>
        }
      />

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search className="absolute top-1/2 -translate-y-1/2 right-3 text-ink-soft" size={18} />
          <input
            className="input pr-10"
            placeholder="ابحث بالاسم أو رقم الهاتف"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            title="لا يوجد عملاء بعد"
            hint="ابدأ بإضافة أول عميل لك."
            action={
              <button className="btn-primary" onClick={() => setOpen(true)}>
                <Plus size={16} />
                إضافة عميل
              </button>
            }
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>رقم الهاتف</th>
                <th className="text-center">عدد الزيارات</th>
                <th className="text-center">آخر زيارة</th>
                <th className="text-center">المتبقّي عليه</th>
                <th className="text-left">إجمالي المشتريات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const owes = (c.outstanding ?? 0) > 0.0001
                return (
                <tr
                  key={c.id}
                  className={cn(
                    'cursor-pointer',
                    owes && 'bg-amber-50/40 hover:bg-amber-50'
                  )}
                  onClick={() => nav(`/clients/${c.id}`)}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center',
                          owes ? 'bg-amber-100 text-amber-700' : 'bg-brand-100 text-brand-700'
                        )}
                      >
                        <User size={16} />
                      </div>
                      <span className="font-bold">{c.name}</span>
                    </div>
                  </td>
                  <td className="num" dir="ltr">{c.phone || '—'}</td>
                  <td className="text-center num">{c.visit_count}</td>
                  <td className="text-center num">{c.last_visit ? fmtDateShort(c.last_visit) : '—'}</td>
                  <td className="text-center">
                    {owes ? (
                      <span className="chip text-xs bg-amber-50 text-amber-700 num">
                        <AlertCircle size={12} />
                        {fmtMoney(c.outstanding ?? 0)}
                      </span>
                    ) : (
                      <span className="text-ink-soft text-xs">—</span>
                    )}
                  </td>
                  <td className="text-left font-bold num">{fmtMoney(c.total_spent)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="إضافة عميل جديد"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!name.trim() || create.isPending}
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
