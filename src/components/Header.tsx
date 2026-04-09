import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

export function Header() {
  const statusText = useAppStore((s) => s.statusText)
  const setHelpOpen = useAppStore((s) => s.setHelpOpen)
  const helpOpen = useAppStore((s) => s.helpOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  return (
    <header className="col-span-full bg-panel border-b border-border flex items-center gap-4 px-5 h-[52px]">
      <button
        onClick={toggleSidebar}
        className={`font-mono text-[13px] border w-7 h-7 flex items-center justify-center cursor-pointer transition-all
          ${sidebarOpen ? 'border-olive-lit text-olive-lit bg-olive/10' : 'border-border text-muted hover:border-olive-lit hover:text-olive-lit'}`}
        title={sidebarOpen ? 'Masquer les outils' : 'Afficher les outils'}
      >
        ☰
      </button>
      <div className="font-mono text-[11px] text-olive-lit tracking-[2px] border border-olive px-2 py-0.5">
        ANRAC
      </div>
      <h1 className="text-[15px] font-semibold tracking-[3px] uppercase text-text">
        Gestion Exploitation & Prélèvements
      </h1>
      <div className="ml-auto font-mono text-[11px] flex items-center gap-3">
        {/* Online/offline indicator */}
        <div className={`flex items-center gap-1.5 px-2 py-0.5 border ${online ? 'border-olive text-olive-lit' : 'border-amber text-amber'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-olive-lit animate-[pulse_2s_infinite]' : 'bg-amber'}`} />
          {online ? 'EN LIGNE' : 'HORS LIGNE'}
        </div>
        <span className="text-muted">{statusText}</span>
      </div>
      <button
        onClick={() => setHelpOpen(!helpOpen)}
        className="font-mono text-[13px] text-muted border border-border w-7 h-7 flex items-center justify-center cursor-pointer hover:border-olive-lit hover:text-olive-lit transition-all"
      >
        ?
      </button>
    </header>
  )
}
