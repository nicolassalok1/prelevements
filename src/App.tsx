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
import { useAppStore } from './store/useAppStore'

export default function App() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)

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
  // that slides in over the map when the user clicks the ☰ toggle in the
  // header. This keeps the map stable at full width regardless of sidebar
  // state, and avoids the grid-reflow bug where removing a conditional
  // grid child shifted the other columns.

  return (
    <div className="h-screen grid grid-rows-[52px_1fr] grid-cols-[1fr_280px] overflow-hidden">
      <Header />
      <MapView />
      <RightPanel />
      <Toast />
      <HelpModal />
      <Dashboard />
      <FieldDetailPanel />
      <CalendarPanel />
      <ActivityForm />

      {/* Left-sidebar overlay — sits on top of the map when open */}
      {sidebarOpen && (
        <>
          {/* Semi-transparent backdrop to let the user dismiss by clicking outside */}
          <div
            className="fixed inset-0 top-[52px] bg-black/40 z-[900]"
            onClick={() => setSidebarOpen(false)}
          />
          {/* The actual Sidebar panel, anchored to the left under the header */}
          <div className="fixed top-[52px] bottom-0 left-0 w-[320px] z-[901] shadow-2xl animate-[slideInLeft_0.2s_ease-out]">
            <Sidebar />
          </div>
        </>
      )}
    </div>
  )
}
