import { useState } from 'react'
import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { FieldList } from './FieldList'
import type { Field } from '../types'

export function RightPanel() {
  const fields = useAppStore((s) => s.fields).filter((f) => !f.archived)
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

  return (
    <aside className="bg-panel border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] flex-1 flex items-center gap-1.5 before:content-[''] before:w-3 before:h-px before:bg-olive-lit uppercase">
          Champs & points
        </div>
        {totalPoints > 0 && (
          <button
            onClick={toggleAllPoints}
            className={`font-mono text-[10px] px-2 py-0.5 border cursor-pointer transition-all
              ${allPointsVisible
                ? 'text-amber bg-amber/10 border-amber/25 hover:bg-amber/20'
                : 'text-muted bg-transparent border-border hover:border-muted'}`}
            title={allPointsVisible ? 'Masquer tous les points' : 'Afficher tous les points'}
          >
            {allPointsVisible ? '◉ Masquer pts' : '○ Afficher pts'}
          </button>
        )}
      </div>

      {/* Field list */}
      <FieldList />

      {/* Archives */}
      <ArchivesSection />
    </aside>
  )
}

function ArchivesSection() {
  const archivedFields = useAppStore((s) => s.fields.filter((f) => f.archived))
  const unarchiveField = useAppStore((s) => s.unarchiveField)
  const setArchivedFieldVisible = useAppStore((s) => s.setArchivedFieldVisible)
  const toast = useAppStore((s) => s.toast)

  if (archivedFields.length === 0) return null

  const toggleVisible = (f: Field) => {
    const next = !f.archivedVisible
    if (next) {
      // Show: re-add layer and label to the map if not already
      if (f.layer && !(f.layer as unknown as { _map: L.Map | null })._map) {
        // Find the map from any other field layer or from document
        const anyField = useAppStore.getState().fields.find((x) => x.layer && (x.layer as unknown as { _map: L.Map })._map)
        const map = anyField ? (anyField.layer as unknown as { _map: L.Map })._map : null
        if (map) {
          f.layer.addTo(map)
          f.labelMarker?.addTo(map)
        }
      }
    } else {
      if (f.layer) f.layer.remove()
      f.labelMarker?.remove()
    }
    setArchivedFieldVisible(f.id, next)
  }

  const handleUnarchive = (f: Field) => {
    if (!window.confirm(`Désarchiver « ${f.name} » ?\nLa zone redeviendra modifiable.`)) return
    // Show on map if hidden
    if (f.layer && !(f.layer as unknown as { _map: L.Map | null })._map) {
      const anyField = useAppStore.getState().fields.find((x) => x.id !== f.id && x.layer && (x.layer as unknown as { _map: L.Map })._map)
      const map = anyField ? (anyField.layer as unknown as { _map: L.Map })._map : null
      if (map) {
        f.layer.addTo(map)
        f.labelMarker?.addTo(map)
        f.pointMarkers.forEach((m) => m.addTo(map))
      }
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
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
