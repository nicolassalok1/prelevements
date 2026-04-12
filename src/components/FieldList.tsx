import { useState, useEffect } from 'react'
import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { calcArea, calcPerimeter } from '../utils/geometry'
import { addPointFromCoords, renderChampOnMap } from './MapView'
import { ArchiveFieldModal } from './ArchiveFieldModal'
import { triggerAutoReliefIfNeeded } from '../utils/relief-background'
import type { Field, LatLng, Champ, GerminationStatus } from '../types'

const CHAMP_COLORS = [
  '#e0c040', '#40c0e0', '#e06040', '#60e080', '#c060e0',
  '#e0a040', '#4080e0', '#80e040', '#e04080', '#40e0c0',
]
const SERRE_COLORS = [
  '#80d090', '#60c0a0', '#a0d060', '#50b080', '#70c070',
  '#90d080', '#60b0a0', '#80c060', '#50d070', '#70b090',
]

const GERMINATION_LABELS: Record<GerminationStatus, string> = {
  semis: 'Semis', germination: 'Germination', croissance: 'Croissance',
  pret_transfert: 'Prêt au transfert', transfere: 'Transféré',
}
const GERMINATION_COLOR: Record<GerminationStatus, string> = {
  semis: 'text-muted border-border', germination: 'text-cyan border-cyan/60',
  croissance: 'text-amber border-amber/60', pret_transfert: 'text-olive-lit border-olive-lit/60',
  transfere: 'text-muted border-border line-through',
}

export function FieldList() {
  const allFields = useAppStore((s) => s.fields)
  const fields = allFields.filter((f) => !f.archived)
  const champs = useAppStore((s) => s.champs)
  const selectedFieldId = useAppStore((s) => s.selectedFieldId)
  const selectField = useAppStore((s) => s.selectField)
  const exploitPolygon = useAppStore((s) => s.exploitPolygon)
  const [creatingChamp, setCreatingChamp] = useState(false)
  const [newChampName, setNewChampName] = useState('')
  const [creatingSerre, setCreatingSerre] = useState(false)
  const [newSerreName, setNewSerreName] = useState('')

  if (!fields.length && !champs.length) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 px-4 text-center text-muted text-xs leading-relaxed">
          {exploitPolygon
            ? 'Exploitation définie.\nAjoutez maintenant vos parcelles.'
            : 'Commencez par dessiner\nle périmètre de votre exploitation.'}
        </div>
      </div>
    )
  }

  const freeParcelles = fields.filter((f) => !f.champId)

  const handleCreateChamp = () => {
    const name = newChampName.trim()
    if (!name) return
    const store = useAppStore.getState()
    const id = store.champIdCounter + 1
    const color = CHAMP_COLORS[(id - 1) % CHAMP_COLORS.length]
    const champ: Champ = { id, name, color, type: 'champ', parcelleIds: [] }
    store.addChamp(champ)
    store.toast(`✓ Champ "${name}" créé`)
    setNewChampName('')
    setCreatingChamp(false)
  }

  const handleCreateSerre = () => {
    const name = newSerreName.trim()
    if (!name) return
    const store = useAppStore.getState()
    const id = store.champIdCounter + 1
    const color = SERRE_COLORS[(id - 1) % SERRE_COLORS.length]
    const serre: Champ = { id, name, color, type: 'serre', parcelleIds: [], serreInfo: { status: 'semis' } }
    store.addChamp(serre)
    store.toast(`✓ Serre "${name}" créée`)
    setNewSerreName('')
    setCreatingSerre(false)
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-bg">
      {/* Bouton créer champ */}
      {exploitPolygon && (
        <div className="px-3 py-2 border-b border-border">
          {creatingChamp ? (
            <div className="flex gap-1.5">
              <input
                type="text" value={newChampName}
                onChange={(e) => setNewChampName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChamp(); if (e.key === 'Escape') setCreatingChamp(false) }}
                placeholder="Nom du champ..." autoFocus
                className="flex-1 font-mono text-[10px] bg-bg border border-amber text-text py-1 px-2 outline-none"
              />
              <button className="btn-sm btn-amber text-[10px]" onClick={handleCreateChamp}>✓</button>
              <button className="btn-sm btn-danger text-[10px]" onClick={() => setCreatingChamp(false)}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingChamp(true)}
              className="w-full py-1.5 bg-amber/10 border border-amber/30 text-amber font-mono text-[10px] tracking-[1px] uppercase cursor-pointer hover:bg-amber/20 transition-all"
            >
              + Nouveau champ
            </button>
          )}
        </div>
      )}

      {/* Champs */}
      {champs.filter((c) => c.type !== 'serre').map((champ) => (
        <ChampCard key={`champ-${champ.id}`} champ={champ} />
      ))}

      {/* Parcelles libres */}
      {freeParcelles.length > 0 && (
        <>
          {champs.filter((c) => c.type !== 'serre').length > 0 && (
            <div className="px-3 py-1.5 border-b border-border bg-bg/40">
              <span className="font-mono text-[9px] text-muted tracking-[1.5px] uppercase">
                Parcelles libres ({freeParcelles.length})
              </span>
            </div>
          )}
          {freeParcelles.map((f) => (
            <div key={f.id}>
              <FieldCard field={f} isSelected={f.id === selectedFieldId} onSelect={() => selectField(f.id)} />
              {f.id === selectedFieldId && f.points.map((pt, i) => (
                <PointRow key={`${f.id}-${i}`} field={f} point={pt} index={i} />
              ))}
            </div>
          ))}
        </>
      )}

      {/* ── SERRES ── */}
      {exploitPolygon && (
        <>
          <div className="px-3 py-2.5 border-t-2 border-b border-border flex items-center gap-2 shrink-0 bg-bg/40">
            <div className="font-mono text-[10px] text-olive-lit tracking-[2px] flex-1 flex items-center gap-1.5 before:content-[''] before:w-3 before:h-px before:bg-olive-lit uppercase">
              Serres
            </div>
          </div>
          <div className="px-3 py-2 border-b border-border">
            {creatingSerre ? (
              <div className="flex gap-1.5">
                <input
                  type="text" value={newSerreName}
                  onChange={(e) => setNewSerreName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSerre(); if (e.key === 'Escape') setCreatingSerre(false) }}
                  placeholder="Nom de la serre..." autoFocus
                  className="flex-1 font-mono text-[10px] bg-bg border border-olive-lit text-text py-1 px-2 outline-none"
                />
                <button className="btn-sm btn-active text-[10px]" onClick={handleCreateSerre}>✓</button>
                <button className="btn-sm btn-danger text-[10px]" onClick={() => setCreatingSerre(false)}>✕</button>
              </div>
            ) : (
              <button
                onClick={() => setCreatingSerre(true)}
                className="w-full py-1.5 bg-olive/10 border border-olive-lit/30 text-olive-lit font-mono text-[10px] tracking-[1px] uppercase cursor-pointer hover:bg-olive/20 transition-all"
              >
                + Nouvelle serre
              </button>
            )}
          </div>
          {champs.filter((c) => c.type === 'serre').map((serre) => (
            <SerreCard key={`serre-${serre.id}`} champ={serre} />
          ))}
        </>
      )}
    </div>
  )
}

function ChampCard({ champ }: { champ: Champ }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(champ.name)
  const [assigning, setAssigning] = useState(false)
  const [selectedParcelleIds, setSelectedParcelleIds] = useState<number[]>([])
  const allFields = useAppStore((s) => s.fields).filter((f) => !f.archived)
  const selectedFieldId = useAppStore((s) => s.selectedFieldId)
  const selectField = useAppStore((s) => s.selectField)
  const editTarget = useAppStore((s) => s.editTarget)
  const isEditingChamp = editTarget?.type === 'champ' && editTarget.champId === champ.id
  const drawTarget = useAppStore((s) => s.drawTarget)
  const drawForChampId = useAppStore((s) => s.drawForChampId)
  const isDrawingForThis = drawTarget === 'field' && drawForChampId === champ.id

  const parcelles = allFields.filter((f) => champ.parcelleIds.includes(f.id))
  const freeParcelles = allFields.filter((f) => !f.champId)
  const totalArea = parcelles.reduce((s, f) => s + f.area, 0)

  // Auto-open when a parcelle inside this champ is selected on the map
  const hasSelectedParcelle = selectedFieldId != null && champ.parcelleIds.includes(selectedFieldId)
  useEffect(() => {
    if (hasSelectedParcelle && !open) setOpen(true)
  }, [hasSelectedParcelle])

  const handleRename = () => {
    const name = editName.trim()
    if (!name) { setEditName(champ.name); setEditing(false); return }
    useAppStore.getState().updateChamp(champ.id, { name })
    if (champ.labelMarker) {
      champ.labelMarker.setIcon(L.divIcon({
        html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;color:${champ.color};text-shadow:0 0 6px #000,0 0 12px #000;white-space:nowrap;letter-spacing:1px;text-transform:uppercase">${name}</div>`,
        iconSize: [0, 0], className: '',
      }))
    }
    useAppStore.getState().toast(`✓ Champ renommé en "${name}"`)
    setEditing(false)
  }

  const handleDelete = () => {
    if (!window.confirm(`Supprimer le champ "${champ.name}" ?\nLes parcelles seront conservées mais détachées.`)) return
    champ.layer?.remove()
    champ.labelMarker?.remove()
    useAppStore.getState().removeChamp(champ.id)
    useAppStore.getState().toast(`Champ "${champ.name}" supprimé`)
  }

  const handleAssignParcelle = (fieldId: number) => {
    useAppStore.getState().addParcelleToChamp(champ.id, fieldId)
  }

  const handleRemoveParcelle = (fieldId: number) => {
    useAppStore.getState().removeParcelleFromChamp(champ.id, fieldId)
    renderChampOnMap(champ.id)
    useAppStore.getState().toast(`Parcelle retirée du champ`)
  }

  const handleValidateContour = () => {
    if (champ.layer) {
      const raw = champ.layer.getLatLngs()[0] as L.LatLng[]
      const outline: LatLng[] = raw.map((ll) => ({ lat: ll.lat, lng: ll.lng }))
      useAppStore.getState().setChampCustomOutline(champ.id, outline)
      if (champ.labelMarker) champ.labelMarker.setLatLng(champ.layer.getBounds().getCenter())
    }
    useAppStore.getState().setEditTarget(null)
    useAppStore.getState().toast(`✓ Contour du champ mis à jour`)
  }

  return (
    <div className="border-b border-border">
      {/* Header */}
      <div className="px-3 py-2 cursor-pointer hover:bg-olive/10 transition-all flex items-center gap-2" onClick={() => setOpen(!open)}>
        <span className="text-[10px] text-muted transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        <div className="w-3 h-3 rounded-sm shrink-0 border border-white/20" style={{ background: champ.color }} />
        {editing ? (
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditName(champ.name); setEditing(false) } }}
            onBlur={handleRename} autoFocus onClick={(e) => e.stopPropagation()}
            className="flex-1 font-mono text-xs bg-bg border border-amber text-text py-0.5 px-1.5 outline-none" />
        ) : (
          <span className="font-ui text-[13px] font-bold text-text flex-1 tracking-wide"
            onDoubleClick={(e) => { e.stopPropagation(); setEditName(champ.name); setEditing(true) }}
            title="Double-clic pour renommer">{champ.name}</span>
        )}
        <span className="font-mono text-[9px] text-muted">{parcelles.length} parc. · {totalArea.toFixed(2)} ha</span>
      </div>

      {/* Content */}
      {open && (
        <div className="px-3 pb-2">
          {isEditingChamp ? (
            <div className="flex gap-1 mb-2">
              <button className="btn-sm btn-active flex-1" onClick={(e) => { e.stopPropagation(); handleValidateContour() }}>✓ Valider contour</button>
              <button className="btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); renderChampOnMap(champ.id); useAppStore.getState().setEditTarget(null) }}>Annuler</button>
            </div>
          ) : (
            <div className="flex gap-1 mb-2 flex-wrap">
              {isDrawingForThis ? (
                <button className="btn-sm btn-danger flex-1 text-[10px]"
                  onClick={(e) => { e.stopPropagation(); useAppStore.getState().setDrawTarget(null); useAppStore.getState().setDrawForChampId(null); useAppStore.getState().setStatus('EN ATTENTE') }}>
                  ■ Annuler dessin
                </button>
              ) : (
                <>
                  <div className="w-full border border-border bg-bg/40 p-1.5 mb-1">
                    <div className="font-mono text-[9px] text-olive-lit uppercase tracking-[1.5px] mb-1.5">Ajouter une nouvelle parcelle</div>
                    <div className="flex gap-1">
                      <button className="btn-sm btn-active flex-1 text-[10px]" title="Dessiner une nouvelle parcelle dans ce champ"
                        onClick={(e) => { e.stopPropagation(); useAppStore.getState().setDrawForChampId(champ.id); useAppStore.getState().setDrawTarget('field'); useAppStore.getState().setStatus(`DESSIN PARCELLE pour "${champ.name}" — cliquez les sommets`) }}>
                        ▭ Dessiner
                      </button>
                      <button className="btn-sm btn-cyan flex-1 text-[10px]" title="Assigner des parcelles existantes"
                        onClick={(e) => { e.stopPropagation(); if (!assigning) setSelectedParcelleIds([]); setAssigning(!assigning) }}>⊕ Existantes</button>
                    </div>
                  </div>
                  <button className="btn-sm btn-cyan text-[10px]" title="Renommer le champ"
                    onClick={(e) => { e.stopPropagation(); setEditName(champ.name); setEditing(true) }}>✎ Renommer</button>
                  <button className="btn-sm btn-amber text-[10px]" title="Modifier le contour"
                    onClick={(e) => { e.stopPropagation(); useAppStore.getState().setEditTarget({ type: 'champ', champId: champ.id }) }}>✎ Contour</button>
                  {champ.customOutline && (
                    <button className="btn-sm btn-cyan text-[10px]" title="Recalculer auto"
                      onClick={(e) => { e.stopPropagation(); useAppStore.getState().setChampCustomOutline(champ.id, undefined); renderChampOnMap(champ.id); useAppStore.getState().toast(`✓ Contour recalculé`) }}>↻ Auto</button>
                  )}
                  <button className="btn-sm btn-danger text-[10px]" title="Supprimer"
                    onClick={(e) => { e.stopPropagation(); handleDelete() }}>✕</button>
                </>
              )}
            </div>
          )}

          {assigning && freeParcelles.length > 0 && (
            <div className="mb-2 p-1.5 bg-bg border border-amber/30 space-y-1">
              <div className="font-mono text-[9px] text-amber uppercase tracking-[1px]">Parcelles disponibles — sélectionnez puis validez</div>
              {freeParcelles.map((f) => {
                const selected = selectedParcelleIds.includes(f.id)
                return (
                  <button key={f.id}
                    className={`w-full text-left font-mono text-[10px] text-text py-1 px-2 border cursor-pointer transition-all flex items-center gap-2 ${
                      selected ? 'bg-amber/20 border-amber' : 'bg-panel border-border hover:border-amber hover:bg-amber/10'
                    }`}
                    onClick={() => setSelectedParcelleIds((prev) => selected ? prev.filter((id) => id !== f.id) : [...prev, f.id])}>
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] shrink-0 ${
                      selected ? 'bg-amber border-amber text-black font-bold' : 'border-muted'
                    }`}>{selected ? '✓' : ''}</div>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />
                    {f.name} — {f.area.toFixed(2)} ha
                  </button>
                )
              })}
              <div className="flex gap-1 pt-1">
                <button className="btn-sm btn-amber flex-1 text-[10px]" disabled={selectedParcelleIds.length === 0}
                  onClick={() => {
                    selectedParcelleIds.forEach((id) => handleAssignParcelle(id))
                    renderChampOnMap(champ.id)
                    useAppStore.getState().toast(`✓ ${selectedParcelleIds.length} parcelle${selectedParcelleIds.length > 1 ? 's' : ''} ajoutée${selectedParcelleIds.length > 1 ? 's' : ''}`)
                    setSelectedParcelleIds([])
                    setAssigning(false)
                  }}>
                  ✓ Valider ({selectedParcelleIds.length})
                </button>
                <button className="btn-sm btn-danger text-[10px]"
                  onClick={() => { setSelectedParcelleIds([]); setAssigning(false) }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
          {assigning && freeParcelles.length === 0 && (
            <div className="mb-2 font-mono text-[9px] text-muted">Aucune parcelle libre</div>
          )}

          {parcelles.map((f) => (
            <div key={f.id}>
              <FieldCard field={f} isSelected={f.id === selectedFieldId} onSelect={() => selectField(f.id)}
                champId={champ.id} onRemoveFromChamp={() => handleRemoveParcelle(f.id)} />
              {f.id === selectedFieldId && f.points.map((pt, i) => (
                <PointRow key={`${f.id}-${i}`} field={f} point={pt} index={i} />
              ))}
            </div>
          ))}

          {parcelles.length === 0 && (
            <div className="font-mono text-[9px] text-muted py-2 text-center">Aucune parcelle — cliquez "⊕ Parcelle"</div>
          )}
        </div>
      )}
    </div>
  )
}

function FieldCard({ field: f, isSelected, onSelect, champId, onRemoveFromChamp }: {
  field: Field; isSelected: boolean; onSelect: () => void
  champId?: number; onRemoveFromChamp?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(f.name)
  const [pointsVisible, setPointsVisible] = useState(true)
  const [archiveOpen, setArchiveOpen] = useState(false)
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
    if (f.labelMarker) {
      f.labelMarker.setIcon(L.divIcon({
        html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;color:${f.color};text-shadow:0 0 4px #000,0 0 8px #000;white-space:nowrap">${newName}</div>`,
        iconSize: [0, 0], className: '',
      }))
    }
    toast(`✓ Renommé en "${newName}"`)
    setEditing(false)
  }



  return (
    <div
      id={`field-card-${f.id}`}
      className={`border-b border-border/50 p-2 px-4 cursor-pointer transition-all duration-300
        ${champId ? 'pl-6' : ''}
        ${isSelected ? 'bg-olive/20 border-l-[3px] border-l-olive-lit shadow-[inset_0_0_12px_rgba(143,168,79,0.15)]' : 'hover:bg-olive/10'}`}
      onClick={() => {
        onSelect()
        if (f.layer) {
          const map = (f.layer as unknown as { _map: L.Map })._map
          if (map) map.fitBounds(f.layer.getBounds(), { padding: [40, 40] })
        }
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
        {editing ? (
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditName(f.name); setEditing(false) } }}
            onBlur={handleRename} autoFocus onClick={(e) => e.stopPropagation()}
            className="flex-1 font-mono text-xs bg-bg border border-olive-lit text-text py-0.5 px-1.5 outline-none" />
        ) : (
          <span className="font-ui text-[12px] font-semibold text-text flex-1 hover:text-olive-lit transition-colors"
            onDoubleClick={(e) => { e.stopPropagation(); setEditName(f.name); setEditing(true) }}
            title="Double-clic pour renommer">{f.name}</span>
        )}
        <span className="font-mono text-[9px] text-muted">{f.area.toFixed(2)} ha</span>
        <span className="font-mono text-[9px] text-muted">{f.points.length} pts</span>
      </div>
      {isSelected && <>
      <div className="font-mono text-[10px] text-muted leading-relaxed mt-1">
        {f.area.toFixed(2)} ha · {Math.round(f.area * 10000).toLocaleString('fr-FR')} m²
      </div>
      {f.points.length > 0 && (
        <button onClick={(e) => { e.stopPropagation(); togglePoints() }}
          className={`font-mono text-[9px] px-1.5 py-px border cursor-pointer transition-all mt-1
            ${pointsVisible ? 'text-amber bg-amber/10 border-amber/25' : 'text-muted bg-transparent border-border line-through'}`}>
          {f.points.length} pts {pointsVisible ? '◉ Masquer' : '○ Afficher'}
        </button>
      )}
      <FieldMeta field={f} />
      {addingPointHere && <AddPointInputs fieldId={f.id} />}
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
                useAppStore.getState().toast(`✓ Contour mis à jour`)
                if (champId) renderChampOnMap(champId)
                void triggerAutoReliefIfNeeded(f.id)
              }}>✓ Valider</button>
            <button className="btn-sm btn-danger"
              onClick={(e) => { e.stopPropagation()
                if (f.layer) f.layer.setLatLngs(f.latlngs.map((ll) => [ll.lat, ll.lng]))
                useAppStore.getState().setEditTarget(null)
              }}>Annuler</button>
          </>
        ) : (
          <>
            {addingPointHere ? (
              <button className="btn-sm btn-danger flex-1"
                onClick={(e) => { e.stopPropagation(); useAppStore.getState().setAddPointFieldId(null); useAppStore.getState().setStatus('EN ATTENTE') }}>
                ■ Stop points</button>
            ) : (
              <button className="btn-sm btn-amber"
                onClick={(e) => { e.stopPropagation(); useAppStore.getState().setAddPointFieldId(f.id) }}>⊕ Point</button>
            )}
            <button className="btn-sm btn-cyan" title="Détails"
              onClick={(e) => { e.stopPropagation(); useAppStore.getState().openFieldDetail(f.id) }}>◈</button>
            <button className="btn-sm btn-amber" title="Modifier contour"
              onClick={(e) => { e.stopPropagation(); useAppStore.getState().setEditTarget({ type: 'field', fieldId: f.id }) }}>✎</button>
            <button className="btn-sm btn-cyan" title="Archiver"
              onClick={(e) => { e.stopPropagation(); setArchiveOpen(true) }}>◱</button>
            {onRemoveFromChamp && (
              <button className="btn-sm btn-danger text-[10px] ml-auto" title="Retirer du champ"
                onClick={(e) => { e.stopPropagation(); onRemoveFromChamp() }}>↗ Retirer</button>
            )}
          </>
        )}
      </div>
      {archiveOpen && <ArchiveFieldModal fieldId={f.id} onClose={() => setArchiveOpen(false)} />}
      </>}
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
    const marker = f.pointMarkers[i]
    if (marker) marker.setPopupContent(`<b>${newLabel}</b><br>${f.name}<br>Lat: ${pt.lat.toFixed(6)}<br>Lng: ${pt.lng.toFixed(6)}`)
    setEditingLabel(false)
  }

  return (
    <div className="font-mono text-[10px] text-muted py-1.5 px-3 pl-6 border-b border-border/50 cursor-pointer transition-colors hover:bg-amber/5 flex items-center gap-2"
      onClick={() => {
        const marker = f.pointMarkers[i]
        if (marker) {
          const map = (marker as unknown as { _map: L.Map })._map
          if (map) map.setView([pt.lat, pt.lng], 17)
          marker.openPopup()
        }
      }}>
      {editingLabel ? (
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePoint(); if (e.key === 'Escape') { setLabel(pt.label); setEditingLabel(false) } }}
          onBlur={handleRenamePoint} autoFocus onClick={(e) => e.stopPropagation()}
          className="w-[55px] font-mono text-[10px] bg-bg border border-olive-lit text-amber py-0.5 px-1.5 outline-none" />
      ) : (
        <span className="text-amber min-w-[40px] font-bold hover:underline cursor-text"
          onDoubleClick={(e) => { e.stopPropagation(); setLabel(pt.label); setEditingLabel(true) }}
          title="Double-clic pour renommer">{pt.label}</span>
      )}
      <span className="flex-1 text-[9px]">{pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}</span>
      <button className="text-muted bg-transparent border-none cursor-pointer text-[11px] px-1 hover:text-olive-lit transition-colors"
        onClick={(e) => { e.stopPropagation(); setLabel(pt.label); setEditingLabel(true) }} title="Renommer">✎</button>
      <button className="text-red bg-transparent border-none cursor-pointer text-sm font-bold px-1 hover:text-white hover:bg-red/30 transition-all rounded"
        onClick={(e) => { e.stopPropagation(); const marker = f.pointMarkers[i]; if (marker) marker.remove(); useAppStore.getState().removePoint(f.id, i) }}
        title="Supprimer">✕</button>
    </div>
  )
}

function AddPointInputs({ fieldId }: { fieldId: number }) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [notes, setNotes] = useState('')
  const toast = useAppStore((s) => s.toast)

  const handleSave = () => {
    const latN = parseFloat(lat)
    const lngN = parseFloat(lng)
    if (Number.isNaN(latN) || Number.isNaN(lngN)) { toast('⚠ Coordonnées invalides', true); return }
    const res = addPointFromCoords(fieldId, latN, lngN, notes.trim() || undefined)
    if (!res.ok) { toast(`⚠ ${res.error}`, true); return }
    toast('✓ Point ajouté')
    setLat(''); setLng(''); setNotes('')
  }

  return (
    <div className="mt-2 p-2 bg-bg border border-amber/40 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="font-mono text-[9px] text-amber uppercase tracking-[1px]">Ajout point — clic carte OU coordonnées</div>
      <div className="grid grid-cols-2 gap-1.5">
        <input type="number" step="0.000001" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude"
          className="font-mono text-[10px] bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-amber placeholder:text-muted w-0 min-w-full" />
        <input type="number" step="0.000001" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude"
          className="font-mono text-[10px] bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-amber placeholder:text-muted w-0 min-w-full" />
      </div>
      <input id="point-notes-input" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optionnel)"
        className="w-full font-mono text-[10px] bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-amber placeholder:text-muted" />
      <button className="btn-sm btn-amber w-full text-[10px]" onClick={handleSave}>✓ Enregistrer point</button>
    </div>
  )
}

function FieldMeta({ field }: { field: Field }) {
  const culture = field.culture
  const waterCount = useAppStore((s) =>
    s.wateringLog.filter((w) => w.fieldId === field.id).length
    + s.activities.filter((a) => a.type === 'watering' && a.fieldIds.includes(field.id)).length
  )
  const amendCount = useAppStore((s) =>
    s.amendmentLog.filter((a) => a.fieldId === field.id).length
    + s.activities.filter((a) => a.type === 'amendment' && a.fieldIds.includes(field.id)).length
  )
  const otherCount = useAppStore((s) => s.activities.filter((a) => a.type === 'other' && a.fieldIds.includes(field.id)).length)
  const soilCount = useAppStore((s) => s.soilAnalyses.filter((a) => a.fieldId === field.id).length)
  const relief = field.relief

  const hasInfo = culture || waterCount || amendCount || otherCount || soilCount || relief
  if (!hasInfo) return null

  return (
    <div className="mt-1 font-mono text-[9px] text-muted leading-relaxed space-y-0.5">
      {culture && (
        <div><span className="text-olive-lit">Culture:</span>{' '}
          {culture.seedType === 'beldia' ? 'Beldia' : `Cali${culture.strain ? ' — ' + culture.strain : ''}`}</div>
      )}
      {relief && <div><span className="text-cyan">Expo:</span> {relief.exposition}{relief.sunlightHours ? ` · ${relief.sunlightHours}h soleil` : ''}</div>}
      {(waterCount > 0 || amendCount > 0 || otherCount > 0 || soilCount > 0) && (
        <div className="flex gap-2 mt-0.5 flex-wrap">
          {waterCount > 0 && <span className="text-cyan">{waterCount} arrosage{waterCount > 1 ? 's' : ''}</span>}
          {amendCount > 0 && <span className="text-olive-lit">{amendCount} engrais</span>}
          {otherCount > 0 && <span className="text-amber">{otherCount} autre{otherCount > 1 ? 's' : ''}</span>}
          {soilCount > 0 && <span className="text-amber">{soilCount} analyse{soilCount > 1 ? 's' : ''}</span>}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
//  SERRE CARD
// ═══════════════════════════════════════

function SerreCard({ champ }: { champ: Champ }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(champ.name)
  const [assigning, setAssigning] = useState(false)
  const [selectedParcelleIds, setSelectedParcelleIds] = useState<number[]>([])
  const [transferTarget, setTransferTarget] = useState<number | null>(null)
  const allFields = useAppStore((s) => s.fields).filter((f) => !f.archived)
  const allChamps = useAppStore((s) => s.champs)
  const selectedFieldId = useAppStore((s) => s.selectedFieldId)
  const selectField = useAppStore((s) => s.selectField)
  const drawTarget = useAppStore((s) => s.drawTarget)
  const drawForChampId = useAppStore((s) => s.drawForChampId)
  const isDrawingForThis = drawTarget === 'field' && drawForChampId === champ.id

  const parcelles = allFields.filter((f) => champ.parcelleIds.includes(f.id))
  const freeParcelles = allFields.filter((f) => !f.champId)
  const totalArea = parcelles.reduce((s, f) => s + f.area, 0)
  const info = champ.serreInfo || { status: 'semis' as GerminationStatus }
  const targetChamps = allChamps.filter((c) => c.type === 'champ')

  const hasSelectedParcelle = selectedFieldId != null && champ.parcelleIds.includes(selectedFieldId)
  useEffect(() => {
    if (hasSelectedParcelle && !open) setOpen(true)
  }, [hasSelectedParcelle])

  const handleRename = () => {
    const name = editName.trim()
    if (!name) { setEditName(champ.name); setEditing(false); return }
    useAppStore.getState().updateChamp(champ.id, { name })
    if (champ.labelMarker) {
      champ.labelMarker.setIcon(L.divIcon({
        html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;color:${champ.color};text-shadow:0 0 6px #000,0 0 12px #000;white-space:nowrap;letter-spacing:1px;text-transform:uppercase">${name}</div>`,
        iconSize: [0, 0], className: '',
      }))
    }
    useAppStore.getState().toast(`✓ Serre renommée en "${name}"`)
    setEditing(false)
  }

  const handleDelete = () => {
    if (!window.confirm(`Supprimer la serre "${champ.name}" ?\nLes parcelles seront conservées mais détachées.`)) return
    champ.layer?.remove()
    champ.labelMarker?.remove()
    useAppStore.getState().removeChamp(champ.id)
    useAppStore.getState().toast(`Serre "${champ.name}" supprimée`)
  }

  const handleAssignParcelle = (fieldId: number) => {
    useAppStore.getState().addParcelleToChamp(champ.id, fieldId)
  }

  const handleRemoveParcelle = (fieldId: number) => {
    useAppStore.getState().removeParcelleFromChamp(champ.id, fieldId)
    renderChampOnMap(champ.id)
    useAppStore.getState().toast(`Parcelle retirée de la serre`)
  }

  const handleTransfer = () => {
    if (!transferTarget) return
    const target = allChamps.find((c) => c.id === transferTarget)
    if (!target) return
    if (!window.confirm(`Transférer ${parcelles.length} parcelle(s) de "${champ.name}" vers le champ "${target.name}" ?`)) return
    useAppStore.getState().transferSerre(champ.id, transferTarget)
    renderChampOnMap(champ.id)
    renderChampOnMap(transferTarget)
    useAppStore.getState().toast(`✓ Parcelles transférées vers "${target.name}"`)
    setTransferTarget(null)
  }

  return (
    <div className="border-b border-border">
      <div className="px-3 py-2 cursor-pointer hover:bg-olive/10 transition-all flex items-center gap-2" onClick={() => setOpen(!open)}>
        <span className="text-[10px] text-muted transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        <div className="w-3 h-3 rounded-sm shrink-0 border border-white/20" style={{ background: champ.color }} />
        {editing ? (
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditName(champ.name); setEditing(false) } }}
            onClick={(e) => e.stopPropagation()} autoFocus
            className="flex-1 font-mono text-[10px] bg-bg border border-olive-lit text-text py-0.5 px-1 outline-none" />
        ) : (
          <span className="font-ui text-[12px] font-semibold text-text flex-1 truncate" title={champ.name}>{champ.name}</span>
        )}
        <span className={`font-mono text-[9px] px-1.5 py-px border ${GERMINATION_COLOR[info.status]}`}>
          {GERMINATION_LABELS[info.status]}
        </span>
        <span className="font-mono text-[9px] text-muted">{parcelles.length} parc.</span>
        {totalArea > 0 && <span className="font-mono text-[9px] text-muted">{totalArea.toFixed(2)} ha</span>}
      </div>

      {open && (
        <div className="px-3 pb-2">
          {/* Germination tracking */}
          {info.status !== 'transfere' && (
            <div className="bg-bg/60 border border-border p-2 mb-2 space-y-2">
              <div className="font-mono text-[9px] text-olive-lit uppercase tracking-[1.5px]">Suivi germination</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Statut</div>
                  <select value={info.status}
                    onChange={(e) => useAppStore.getState().updateSerreInfo(champ.id, { status: e.target.value as GerminationStatus })}
                    className="w-full font-mono text-[10px] bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-olive-lit">
                    <option value="semis">Semis</option>
                    <option value="germination">Germination</option>
                    <option value="croissance">Croissance</option>
                    <option value="pret_transfert">Prêt au transfert</option>
                  </select>
                </div>
                <div>
                  <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Nb. noeuds</div>
                  <input type="number" min={0} max={10} value={info.nodeCount ?? ''} placeholder="—"
                    onChange={(e) => useAppStore.getState().updateSerreInfo(champ.id, { nodeCount: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full font-mono text-[10px] bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-olive-lit placeholder:text-muted" />
                </div>
              </div>
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Date de semis</div>
                <input type="date" value={info.germinationDate || ''}
                  onChange={(e) => useAppStore.getState().updateSerreInfo(champ.id, { germinationDate: e.target.value || undefined })}
                  className="w-full font-mono text-[10px] bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-olive-lit" />
              </div>

              {/* Transfer to field */}
              {(info.status === 'pret_transfert' || info.status === 'croissance') && parcelles.length > 0 && targetChamps.length > 0 && (
                <div className="border-t border-border pt-2">
                  <div className="font-mono text-[8px] text-olive-lit uppercase mb-1">Transférer vers un champ</div>
                  <div className="flex gap-1">
                    <select value={transferTarget ?? ''} onChange={(e) => setTransferTarget(e.target.value ? parseInt(e.target.value) : null)}
                      className="flex-1 font-mono text-[10px] bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-olive-lit">
                      <option value="">— Choisir un champ —</option>
                      {targetChamps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={handleTransfer} disabled={!transferTarget}
                      className="btn-sm btn-active text-[10px] disabled:opacity-30 disabled:cursor-not-allowed">
                      Transférer →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {info.status === 'transfere' && info.transferDate && (
            <div className="bg-bg/60 border border-border p-2 mb-2">
              <div className="font-mono text-[10px] text-muted">
                Transféré le {new Date(info.transferDate).toLocaleDateString('fr-FR')}
                {info.targetChampId && (() => {
                  const t = allChamps.find((c) => c.id === info.targetChampId)
                  return t ? ` vers "${t.name}"` : ''
                })()}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1 mb-2 flex-wrap">
            {isDrawingForThis ? (
              <button className="btn-sm btn-danger flex-1 text-[10px]"
                onClick={(e) => { e.stopPropagation(); useAppStore.getState().setDrawTarget(null); useAppStore.getState().setDrawForChampId(null); useAppStore.getState().setStatus('EN ATTENTE') }}>
                ■ Annuler dessin
              </button>
            ) : (
              <>
                {info.status !== 'transfere' && (
                  <div className="w-full border border-border bg-bg/40 p-1.5 mb-1">
                    <div className="font-mono text-[9px] text-olive-lit uppercase tracking-[1.5px] mb-1.5">Ajouter une parcelle</div>
                    <div className="flex gap-1">
                      <button className="btn-sm btn-active flex-1 text-[10px]" title="Dessiner une nouvelle parcelle"
                        onClick={(e) => { e.stopPropagation(); useAppStore.getState().setDrawForChampId(champ.id); useAppStore.getState().setDrawTarget('field'); useAppStore.getState().setStatus(`DESSIN PARCELLE pour serre "${champ.name}"`) }}>
                        ▭ Dessiner
                      </button>
                      <button className="btn-sm btn-cyan flex-1 text-[10px]" title="Assigner des parcelles existantes"
                        onClick={(e) => { e.stopPropagation(); if (!assigning) setSelectedParcelleIds([]); setAssigning(!assigning) }}>⊕ Existantes</button>
                    </div>
                  </div>
                )}
                <button className="btn-sm btn-cyan text-[10px]" title="Renommer"
                  onClick={(e) => { e.stopPropagation(); setEditName(champ.name); setEditing(true) }}>✎ Renommer</button>
                <button className="btn-sm btn-danger text-[10px]" title="Supprimer"
                  onClick={(e) => { e.stopPropagation(); handleDelete() }}>✕</button>
              </>
            )}
          </div>

          {/* Assign existing parcelles */}
          {assigning && freeParcelles.length > 0 && (
            <div className="mb-2 p-1.5 bg-bg border border-olive-lit/30 space-y-1">
              <div className="font-mono text-[9px] text-olive-lit uppercase tracking-[1px]">Parcelles disponibles</div>
              {freeParcelles.map((f) => {
                const selected = selectedParcelleIds.includes(f.id)
                return (
                  <button key={f.id}
                    onClick={() => setSelectedParcelleIds(selected ? selectedParcelleIds.filter((x) => x !== f.id) : [...selectedParcelleIds, f.id])}
                    className={`w-full text-left px-2 py-1 font-mono text-[10px] border cursor-pointer transition-all flex items-center gap-1.5
                      ${selected ? 'bg-olive border-olive-lit text-white' : 'bg-bg border-border text-muted hover:border-olive-lit'}`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />{f.name} <span className="text-[9px] ml-auto">{f.area.toFixed(2)} ha</span>
                  </button>
                )
              })}
              <div className="flex gap-1 pt-1">
                <button className="btn-sm btn-active flex-1 text-[10px]" disabled={!selectedParcelleIds.length}
                  onClick={() => { selectedParcelleIds.forEach((id) => handleAssignParcelle(id)); setAssigning(false); setSelectedParcelleIds([]); renderChampOnMap(champ.id) }}>
                  ✓ Assigner ({selectedParcelleIds.length})
                </button>
                <button className="btn-sm btn-danger text-[10px]" onClick={() => { setAssigning(false); setSelectedParcelleIds([]) }}>Annuler</button>
              </div>
            </div>
          )}

          {/* Parcelles */}
          {parcelles.map((f) => (
            <div key={f.id}>
              <FieldCard field={f} isSelected={f.id === selectedFieldId} onSelect={() => selectField(f.id)}
                champId={champ.id} onRemoveFromChamp={() => handleRemoveParcelle(f.id)} />
              {f.id === selectedFieldId && f.points.map((pt, i) => (
                <PointRow key={`${f.id}-${i}`} field={f} point={pt} index={i} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
