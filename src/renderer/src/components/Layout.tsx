import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Toaster } from './ui/Toaster'
import { Spotlight } from './Spotlight'
import { PinLock } from './PinLock'
import { Onboarding } from './Onboarding'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useEffect, useState, useCallback } from 'react'
import { setFormatPrefs } from '@/lib/format'

export function Layout(): JSX.Element {
  const qc = useQueryClient()
  const [spotOpen, setSpotOpen] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.settingsAll() })

  const pinEnabled = settings?.pin_enabled === 'true'
  const onboardingDone = settings?.onboarding_done !== 'false'
  const privacyMode = settings?.privacy_mode === 'true'

  useEffect(() => {
    if (settings) {
      setFormatPrefs({
        currency: settings.currency_symbol || 'ج.م',
        numerals: (settings.numerals_style as 'western' | 'arabic-indic') || 'western'
      })
      const root = document.documentElement
      if (settings.theme === 'dark') root.classList.add('dark')
      else root.classList.remove('dark')
      if (privacyMode) root.classList.add('privacy')
      else root.classList.remove('privacy')
    }
  }, [settings, privacyMode])

  // Keyboard shortcuts (Ctrl+K, Ctrl+H privacy, N new)
  useEffect(() => {
    if (!unlocked && pinEnabled) return
    const onKey = (e: KeyboardEvent): void => {
      const cmd = e.ctrlKey || e.metaKey
      if (cmd && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSpotOpen((o) => !o)
      } else if (cmd && e.key.toLowerCase() === 'h') {
        e.preventDefault()
        togglePrivacy()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, pinEnabled, settings])

  const toggleTheme = useCallback(async (): Promise<void> => {
    const next = settings?.theme === 'dark' ? 'light' : 'dark'
    await api.settingSet('theme', next)
    qc.invalidateQueries({ queryKey: ['settings'] })
  }, [settings, qc])

  const togglePrivacy = useCallback(async (): Promise<void> => {
    const next = privacyMode ? 'false' : 'true'
    await api.settingSet('privacy_mode', next)
    qc.invalidateQueries({ queryKey: ['settings'] })
  }, [privacyMode, qc])

  if (!settings) {
    return <div className="h-screen flex items-center justify-center text-ink-muted">جارِ التحميل...</div>
  }

  if (!onboardingDone) {
    return <Onboarding onDone={() => qc.invalidateQueries({ queryKey: ['settings'] })} />
  }

  if (pinEnabled && !unlocked) {
    return <PinLock onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="h-screen flex overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          businessName={settings?.business_name || 'نظام إدارة الاستوديو'}
          theme={(settings?.theme as 'light' | 'dark') || 'light'}
          privacyMode={privacyMode}
          onToggleTheme={toggleTheme}
          onTogglePrivacy={togglePrivacy}
          onOpenSpotlight={() => setSpotOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1500px] mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
      <Spotlight open={spotOpen} onClose={() => setSpotOpen(false)} />
    </div>
  )
}
