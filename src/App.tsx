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
  // Layout: left sidebar is hidden by default. The user reopens it from the
  // toggle in the header; the grid collapses the left column to 0 when closed
  // so the map expands to take the full width.
  const cols = sidebarOpen ? 'grid-cols-[320px_1fr_280px]' : 'grid-cols-[0px_1fr_280px]'
  return (
    <div className={`h-screen grid grid-rows-[52px_1fr] ${cols} overflow-hidden`}>
      <Header />
      {sidebarOpen && <Sidebar />}
      <MapView />
      <RightPanel />
      <Toast />
      <HelpModal />
      <Dashboard />
      <FieldDetailPanel />
      <CalendarPanel />
      <ActivityForm />
    </div>
  )
}
