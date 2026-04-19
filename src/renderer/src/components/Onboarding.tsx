import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Camera, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from '@/store/toast'

export function Onboarding({ onDone }: { onDone: () => void }): JSX.Element {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [defaultRent, setDefaultRent] = useState('2500')
  const [currency, setCurrency] = useState('ج.م')

  const finish = useMutation({
    mutationFn: async () => {
      await api.settingSet('business_name', businessName.trim() || 'استوديو')
      await api.settingSet('owner_name', ownerName.trim())
      await api.settingSet('phone', phone.trim())
      await api.settingSet('address', address.trim())
      await api.settingSet('default_rent', String(Number(defaultRent) || 0))
      await api.settingSet('currency_symbol', currency.trim() || 'ج.م')
      await api.settingSet('onboarding_done', 'true')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('تم الإعداد بنجاح! أهلاً بك 👋')
      onDone()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
  })

  const steps = [
    {
      title: 'أهلاً بك',
      content: (
        <div className="text-center py-6">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-brand-600 text-white flex items-center justify-center mb-5 shadow-soft">
            <Camera size={48} />
          </div>
          <h2 className="text-2xl font-extrabold mb-2">مرحباً بك في برنامج إدارة الاستوديو</h2>
          <p className="text-ink-muted leading-relaxed">
            خطوات بسيطة لإعداد البرنامج، ثم تكون جاهزاً لتسجيل أول معاملة.
            <br />
            كل بياناتك محفوظة محلياً على جهازك فقط.
          </p>
        </div>
      ),
      canNext: true
    },
    {
      title: 'بيانات المحل',
      content: (
        <div className="space-y-3">
          <div>
            <label className="label">اسم المحل *</label>
            <input
              className="input"
              autoFocus
              placeholder="مثال: استوديو الإبداع"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">اسم المالك</label>
            <input className="input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">رقم الهاتف</label>
              <input className="input num" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">رمز العملة</label>
              <input className="input text-center" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">العنوان</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
      ),
      canNext: !!businessName.trim()
    },
    {
      title: 'الإيجار الشهري',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted leading-relaxed mb-2">
            ما هو مبلغ الإيجار الشهري الافتراضي للمحل؟ يمكن تعديله لاحقاً من الإعدادات.
          </p>
          <div>
            <label className="label">الإيجار الشهري</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input num text-center text-2xl py-4"
              value={defaultRent}
              onChange={(e) => setDefaultRent(e.target.value)}
            />
          </div>
        </div>
      ),
      canNext: true
    },
    {
      title: 'جاهز!',
      content: (
        <div className="text-center py-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-good text-white flex items-center justify-center mb-5">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-extrabold mb-2">كل شيء جاهز!</h2>
          <p className="text-ink-muted leading-relaxed">
            البرنامج الآن مُعد ومستعد للاستخدام.
            <br />
            تم إنشاء أصناف افتراضية يمكنك تعديلها من الإعدادات.
          </p>
          <p className="text-xs text-ink-soft mt-4">
            نصيحة: فعِّل النسخ الاحتياطي التلقائي من الإعدادات لحماية بياناتك.
          </p>
        </div>
      ),
      canNext: true
    }
  ]

  const cur = steps[step]

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center p-6 z-50">
      <div className="card p-8 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs text-ink-muted">
            خطوة {step + 1} من {steps.length}
          </div>
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-8 h-1.5 rounded-full transition ${
                  i <= step ? 'bg-brand-600' : 'bg-bg-subtle'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[280px]">{cur.content}</div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-bg-subtle">
          {step > 0 ? (
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>
              <ArrowRight size={16} />
              السابق
            </button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 ? (
            <button
              className="btn-primary"
              disabled={!cur.canNext}
              onClick={() => setStep(step + 1)}
            >
              التالي
              <ArrowLeft size={16} />
            </button>
          ) : (
            <button
              className="btn-primary btn-lg"
              disabled={finish.isPending}
              onClick={() => finish.mutate()}
            >
              {finish.isPending ? 'جارِ الحفظ...' : 'ابدأ الاستخدام'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
