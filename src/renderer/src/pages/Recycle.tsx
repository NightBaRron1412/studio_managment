import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DeletedItem } from '@shared/types'
import { PageHeader } from '@/components/PageHeader'
import { fmtDateShort } from '@/lib/format'
import { RotateCcw, Trash2, Receipt, User, Wallet, Building2, Package } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/store/toast'

const labels: Record<DeletedItem['kind'], { ar: string; icon: typeof Receipt }> = {
  transaction: { ar: 'معاملة', icon: Receipt },
  client: { ar: 'عميل', icon: User },
  withdrawal: { ar: 'سحب نقدي', icon: Wallet },
  rent: { ar: 'دفعة إيجار', icon: Building2 },
  inventory: { ar: 'مشتريات', icon: Package }
}

export function Recycle(): JSX.Element {
  const qc = useQueryClient()
  const [askEmpty, setAskEmpty] = useState(false)
  const [askPurge, setAskPurge] = useState<DeletedItem | null>(null)

  const { data: list = [] } = useQuery({ queryKey: ['recycle'], queryFn: () => api.recycleList() })

  const restore = useMutation({
    mutationFn: ({ kind, id }: { kind: DeletedItem['kind']; id: number }) => api.recycleRestore(kind, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recycle'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['withdrawals'] })
      qc.invalidateQueries({ queryKey: ['rent'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('تمت الاستعادة')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل')
  })
  const purge = useMutation({
    mutationFn: ({ kind, id }: { kind: DeletedItem['kind']; id: number }) => api.recyclePurge(kind, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recycle'] })
      toast.success('تم الحذف نهائياً')
    }
  })
  const empty = useMutation({
    mutationFn: () => api.recycleEmpty(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recycle'] })
      toast.success('تم تفريغ السلة')
    }
  })

  return (
    <>
      <PageHeader
        title="سلة المحذوفات"
        subtitle="السجلات المحذوفة — يمكن استعادتها أو حذفها نهائياً"
        actions={
          list.length > 0 ? (
            <button className="btn-danger btn-sm" onClick={() => setAskEmpty(true)}>
              <Trash2 size={16} />
              تفريغ السلة
            </button>
          ) : null
        }
      />

      {list.length === 0 ? (
        <div className="card">
          <EmptyState title="السلة فارغة" hint="السجلات التي تحذفها ستظهر هنا قبل الحذف النهائي." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>التفاصيل</th>
                <th>تاريخ الحذف</th>
                <th className="w-48"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((it) => {
                const meta = labels[it.kind]
                const Icon = meta.icon
                return (
                  <tr key={`${it.kind}-${it.id}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-bg-subtle flex items-center justify-center text-ink-muted">
                          <Icon size={16} />
                        </div>
                        <span className="font-semibold">{meta.ar}</span>
                      </div>
                    </td>
                    <td>
                      <div className="font-bold">{it.label}</div>
                      {it.sub && <div className="text-xs text-ink-muted">{it.sub}</div>}
                    </td>
                    <td className="num text-sm">{fmtDateShort(it.deleted_at)}</td>
                    <td className="text-end">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => restore.mutate({ kind: it.kind, id: it.id })}
                      >
                        <RotateCcw size={14} />
                        استعادة
                      </button>
                      <button
                        className="btn-ghost btn-sm text-bad hover:bg-red-50"
                        onClick={() => setAskPurge(it)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={askEmpty}
        onClose={() => setAskEmpty(false)}
        onConfirm={() => empty.mutate()}
        title="تفريغ سلة المحذوفات"
        message="سيتم حذف جميع السجلات الموجودة في السلة نهائياً ولا يمكن استعادتها. هل أنت متأكد؟"
        confirmText="تفريغ نهائي"
        destructive
      />
      <ConfirmDialog
        open={askPurge !== null}
        onClose={() => setAskPurge(null)}
        onConfirm={() => askPurge && purge.mutate({ kind: askPurge.kind, id: askPurge.id })}
        title="حذف نهائي"
        message="سيتم حذف هذا السجل نهائياً ولا يمكن استعادته. هل أنت متأكد؟"
        confirmText="حذف نهائي"
        destructive
      />
    </>
  )
}
