import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { MapView } from './components/MapView'
import { RightPanel } from './components/RightPanel'
import { Toast } from './components/Toast'
import { HelpModal } from './components/HelpModal'
import { Dashboard } from './components/Dashboard'
import { FieldDetailPanel } from './components/FieldDetailPanel'
import { CalendarPanel } from './components/CalendarPanel'
import { ActivityForm } from './components/ActivityForm'
import { AuthPage } from './components/AuthPage'
import { useAuth } from './contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)

  if (loading) {
    return (
      <div className="h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="text-[var(--color-olive-lit)] font-[var(--font-mono)] text-sm tracking-widest uppercase animate-pulse">
          {t('app.loading')}
        </div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  // Layout:
  //   ┌───────────────────────────────────────────────┐
  //   │                  Header (col-span-full)        │
  //   ├──────────────────────────────────┬────────────┤
  //   │                                  │            │
  //   │          MapView (1fr)           │ RightPanel │
  //   │                                  │  (280px)   │
  //   └──────────────────────────────────┴────────────┘
  //
  // The left Sidebar is NOT in the grid — it's rendered as a fixed overlay
  // that slides in over the map. Both the backdrop and the panel stay
  // mounted at all times and use CSS transitions on transform + opacity.
  // This gives a symmetric open/close animation (slide in from left, slide
  // out to the left) without juggling local exit state.

  return (
    <div className="h-screen grid grid-rows-[48px_1fr] grid-cols-1 md:grid-rows-[52px_1fr] md:grid-cols-[1fr_280px] overflow-hidden">
      <Header />
      <MapView />
      <RightPanel />
      <Toast />
      <HelpModal />
      <Dashboard />
      <FieldDetailPanel />
      <CalendarPanel />
      <ActivityForm />

      {/* Backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 top-[48px] md:top-[52px] bg-black/40 z-[900] transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Sidebar panel */}
      <div
        className={`fixed top-[48px] md:top-[52px] bottom-0 left-0 w-[85vw] max-w-[320px] z-[901] shadow-2xl transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!sidebarOpen}
      >
        <Sidebar />
      </div>
    </div>
  )
}
