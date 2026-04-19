import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/PageHeader'
import { fmtMoney, fmtDateLong, fmtDateShort } from '@/lib/format'
import { ArrowRight, Pencil, Trash2, Phone, MapPin, FileText, Receipt, User } from 'lucide-react'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'

export function ClientProfile(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const qc = useQueryClient()
  const cid = Number(id)

  const [editOpen, setEditOpen] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const { data: client } = useQuery({ queryKey: ['client', cid], queryFn: () => api.clientGet(cid), enabled: !!cid })
  const { data: history = [] } = useQuery({
    queryKey: ['client-history', cid],
    queryFn: () => api.clientHistory(cid),
    enabled: !!cid
  })

  useEffect(() => {
    if (client) {
      setName(client.name)
      setPhone(client.phone || '')
      setAddress(client.address || '')
      setNotes(client.notes || '')
    }
  }, [client])

  const update = useMutation({
    mutationFn: () =>
      api.clientUpdate(cid, {
        name,
        phone: phone || null,
        address: address || null,
        notes: notes || null
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', cid] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('تم حفظ التعديلات')
      setEditOpen(false)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const del = useMutation({
    mutationFn: () => api.clientDelete(cid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('تم حذف العميل')
      nav('/clients')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحذف')
  })

  if (!client) return <div className="p-6 text-ink-muted">جارِ التحميل...</div>

  const totalSpent = history.reduce((s, t) => s + t.total, 0)
  const lastVisit = history.length ? history[0].date : null

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle="ملف العميل وتاريخ المعاملات"
        actions={
          <>
            <button className="btn-secondary" onClick={() => nav(-1)}>
              <ArrowRight size={18} />
              رجوع
            </button>
            <button className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={18} />
              تعديل
            </button>
            <button className="btn-danger" onClick={() => setAskDelete(true)}>
              <Trash2 size={18} />
              حذف
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <aside className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center">
                <User size={26} />
              </div>
              <div>
                <div className="text-xl font-extrabold">{client.name}</div>
                <div className="text-xs text-ink-muted">منذ {fmtDateShort(client.created_at)}</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {client.phone && (
                <div className="flex items-center gap-2 text-ink">
                  <Phone size={16} className="text-ink-muted" />
                  <span dir="ltr" className="num">{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-2 text-ink">
                  <MapPin size={16} className="text-ink-muted mt-0.5" />
                  <span>{client.address}</span>
                </div>
              )}
              {client.notes && (
                <div className="flex items-start gap-2 text-ink">
                  <FileText size={16} className="text-ink-muted mt-0.5" />
                  <span>{client.notes}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted text-sm">إجمالي المشتريات</span>
              <span className="font-extrabold num text-brand-700">{fmtMoney(totalSpent)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted text-sm">عدد الزيارات</span>
              <span className="font-bold num">{history.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted text-sm">آخر زيارة</span>
              <span className="font-bold num">{lastVisit ? fmtDateShort(lastVisit) : '—'}</span>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-bg-subtle flex items-center gap-2">
              <Receipt size={18} className="text-brand-600" />
              <h3 className="font-bold">سجل المعاملات ({history.length})</h3>
            </div>
            {history.length === 0 ? (
              <EmptyState title="لا يوجد معاملات لهذا العميل بعد" />
            ) : (
              <div className="divide-y divide-bg-subtle">
                {history.map((t) => (
                  <Link
                    key={t.id}
                    to={`/transactions/${t.id}`}
                    className="block p-4 hover:bg-bg-subtle/40 transition"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="font-bold num">{t.transaction_no}</div>
                      <div className="font-extrabold num text-brand-700">{fmtMoney(t.total)}</div>
                    </div>
                    <div className="text-sm text-ink-muted mb-2">{fmtDateLong(t.date)}</div>
                    <div className="flex flex-wrap gap-1">
                      {t.lines.slice(0, 5).map((l) => (
                        <span key={l.id} className="chip">
                          {l.item_name || l.custom_name} × {l.quantity}
                        </span>
                      ))}
                      {t.lines.length > 5 && (
                        <span className="chip bg-bg-subtle text-ink-muted">+{t.lines.length - 5}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="تعديل بيانات العميل"
        size="sm"
        footer={
          <>
            <button
              className="btn-primary"
              disabled={!name.trim() || update.isPending}
              onClick={() => update.mutate()}
            >
              حفظ
            </button>
            <button className="btn-secondary" onClick={() => setEditOpen(false)}>إلغاء</button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">الاسم *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
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
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={askDelete}
        onClose={() => setAskDelete(false)}
        onConfirm={() => del.mutate()}
        title="حذف العميل"
        message="هل أنت متأكد من حذف هذا العميل؟ المعاملات المرتبطة ستبقى محفوظة لكن بدون عميل."
        confirmText="حذف"
        destructive
      />
    </>
  )
}
