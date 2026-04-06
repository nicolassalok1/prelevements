import { useState } from 'react'
import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { calcArea, calcPerimeter } from '../utils/geometry'
import type { Field, LatLng } from '../types'

export function FieldList() {
  const fields = useAppStore((s) => s.fields)
  const selectedFieldId = useAppStore((s) => s.selectedFieldId)
  const selectField = useAppStore((s) => s.selectField)
  const exploitPolygon = useAppStore((s) => s.exploitPolygon)
  const employees = useAppStore((s) => s.employees)

  if (!fields.length) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 px-4 text-center text-muted text-xs leading-relaxed">
          {exploitPolygon
            ? 'Exploitation définie.\nAjoutez maintenant vos champs.'
            : 'Commencez par dessiner\nle périmètre de votre exploitation.'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-bg">
      {fields.map((f) => (
        <div key={f.id}>
          <FieldCard field={f} isSelected={f.id === selectedFieldId} onSelect={() => selectField(f.id)} employees={employees} />
          {f.points.map((pt, i) => (
            <PointRow key={`${f.id}-${i}`} field={f} point={pt} index={i} />
          ))}
        </div>
      ))}
    </div>
  )
}

function FieldCard({ field: f, isSelected, onSelect, employees }: {
  field: Field; isSelected: boolean; onSelect: () => void; employees: { id: number; name: string; role: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(f.name)
  const [pointsVisible, setPointsVisible] = useState(true)
  const updateField = useAppStore((s) => s.updateField)
  const editTarget = useAppStore((s) => s.editTarget)
  const isEditingThis = editTarget?.type === 'field' && editTarget.fieldId === f.id
  const addPointFieldId = useAppStore((s) => s.addPointFieldId)
  const addingPointHere = addPointFieldId === f.id
  const toast = useAppStore((s) => s.toast)

  const togglePoints = () => {
    const next = !pointsVisible
    setPointsVisible(next)
    f.pointMarkers.forEach((m) => {
      const el = (m as unknown as { _icon: HTMLElement })._icon
      if (el) el.style.display = next ? '' : 'none'
    })
  }

  const handleRename = () => {
    const newName = editName.trim()
    if (!newName) { setEditName(f.name); setEditing(false); return }
    updateField(f.id, { name: newName })
    // Update label on map
    if (f.labelMarker) {
      f.labelMarker.setIcon(L.divIcon({
        html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;color:${f.color};text-shadow:0 0 4px #000,0 0 8px #000;white-space:nowrap">${newName}</div>`,
        iconSize: [0, 0], className: '',
      }))
    }
    toast(`✓ Renommé en "${newName}"`)
    setEditing(false)
  }

  const handleDelete = () => {
    f.layer?.remove()
    f.labelMarker?.remove()
    f.pointMarkers.forEach((m) => m.remove())
    useAppStore.getState().removeField(f.id)
    useAppStore.getState().toast(`Champ "${f.name}" supprimé`)
  }

  return (
    <div
      id={`field-card-${f.id}`}
      className={`border-b border-border p-2.5 px-4 cursor-pointer transition-all duration-300
        ${isSelected ? 'bg-olive/20 border-l-[3px] border-l-olive-lit shadow-[inset_0_0_12px_rgba(143,168,79,0.15)]' : 'hover:bg-olive/10'}`}
      onClick={() => {
        onSelect()
        if (f.layer) {
          const map = (f.layer as unknown as { _map: L.Map })._map
          if (map) map.fitBounds(f.layer.getBounds(), { padding: [40, 40] })
        }
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
        {editing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditName(f.name); setEditing(false) } }}
            onBlur={handleRename}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            className="flex-1 font-mono text-xs bg-bg border border-olive-lit text-text py-0.5 px-1.5 outline-none"
          />
        ) : (
          <span
            className="font-ui text-[13px] font-semibold text-text flex-1 hover:text-olive-lit transition-colors"
            onDoubleClick={(e) => { e.stopPropagation(); setEditName(f.name); setEditing(true) }}
            title="Double-clic pour renommer"
          >
            {f.name}
          </span>
        )}
        {f.points.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); togglePoints() }}
            className={`font-mono text-[9px] px-1.5 py-px border cursor-pointer transition-all
              ${pointsVisible ? 'text-amber bg-amber/10 border-amber/25' : 'text-muted bg-transparent border-border line-through'}`}
            title={pointsVisible ? 'Masquer les points' : 'Afficher les points'}
          >
            {f.points.length} pts {pointsVisible ? '◉' : '○'}
          </button>
        )}
        {f.points.length === 0 && (
          <span className="font-mono text-[9px] text-muted bg-transparent border border-border px-1.5 py-px">0 pts</span>
        )}
      </div>
      <div className="font-mono text-[10px] text-muted leading-relaxed">
        {f.area.toFixed(2)} ha · {Math.round(f.perimeter)} m
      </div>
      <FieldMeta field={f} employees={employees} />
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {isEditingThis ? (
          <>
            <button className="btn-sm btn-active flex-1"
              onClick={(e) => { e.stopPropagation()
                if (f.layer) {
                  const raw = f.layer.getLatLngs()[0] as L.LatLng[]
                  const latlngs: LatLng[] = raw.map((ll) => ({ lat: ll.lat, lng: ll.lng }))
                  const area = calcArea(latlngs) / 10000
                  const perimeter = calcPerimeter(raw)
                  useAppStore.getState().updateFieldPolygon(f.id, latlngs, area, perimeter)
                  if (f.labelMarker) f.labelMarker.setLatLng(f.layer.getBounds().getCenter())
                }
                useAppStore.getState().setEditTarget(null)
                useAppStore.getState().toast(`✓ Contour de "${f.name}" mis à jour`)
              }}>
              ✓ Valider
            </button>
            <button className="btn-sm btn-danger"
              onClick={(e) => { e.stopPropagation()
                if (f.layer) f.layer.setLatLngs(f.latlngs.map((ll) => [ll.lat, ll.lng]))
                useAppStore.getState().setEditTarget(null)
              }}>
              Annuler
            </button>
          </>
        ) : (
          <>
            {addingPointHere ? (
              <button className="btn-sm btn-danger flex-1"
                onClick={(e) => { e.stopPropagation(); useAppStore.getState().setAddPointFieldId(null); useAppStore.getState().setStatus('EN ATTENTE') }}>
                ■ Arrêter ajout points
              </button>
            ) : (
              <button className="btn-sm btn-amber"
                onClick={(e) => { e.stopPropagation(); useAppStore.getState().setAddPointFieldId(f.id) }}>
                ⊕ Ajouter point
              </button>
            )}
            <button className="btn-sm btn-cyan"
              onClick={(e) => { e.stopPropagation(); useAppStore.getState().openFieldDetail(f.id) }}>
              ◈
            </button>
            <button className="btn-sm btn-amber"
              onClick={(e) => { e.stopPropagation(); useAppStore.getState().setEditTarget({ type: 'field', fieldId: f.id }) }}>
              ✎
            </button>
            <button className="btn-sm btn-danger"
              onClick={(e) => { e.stopPropagation(); handleDelete() }}>
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PointRow({ field: f, point: pt, index: i }: { field: Field; point: { label: string; lat: number; lng: number }; index: number }) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [label, setLabel] = useState(pt.label)

  const handleRenamePoint = () => {
    const newLabel = label.trim()
    if (!newLabel) { setLabel(pt.label); setEditingLabel(false); return }
    useAppStore.getState().renamePoint(f.id, i, newLabel)
    // Update popup
    const marker = f.pointMarkers[i]
    if (marker) marker.setPopupContent(`<b>${newLabel}</b><br>${f.name}<br>Lat: ${pt.lat.toFixed(6)}<br>Lng: ${pt.lng.toFixed(6)}`)
    setEditingLabel(false)
  }

  return (
    <div
      className="font-mono text-[10px] text-muted py-1.5 px-3 pl-6 border-b border-border/50 cursor-pointer transition-colors hover:bg-amber/5 flex items-center gap-2"
      onClick={() => {
        const marker = f.pointMarkers[i]
        if (marker) {
          const map = (marker as unknown as { _map: L.Map })._map
          if (map) map.setView([pt.lat, pt.lng], 17)
          marker.openPopup()
        }
      }}
    >
      {editingLabel ? (
        <input
          type="text" value={label} onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePoint(); if (e.key === 'Escape') { setLabel(pt.label); setEditingLabel(false) } }}
          onBlur={handleRenamePoint} autoFocus
          onClick={(e) => e.stopPropagation()}
          className="w-[55px] font-mono text-[10px] bg-bg border border-olive-lit text-amber py-0.5 px-1.5 outline-none"
        />
      ) : (
        <span className="text-amber min-w-[40px] font-bold hover:underline cursor-text"
          onDoubleClick={(e) => { e.stopPropagation(); setLabel(pt.label); setEditingLabel(true) }}
          title="Double-clic pour renommer">
          {pt.label}
        </span>
      )}
      <span className="flex-1 text-[9px]">{pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}</span>
      <button
        className="text-muted bg-transparent border-none cursor-pointer text-[11px] px-1 hover:text-olive-lit transition-colors"
        onClick={(e) => { e.stopPropagation(); setLabel(pt.label); setEditingLabel(true) }}
        title="Renommer">
        ✎
      </button>
      <button
        className="text-red bg-transparent border-none cursor-pointer text-sm font-bold px-1 hover:text-white hover:bg-red/30 transition-all rounded"
        onClick={(e) => {
          e.stopPropagation()
          const marker = f.pointMarkers[i]
          if (marker) marker.remove()
          useAppStore.getState().removePoint(f.id, i)
        }}
        title="Supprimer le point"
      >
        ✕
      </button>
    </div>
  )
}

function FieldMeta({ field, employees }: { field: Field; employees: { id: number; name: string; role: string }[] }) {
  const culture = field.culture
  const manager = field.assignedManager ? employees.find((e) => e.id === field.assignedManager) : null
  const assigned = field.assignedEmployees.map((eid) => employees.find((e) => e.id === eid)).filter(Boolean)
  const waterCount = useAppStore((s) => s.wateringLog.filter((w) => w.fieldId === field.id).length)
  const amendCount = useAppStore((s) => s.amendmentLog.filter((a) => a.fieldId === field.id).length)
  const soilCount = useAppStore((s) => s.soilAnalyses.filter((a) => a.fieldId === field.id).length)
  const relief = field.relief

  const hasInfo = culture || manager || assigned.length || waterCount || amendCount || soilCount || relief
  if (!hasInfo) return null

  return (
    <div className="mt-1 font-mono text-[9px] text-muted leading-relaxed space-y-0.5">
      {culture && (
        <div>
          <span className="text-olive-lit">Culture:</span>{' '}
          {culture.seedType === 'beldia' ? 'Beldia' : `Cali${culture.strain ? ' — ' + culture.strain : ''}`}
        </div>
      )}
      {manager && <div><span className="text-amber">Resp:</span> {manager.name}</div>}
      {assigned.length > 0 && <div><span className="text-olive-lit">Équipe:</span> {assigned.map((e) => e!.name).join(', ')}</div>}
      {relief && <div><span className="text-cyan">Expo:</span> {relief.exposition}{relief.sunlightHours ? ` · ${relief.sunlightHours}h soleil` : ''}</div>}
      {(waterCount > 0 || amendCount > 0 || soilCount > 0) && (
        <div className="flex gap-2 mt-0.5">
          {waterCount > 0 && <span className="text-cyan">{waterCount} arrosage{waterCount > 1 ? 's' : ''}</span>}
          {amendCount > 0 && <span className="text-olive-lit">{amendCount} amend.</span>}
          {soilCount > 0 && <span className="text-amber">{soilCount} analyse{soilCount > 1 ? 's' : ''}</span>}
        </div>
      )}
    </div>
  )
}
