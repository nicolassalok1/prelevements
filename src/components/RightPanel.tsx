import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { FieldList } from './FieldList'
import { getMap } from './MapView'
import type { Field } from '../types'

export function RightPanel() {
  const fields = useAppStore((s) => s.fields).filter((f) => !f.archived)
  const mobileOpen = useAppStore((s) => s.mobileRightOpen)
  const setMobileOpen = useAppStore((s) => s.setMobileRightOpen)
  const [allPointsVisible, setAllPointsVisible] = useState(true)

  const totalPoints = fields.reduce((s, f) => s + f.points.length, 0)

  const toggleAllPoints = () => {
    const next = !allPointsVisible
    setAllPointsVisible(next)
    fields.forEach((f) => {
      f.pointMarkers.forEach((m) => {
        const el = (m as unknown as { _icon: HTMLElement })._icon
        if (el) el.style.display = next ? '' : 'none'
      })
    })
  }

  const panelHeader = (
    <div className="px-3 py-2.5 border-t border-b border-border flex items-center gap-2 shrink-0">
      <div className="font-mono text-[10px] text-olive-lit tracking-[2px] flex-1 flex items-center gap-1.5 before:content-[''] before:w-3 before:h-px before:bg-olive-lit uppercase">
        Champs & points
      </div>
      {totalPoints > 0 && (
        <button
          onClick={toggleAllPoints}
          className={`font-mono text-[10px] px-2 py-1 border cursor-pointer transition-all
            ${allPointsVisible
              ? 'text-amber bg-amber/10 border-amber/25 hover:bg-amber/20'
              : 'text-muted bg-transparent border-border hover:border-muted'}`}
        >
          {allPointsVisible ? '◉ Masquer pts' : '○ Afficher pts'}
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* ── Mobile: FAB + bottom sheet ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-[60px] right-3 z-[800] bg-orange-500 text-white w-12 h-12 rounded-full shadow-lg shadow-orange-500/40 flex items-center justify-center active:scale-95 transition-transform border-2 border-white/30"
      >
        <span className="text-[11px] font-mono leading-none text-center">
          {fields.length}<br />
          <span className="text-[8px] opacity-80">zones</span>
        </span>
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-[850]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-[851] bg-[var(--color-panel)] border-t border-[var(--color-border)] rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out max-h-[75vh] flex flex-col ${
        mobileOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="flex justify-center py-2 shrink-0" onClick={() => setMobileOpen(false)}>
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>
        {panelHeader}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <FieldList />
        </div>
        <ArchivesSection />
      </div>

      {/* ── Desktop: classic sidebar ── */}
      <aside className="hidden md:flex bg-panel border-l border-border flex-col overflow-hidden">
        {panelHeader}
        <FieldList />
        <ArchivesSection />
      </aside>
    </>
  )
}

function ArchivesSection() {
  const allFields = useAppStore((s) => s.fields)
  const archivedFields = allFields.filter((f) => f.archived)
  const unarchiveField = useAppStore((s) => s.unarchiveField)
  const setArchivedFieldVisible = useAppStore((s) => s.setArchivedFieldVisible)
  const toast = useAppStore((s) => s.toast)

  if (archivedFields.length === 0) return null

  const toggleVisible = (f: Field) => {
    const map = getMap()
    if (!map) { toast('⚠ Carte non prête', true); return }
    const next = !f.archivedVisible
    if (next) {
      // Show with archived style (dashed + faded) to distinguish from active zones
      if (f.layer) {
        f.layer.addTo(map)
        f.layer.setStyle({ dashArray: '6 6', fillOpacity: 0.05, opacity: 0.6 })
      }
      f.labelMarker?.addTo(map)
    } else {
      f.layer?.remove()
      f.labelMarker?.remove()
    }
    setArchivedFieldVisible(f.id, next)
  }

  const handleUnarchive = (f: Field) => {
    if (!window.confirm(`Désarchiver « ${f.name} » ?\nLa zone redeviendra modifiable.`)) return
    const map = getMap()
    if (map) {
      // Restore full visibility with active-zone style
      if (f.layer) {
        f.layer.addTo(map)
        f.layer.setStyle({ color: f.color, weight: 2, fillColor: f.color, fillOpacity: 0.15, dashArray: '', opacity: 1 })
      }
      f.labelMarker?.addTo(map)
      f.pointMarkers.forEach((m) => m.addTo(map))
    }
    unarchiveField(f.id)
    setArchivedFieldVisible(f.id, false)
    toast(`✓ "${f.name}" désarchivée`)
  }

  return (
    <div className="border-t border-border bg-bg/40 max-h-[30%] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-bg shrink-0">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 sticky top-0 bg-panel z-10">
        <div className="font-mono text-[10px] text-amber tracking-[2px] flex-1 flex items-center gap-1.5 before:content-[''] before:w-3 before:h-px before:bg-amber uppercase">
          Archives ({archivedFields.length})
        </div>
      </div>
      <div>
        {archivedFields.map((f) => (
          <div key={f.id} className="border-b border-border p-2 px-3 flex flex-col gap-1.5 opacity-80">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
              <span className="font-ui text-[12px] font-semibold text-muted flex-1 truncate line-through" title={f.name}>{f.name}</span>
              <span className="font-mono text-[9px] text-muted">{f.area.toFixed(2)} ha</span>
            </div>
            {f.archivedAt && (
              <div className="font-mono text-[9px] text-muted">
                Archivée le {new Date(f.archivedAt).toLocaleDateString('fr-FR')}
              </div>
            )}
            <div className="flex gap-1">
              <button
                onClick={() => toggleVisible(f)}
                className={`btn-sm flex-1 text-[10px] ${f.archivedVisible ? 'btn-amber' : 'btn-cyan'}`}
                title={f.archivedVisible ? 'Masquer sur la carte' : 'Afficher sur la carte'}>
                {f.archivedVisible ? '◉ Masquer' : '○ Afficher'}
              </button>
              <button
                onClick={() => useAppStore.getState().openFieldDetail(f.id)}
                className="btn-sm btn-cyan text-[10px]"
                title="Voir l'historique (lecture seule)">
                ◈
              </button>
              <button
                onClick={() => handleUnarchive(f)}
                className="btn-sm btn-active text-[10px]"
                title="Désarchiver">
                ↶
              </button>
              <button
                onClick={() => {
                  if (!window.confirm(`Supprimer définitivement « ${f.name} » ?\nCette action est irréversible.`)) return
                  f.layer?.remove()
                  f.labelMarker?.remove()
                  f.pointMarkers.forEach((m) => m.remove())
                  useAppStore.getState().removeField(f.id)
                  toast(`✓ "${f.name}" supprimée`)
                }}
                className="btn-sm btn-danger text-[10px]"
                title="Supprimer définitivement">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
