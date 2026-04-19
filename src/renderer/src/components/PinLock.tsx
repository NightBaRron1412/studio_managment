import { useEffect, useState } from 'react'
import { Camera, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

const MIN_DOTS = 4
const MAX_DOTS = 8

export function PinLock({ onUnlock }: { onUnlock: () => void }): JSX.Element {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const verify = async (value: string): Promise<void> => {
    setBusy(true)
    setError(false)
    try {
      const ok = await api.pinVerify(value)
      if (ok) {
        onUnlock()
      } else {
        setError(true)
        setPin('')
        setTimeout(() => setError(false), 600)
      }
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (pin.length >= MIN_DOTS) {
      const t = setTimeout(() => verify(pin), 200)
      return () => clearTimeout(t)
    }
    return
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  // Keyboard support: digits 0-9 type into PIN, Backspace deletes, Enter submits, Escape clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (busy) return
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setPin((p) => (p.length < MAX_DOTS ? p + e.key : p))
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPin((p) => p.slice(0, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (pin.length >= MIN_DOTS) verify(pin)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setPin('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, pin])

  const press = (n: string): void => {
    if (pin.length < MAX_DOTS) setPin(pin + n)
  }
  const back = (): void => setPin(pin.slice(0, -1))
  const clear = (): void => setPin('')

  // Dots render: one filled dot per typed digit, plus N placeholder dots up to MIN_DOTS
  const placeholderDots = Math.max(0, MIN_DOTS - pin.length)

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center p-6 z-50">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-600 text-white flex items-center justify-center mb-3 shadow-soft">
            <Camera size={28} />
          </div>
          <h1 className="text-xl font-extrabold text-ink">نظام إدارة الاستوديو</h1>
          <p className="text-sm text-ink-muted mt-1 flex items-center gap-1">
            <Lock size={14} />
            أدخل الرقم السري للدخول
          </p>
        </div>

        <div
          className={cn(
            'flex justify-center gap-2 mb-6 transition min-h-[12px]',
            error && 'animate-shake'
          )}
        >
          {Array.from({ length: pin.length }).map((_, i) => (
            <div
              key={`f-${i}`}
              className={cn(
                'w-3 h-3 rounded-full transition',
                error ? 'bg-bad scale-125' : 'bg-brand-600 scale-110'
              )}
            />
          ))}
          {Array.from({ length: placeholderDots }).map((_, i) => (
            <div key={`e-${i}`} className="w-3 h-3 rounded-full bg-bg-subtle" />
          ))}
        </div>

        {/* dir="ltr" flips the keypad so 1 lands top-left like a normal phone */}
        <div className="grid grid-cols-3 gap-3" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button
              key={n}
              className="btn-secondary text-2xl py-4 num font-bold"
              disabled={busy}
              onClick={() => press(n)}
            >
              {n}
            </button>
          ))}
          <button className="btn-ghost text-sm" disabled={busy} onClick={clear}>
            مسح
          </button>
          <button
            className="btn-secondary text-2xl py-4 num font-bold"
            disabled={busy}
            onClick={() => press('0')}
          >
            0
          </button>
          <button className="btn-ghost text-sm" disabled={busy} onClick={back}>
            ⌫
          </button>
        </div>

        <div className="text-center text-xs text-ink-soft mt-4">
          يمكنك أيضاً الكتابة من لوحة المفاتيح
        </div>

        {error && (
          <div className="text-center text-bad text-sm mt-2 font-bold">رقم سري خاطئ</div>
        )}
      </div>
    </div>
  )
}
