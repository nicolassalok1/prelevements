import { useEffect, useState } from 'react'
import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { computeFieldRelief } from '../utils/terrain-auto'
import { triggerAutoReliefIfNeeded } from '../utils/relief-background'
import type { FieldDetailTab, SeedType, IrrigationMethod, AmendmentType, Exposition, BatchStage } from '../types'

const TABS: { key: FieldDetailTab; label: string }[] = [
  { key: 'info', label: 'Infos' },
  { key: 'culture', label: 'Culture' },
  { key: 'watering', label: 'Arrosage' },
  { key: 'amendments', label: 'Engrais' },
  { key: 'other', label: 'Autres' },
  { key: 'soil', label: 'Sol' },
  { key: 'relief', label: 'Relief' },
  { key: 'batches', label: 'Germination' },
]

const IRRIGATION_LABELS: Record<IrrigationMethod, string> = { goutte_a_goutte: 'Goutte à goutte', aspersion: 'Aspersion', gravitaire: 'Gravitaire', manuel: 'Manuel' }
const AMENDMENT_LABELS: Record<AmendmentType, string> = { organique: 'Organique', mineral: 'Minéral', foliaire: 'Foliaire', correcteur: 'Correcteur' }
const EXPO_LABELS: Record<Exposition, string> = { nord: '↑ Nord', 'nord-est': '↗ Nord-Est', est: '→ Est', 'sud-est': '↘ Sud-Est', sud: '↓ Sud', 'sud-ouest': '↙ Sud-Ouest', ouest: '← Ouest', 'nord-ouest': '↖ Nord-Ouest', plat: '⊙ Plat' }

export function FieldDetailPanel() {
  const open = useAppStore((s) => s.fieldDetailOpen)
  const tab = useAppStore((s) => s.fieldDetailTab)
  const setTab = useAppStore((s) => s.setFieldDetailTab)
  const close = useAppStore((s) => s.closeFieldDetail)
  const fieldId = useAppStore((s) => s.selectedFieldId)
  const field = useAppStore((s) => s.fields.find((f) => f.id === fieldId))
  const champs = useAppStore((s) => s.champs)

  if (!open || !field) return null

  const parentChamp = field.champId ? champs.find((c) => c.id === field.champId) : null
  const isSerre = parentChamp?.type === 'serre'
  const visibleTabs = isSerre
    ? TABS.filter((t) => t.key !== 'soil' && t.key !== 'relief')
    : TABS.filter((t) => t.key !== 'batches')

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="w-[480px] max-w-[90vw] h-full bg-panel border-l border-border flex flex-col animate-[slideIn_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="w-3 h-3 rounded-full" style={{ background: field.color }} />
          <h2 className={`font-mono text-sm font-bold flex-1 truncate ${field.archived ? 'text-muted line-through' : 'text-text'}`}>{field.name}</h2>
          {field.archived && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 border border-amber text-amber uppercase tracking-[1px]">Archivée</span>
          )}
          <span className="font-mono text-[10px] text-muted">{field.area.toFixed(2)} ha</span>
          <button onClick={close} className="text-muted hover:text-red bg-transparent border-none text-lg cursor-pointer transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {visibleTabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[.5px] border-b-2 whitespace-nowrap transition-all cursor-pointer bg-transparent border-x-0 border-t-0
                ${tab === t.key ? 'border-olive-lit text-olive-lit' : 'border-transparent text-muted hover:text-text'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' && <InfoTab />}
          {tab === 'culture' && <CultureTab />}
          {tab === 'watering' && <WateringTab />}
          {tab === 'amendments' && <AmendmentsTab />}
          {tab === 'other' && <OtherActivitiesTab />}
          {tab === 'soil' && <SoilTab />}
          {tab === 'relief' && <ReliefTab />}
          {tab === 'batches' && <BatchesTab />}
        </div>
      </div>
    </div>
  )
}

// Helpers
function useField() {
  const fieldId = useAppStore((s) => s.selectedFieldId)!
  return useAppStore((s) => s.fields.find((f) => f.id === fieldId))!
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[9px] text-muted uppercase tracking-[1px] mb-1">{children}</div>
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-muted text-xs py-6">{text}</div>
}

// ═══════════════════════════════════════
//  INFO
// ═══════════════════════════════════════

function InfoTab() {
  const field = useField()
  const updateField = useAppStore((s) => s.updateField)
  const openActivityForm = useAppStore((s) => s.openActivityForm)
  const closeFieldDetail = useAppStore((s) => s.closeFieldDetail)
  const toast = useAppStore((s) => s.toast)
  const champs = useAppStore((s) => s.champs)
  const parentChamp = field.champId ? champs.find((c) => c.id === field.champId) : null
  const isSerre = parentChamp?.type === 'serre'

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(field.name)
  const [notes, setNotes] = useState(field.notes || '')
  const [notesDirty, setNotesDirty] = useState(false)
  // Climate measure form
  const [addingMeasure, setAddingMeasure] = useState(false)
  const [mTemp, setMTemp] = useState('')
  const [mHum, setMHum] = useState('')
  const [mNotes, setMNotes] = useState('')

  // Keep local notes draft in sync when switching between fields
  useEffect(() => {
    setNotes(field.notes || '')
    setNotesDirty(false)
  }, [field.id])

  const saveNotes = () => {
    const trimmed = notes.trim()
    updateField(field.id, { notes: trimmed || undefined })
    setNotesDirty(false)
    toast('✓ Notes enregistrées')
  }

  const handleCreateActivity = () => {
    closeFieldDetail()
    openActivityForm({
      date: new Date().toISOString().slice(0, 10),
      presetFieldId: field.id,
    })
  }

  const handleRename = () => {
    if (!name.trim()) { setName(field.name); setEditing(false); return }
    updateField(field.id, { name: name.trim() })
    if (field.labelMarker) {
      field.labelMarker.setIcon(L.divIcon({
        html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;color:${field.color};text-shadow:0 0 4px #000,0 0 8px #000;white-space:nowrap">${name.trim()}</div>`,
        iconSize: [0, 0], className: '',
      }))
    }
    toast(`✓ Renommé en "${name.trim()}"`)
    setEditing(false)
  }

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

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <Label>Nom du champ</Label>
        {editing ? (
          <div className="flex gap-2">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setName(field.name); setEditing(false) } }}
              autoFocus className="flex-1 font-mono text-xs bg-bg border border-olive-lit text-text py-1.5 px-2 outline-none" />
            <button className="btn-active text-[10px] py-1" onClick={handleRename}>✓</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-text font-bold flex-1">{field.name}</span>
            <button className="btn-sm btn-active" onClick={() => { setName(field.name); setEditing(true) }}>✎ Renommer</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Surface" value={`${field.area.toFixed(2)} ha`} />
        <StatCard label="Périmètre" value={`${Math.round(field.perimeter)} m`} />
        <StatCard label="Points" value={`${field.points.length}`} />
        <StatCard label="Culture" value={field.culture ? (field.culture.seedType === 'beldia' ? 'Beldia' : `Cali — ${field.culture.strain || '?'}`) : '—'} />
      </div>

      {/* Notes */}
      <div>
        <Label>Notes de la parcelle</Label>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesDirty(true) }}
          disabled={!!field.archived}
          placeholder="Observations, état, remarques…"
          rows={4}
          className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-2.5 outline-none focus:border-olive-lit placeholder:text-muted resize-y disabled:opacity-60"
        />
        {notesDirty && !field.archived && (
          <div className="flex gap-2 mt-1.5">
            <button className="btn-sm btn-active flex-1" onClick={saveNotes}>✓ Enregistrer les notes</button>
            <button className="btn-sm btn-danger" onClick={() => { setNotes(field.notes || ''); setNotesDirty(false) }}>Annuler</button>
          </div>
        )}
      </div>

      {/* Quick create activity (champ) OR climate measure (serre) */}
      {!field.archived && !isSerre && (
        <button
          onClick={handleCreateActivity}
          className="btn-cyan w-full text-[11px] py-2"
          title="Créer une nouvelle activité pour cette parcelle">
          + Créer une activité sur cette parcelle
        </button>
      )}

      {/* Climate measures — serre only */}
      {isSerre && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Historique T° / Hygro %</Label>
            {!field.archived && (
              <button onClick={() => setAddingMeasure(!addingMeasure)} className="btn-sm btn-cyan text-[10px]">
                + Mesure
              </button>
            )}
          </div>

          {addingMeasure && (
            <div className="bg-bg border border-cyan/40 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Température (°C)</div>
                  <input type="number" step="0.5" value={mTemp} onChange={(e) => setMTemp(e.target.value)} placeholder="ex: 24.5" autoFocus
                    className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-cyan placeholder:text-muted" />
                </div>
                <div>
                  <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Humidité (%)</div>
                  <input type="number" min={0} max={100} value={mHum} onChange={(e) => setMHum(e.target.value)} placeholder="ex: 72"
                    className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-cyan placeholder:text-muted" />
                </div>
              </div>
              <input type="text" value={mNotes} onChange={(e) => setMNotes(e.target.value)} placeholder="Observation (optionnel)"
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-cyan placeholder:text-muted" />
              <div className="flex gap-2">
                <button className="flex-1 btn-cyan text-[10px]" onClick={() => {
                  if (!mTemp && !mHum) { toast('⚠ Saisissez au moins une valeur', true); return }
                  const measures = field.climateMeasures || []
                  const nextId = measures.reduce((m, x) => Math.max(m, x.id), 0) + 1
                  updateField(field.id, {
                    climateMeasures: [...measures, {
                      id: nextId,
                      date: new Date().toISOString(),
                      temperature: mTemp ? parseFloat(mTemp) : undefined,
                      humidity: mHum ? parseFloat(mHum) : undefined,
                      notes: mNotes.trim() || undefined,
                    }],
                  })
                  toast('✓ Mesure enregistrée')
                  setMTemp(''); setMHum(''); setMNotes(''); setAddingMeasure(false)
                }}>✓ Enregistrer</button>
                <button className="btn-danger text-[10px]" onClick={() => setAddingMeasure(false)}>Annuler</button>
              </div>
            </div>
          )}

          {/* Measures history */}
          {(() => {
            const measures = [...(field.climateMeasures || [])].sort((a, b) => b.date.localeCompare(a.date))
            if (!measures.length) return <div className="text-center text-muted text-xs py-3">Aucune mesure enregistrée.</div>
            return (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {measures.map((m) => (
                  <div key={m.id} className="bg-bg border border-border p-2 flex items-center gap-3">
                    <span className="font-mono text-[9px] text-muted min-w-[90px]">
                      {new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      {' '}
                      {new Date(m.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {m.temperature != null && <span className="font-mono text-xs text-cyan">{m.temperature}°C</span>}
                    {m.humidity != null && <span className="font-mono text-xs text-amber">{m.humidity}%</span>}
                    {m.notes && <span className="font-mono text-[9px] text-muted italic flex-1 truncate">{m.notes}</span>}
                    {!field.archived && (
                      <button onClick={() => {
                        updateField(field.id, { climateMeasures: (field.climateMeasures || []).filter((x) => x.id !== m.id) })
                      }} className="text-muted hover:text-red bg-transparent border-none cursor-pointer text-[10px]">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Summary */}
      {!isSerre && (
        <div className="border border-border p-3">
          <Label>Résumé</Label>
          <div className="font-mono text-xs text-muted space-y-1 mt-1">
            <div>Arrosages : <span className="text-cyan">{waterCount}</span></div>
            <div>Amendements : <span className="text-olive-lit">{amendCount}</span></div>
            <div>Autres activités : <span className="text-amber">{otherCount}</span></div>
            <div>Analyses sol : <span className="text-amber">{soilCount}</span></div>
            {field.relief && <div>Exposition : <span className="text-cyan">{EXPO_LABELS[field.relief.exposition]}</span></div>}
          </div>
        </div>
      )}

      {isSerre && (() => {
        const measures = field.climateMeasures || []
        if (measures.length < 2) return null
        const sorted = [...measures].sort((a, b) => a.date.localeCompare(b.date))
        const lastTemp = sorted.filter((m) => m.temperature != null).slice(-1)[0]
        const lastHum = sorted.filter((m) => m.humidity != null).slice(-1)[0]
        const temps = sorted.filter((m) => m.temperature != null).map((m) => m.temperature!)
        const hums = sorted.filter((m) => m.humidity != null).map((m) => m.humidity!)
        const avg = (arr: number[]) => arr.length ? (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : '—'
        const min = (arr: number[]) => arr.length ? Math.min(...arr).toFixed(1) : '—'
        const max = (arr: number[]) => arr.length ? Math.max(...arr).toFixed(1) : '—'
        return (
          <div className="border border-border p-3">
            <Label>Résumé climat ({measures.length} mesures)</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <div className="text-[8px] text-muted uppercase">Température</div>
                <div className="font-mono text-xs text-cyan">
                  Moy: {avg(temps)}° · Min: {min(temps)}° · Max: {max(temps)}°
                </div>
                {lastTemp && <div className="font-mono text-[9px] text-muted mt-0.5">Dernière : {lastTemp.temperature}°C</div>}
              </div>
              <div>
                <div className="text-[8px] text-muted uppercase">Humidité</div>
                <div className="font-mono text-xs text-amber">
                  Moy: {avg(hums)}% · Min: {min(hums)}% · Max: {max(hums)}%
                </div>
                {lastHum && <div className="font-mono text-[9px] text-muted mt-0.5">Dernière : {lastHum.humidity}%</div>}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg border border-border p-2">
      <div className="text-[9px] text-muted uppercase">{label}</div>
      <div className="font-mono text-sm text-olive-lit mt-0.5">{value}</div>
    </div>
  )
}

// ═══════════════════════════════════════
//  CULTURE
// ═══════════════════════════════════════

function CultureTab() {
  const field = useField()
  const updateField = useAppStore((s) => s.updateField)
  const strains = useAppStore((s) => s.strains)
  const seedType = field.culture?.seedType || 'beldia'
  const strain = field.culture?.strain || ''

  return (
    <div className="space-y-4">
      <div>
        <Label>Type de graine</Label>
        <select value={seedType}
          onChange={(e) => { const t = e.target.value as SeedType; updateField(field.id, { culture: { seedType: t, strain: t === 'beldia' ? '' : strain } }) }}
          className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-3 outline-none focus:border-olive-lit">
          <option value="beldia">Beldia</option>
          <option value="cali">Cali</option>
        </select>
      </div>
      {seedType === 'cali' && (
        <div>
          <Label>Strain</Label>
          <select value={strain}
            onChange={(e) => updateField(field.id, { culture: { seedType: 'cali', strain: e.target.value } })}
            className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-3 outline-none focus:border-olive-lit">
            <option value="">— Choisir —</option>
            {strains.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {!strains.length && <p className="text-[10px] text-muted mt-1">Ajoutez des strains dans le Dashboard → Cultures</p>}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
//  ARROSAGE
// ═══════════════════════════════════════

function WateringTab() {
  const field = useField()
  const store = useAppStore()
  const isArchived = !!field.archived
  const legacyEntries = store.wateringLog.filter((w) => w.fieldId === field.id).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4">
      <QuickAddActivityButton fieldId={field.id} type="watering" disabled={isArchived} />
      <ActivityList fieldId={field.id} type="watering" showEmpty />
      {legacyEntries.length > 0 && (
        <div>
          <Label>Ancien historique ({legacyEntries.length})</Label>
          <div className={`space-y-1 mt-1 ${isArchived ? 'opacity-60' : ''}`}>
            {legacyEntries.map((w) => (
              <div key={w.id} className="border border-border/60 p-2 hover:bg-olive/5 transition-colors">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] text-muted">{w.date}</span>
                  <span className="font-mono text-[10px] bg-panel border border-border px-1.5 py-px text-muted">{IRRIGATION_LABELS[w.method]}</span>
                  <span className="font-mono text-xs text-cyan">{w.durationMin} min</span>
                  {w.volumeL && <span className="font-mono text-xs text-muted">{w.volumeL} L</span>}
                  {!isArchived && (
                    <button onClick={() => store.removeWatering(w.id)} className="ml-auto text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs">✕</button>
                  )}
                </div>
                {w.notes && <div className="font-mono text-[10px] text-muted mt-1 border-t border-border/30 pt-1 italic">{w.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
//  AMENDEMENTS
// ═══════════════════════════════════════

function AmendmentsTab() {
  const field = useField()
  const store = useAppStore()
  const isArchived = !!field.archived
  const legacyEntries = store.amendmentLog.filter((a) => a.fieldId === field.id).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4">
      <QuickAddActivityButton fieldId={field.id} type="amendment" disabled={isArchived} />
      <ActivityList fieldId={field.id} type="amendment" showEmpty />
      {legacyEntries.length > 0 && (
        <div>
          <Label>Ancien historique ({legacyEntries.length})</Label>
          <div className={`space-y-1 mt-1 ${isArchived ? 'opacity-60' : ''}`}>
            {legacyEntries.map((a) => (
              <div key={a.id} className="border border-border/60 p-2 hover:bg-olive/5 transition-colors">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] text-muted">{a.date}</span>
                  <span className="font-mono text-[10px] bg-panel border border-border px-1.5 py-px text-muted">{AMENDMENT_LABELS[a.type]}</span>
                  <span className="font-mono text-xs text-amber">{a.product}</span>
                  <span className="font-mono text-xs text-olive-lit">{a.quantityKg} kg</span>
                  {!isArchived && (
                    <button onClick={() => store.removeAmendment(a.id)} className="ml-auto text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs">✕</button>
                  )}
                </div>
                {a.notes && <div className="font-mono text-[10px] text-muted mt-1 border-t border-border/30 pt-1 italic">{a.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type ListableActivityType = 'watering' | 'amendment' | 'other'

function QuickAddActivityButton({ fieldId, type, disabled }: { fieldId: number; type: ListableActivityType; disabled?: boolean }) {
  const openActivityForm = useAppStore((s) => s.openActivityForm)
  const label = type === 'watering' ? 'arrosage'
    : type === 'amendment' ? 'engrais'
    : 'activité'
  return (
    <button
      disabled={disabled}
      onClick={() => openActivityForm({ date: new Date().toISOString().slice(0, 10), presetType: type, presetFieldId: fieldId })}
      className="btn-active w-full text-[11px] py-2 disabled:opacity-50 disabled:cursor-not-allowed">
      + Nouvelle {label} (via agenda)
    </button>
  )
}

// ═══════════════════════════════════════
//  AUTRES ACTIVITÉS
// ═══════════════════════════════════════

function OtherActivitiesTab() {
  const field = useField()
  const isArchived = !!field.archived
  return (
    <div className="space-y-4">
      <QuickAddActivityButton fieldId={field.id} type="other" disabled={isArchived} />
      <ActivityList fieldId={field.id} type="other" showEmpty />
    </div>
  )
}

function ActivityList({ fieldId, type, showEmpty }: { fieldId: number; type: ListableActivityType; showEmpty?: boolean }) {
  const allActivities = useAppStore((s) => s.activities)
  const removeActivity = useAppStore((s) => s.removeActivity)
  const openActivityForm = useAppStore((s) => s.openActivityForm)
  const field = useField()
  const sorted = allActivities
    .filter((a) => a.type === type && a.fieldIds.includes(fieldId))
    .sort((a, b) => b.date.localeCompare(a.date))
  const isArchived = !!field.archived

  if (!sorted.length) {
    if (showEmpty) return <Empty text="Aucune activité pour ce champ." />
    return null
  }

  const typeLabel = type === 'watering' ? 'arrosages'
    : type === 'amendment' ? 'engrais'
    : 'activités'

  return (
    <div>
      <Label>Historique — {typeLabel} ({sorted.length})</Label>
      <div className={`space-y-1 mt-1 ${isArchived ? 'opacity-60' : ''}`}>
        {sorted.map((a) => (
          <div key={a.id} className="border border-border p-2 hover:bg-olive/5 transition-colors">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] text-muted">{a.date}</span>
              {a.type === 'watering' && a.watering && (
                <>
                  <span className="font-mono text-[10px] bg-panel border border-border px-1.5 py-px text-muted">{IRRIGATION_LABELS[a.watering.method]}</span>
                  <span className="font-mono text-xs text-cyan">{a.watering.durationMin} min</span>
                  {a.watering.flowRatePerHour != null && <span className="font-mono text-xs text-muted">{a.watering.flowRatePerHour} L/h</span>}
                  {a.watering.flowRatePerHour == null && a.watering.volumeL != null && <span className="font-mono text-xs text-muted">{a.watering.volumeL} L</span>}
                </>
              )}
              {a.type === 'amendment' && a.amendment && (
                <>
                  <span className="font-mono text-[10px] bg-panel border border-border px-1.5 py-px text-muted">{a.amendment.customType || AMENDMENT_LABELS[a.amendment.type]}</span>
                  <span className="font-mono text-xs text-amber">{a.amendment.product}</span>
                  <span className="font-mono text-xs text-olive-lit">{a.amendment.quantityKg} kg</span>
                </>
              )}
              {a.type === 'other' && a.other && (
                <span className="font-mono text-xs text-amber font-bold">{a.other.title}</span>
              )}
              {a.type !== 'watering' && (
                <span className="font-mono text-[10px] text-muted">· {a.workerCount} ouv.</span>
              )}
              {!isArchived && (
                <>
                  <button onClick={() => openActivityForm({ date: a.date, editId: a.id })} className="ml-auto text-muted hover:text-olive-lit bg-transparent border-none cursor-pointer text-[11px]" title="Modifier">✎</button>
                  <button onClick={() => { if (confirm('Supprimer cette activité ?')) removeActivity(a.id) }} className="text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs" title="Supprimer">✕</button>
                </>
              )}
            </div>
            {a.notes && <div className="font-mono text-[10px] text-muted mt-1 border-t border-border/30 pt-1 italic">{a.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
//  SOL
// ═══════════════════════════════════════

function SoilTab() {
  const field = useField()
  const store = useAppStore()
  const entries = store.soilAnalyses.filter((s) => s.fieldId === field.id).sort((a, b) => b.date.localeCompare(a.date))

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [ph, setPh] = useState(7.0); const [ec, setEc] = useState(0); const [n, setN] = useState(0); const [p, setP] = useState(0); const [k, setK] = useState(0)
  const [om, setOm] = useState(0); const [texture, setTexture] = useState(''); const [notes, setNotes] = useState('')

  const handleAdd = () => {
    store.addSoilAnalysis({
      date, fieldId: field.id, ph,
      ec: ec > 0 ? ec : undefined,
      nitrogen: n, phosphorus: p, potassium: k, organicMatter: om,
      texture: texture || undefined,
      notes: notes || undefined,
    })
    store.toast('✓ Analyse enregistrée')
    setTexture(''); setNotes('')
  }

  const phColor = (v: number) => v < 6 ? 'text-red' : v > 8 ? 'text-red' : v >= 6.5 && v <= 7.5 ? 'text-olive-lit' : 'text-amber'
  // EC salinity thresholds (mS/cm) — FAO irrigation water quality:
  //   < 0.7  : non-saline / safe
  //   0.7-3  : slight to moderate (watch sensitive crops)
  //   > 3    : severe (most crops impacted)
  const ecColor = (v: number) => v <= 0 ? 'text-muted' : v < 0.7 ? 'text-olive-lit' : v <= 3 ? 'text-amber' : 'text-red'

  return (
    <div className="space-y-4">
      <div className="bg-bg border border-border p-3 space-y-2">
        <Label>Nouvelle analyse</Label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit mb-1" />
        <div className="grid grid-cols-6 gap-1.5">
          {([
            ['pH', ph, setPh, 0, 14, 0.1],
            ['EC', ec, setEc, 0, 20, 0.1],
            ['N', n, setN, 0, 999, 1],
            ['P', p, setP, 0, 999, 1],
            ['K', k, setK, 0, 999, 1],
            ['MO%', om, setOm, 0, 100, 0.1],
          ] as const).map(([lbl, val, setter, min, max, step]) => (
            <div key={lbl}>
              <div className="text-[8px] text-muted uppercase text-center mb-0.5">{lbl}</div>
              <input type="number" value={val} onChange={(e) => setter(parseFloat(e.target.value) || 0)}
                min={min} max={max} step={step}
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-olive-lit text-center" />
            </div>
          ))}
        </div>
        <div className="text-[8px] text-muted">EC en mS/cm (conductivité électrique — indicateur de salinité)</div>
        <div className="flex gap-2">
          <input type="text" value={texture} onChange={(e) => setTexture(e.target.value)} placeholder="Texture"
            className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes"
            className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
          <button className="btn-active text-[10px]" onClick={handleAdd}>+</button>
        </div>
      </div>

      <div>
        <Label>Analyses ({entries.length})</Label>
        {entries.length ? (
          <div className="space-y-2 mt-1">
            {entries.map((s) => (
              <div key={s.id} className="border border-border p-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] text-muted">{s.date}</span>
                  {s.texture && <span className="font-mono text-[10px] bg-panel border border-border px-1.5 py-px text-muted">{s.texture}</span>}
                  <button onClick={() => store.removeSoilAnalysis(s.id)} className="ml-auto text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs">✕</button>
                </div>
                <div className="grid grid-cols-6 gap-1 text-center">
                  <div><div className="text-[8px] text-muted">pH</div><div className={`font-mono text-base font-bold ${phColor(s.ph)}`}>{s.ph}</div></div>
                  <div>
                    <div className="text-[8px] text-muted">EC</div>
                    <div className={`font-mono text-base ${ecColor(s.ec ?? 0)}`}>{s.ec != null ? s.ec : '—'}</div>
                  </div>
                  <div><div className="text-[8px] text-muted">N</div><div className="font-mono text-base text-olive-lit">{s.nitrogen}</div></div>
                  <div><div className="text-[8px] text-muted">P</div><div className="font-mono text-base text-amber">{s.phosphorus}</div></div>
                  <div><div className="text-[8px] text-muted">K</div><div className="font-mono text-base text-cyan">{s.potassium}</div></div>
                  <div><div className="text-[8px] text-muted">MO%</div><div className="font-mono text-base text-text">{s.organicMatter}</div></div>
                </div>
                {s.notes && <div className="font-mono text-[10px] text-muted mt-2 border-t border-border/30 pt-1 italic">{s.notes}</div>}
              </div>
            ))}
          </div>
        ) : <Empty text="Aucune analyse pour ce champ." />}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
//  RELIEF
// ═══════════════════════════════════════

function ReliefTab() {
  const field = useField()
  const updateField = useAppStore((s) => s.updateField)
  const toast = useAppStore((s) => s.toast)
  const r = field.relief || { exposition: 'plat' as Exposition }
  const [computing, setComputing] = useState(false)

  // Auto-trigger relief compute the first time the user opens this tab on a
  // zone that has no relief yet. Also handles the spinner state so the user
  // sees that something is happening during the 3-5 s API round-trip.
  // The trigger helper skips silently if relief is already set or if the
  // user has manually locked it, so this effect is a cheap no-op otherwise.
  useEffect(() => {
    if (field.relief !== undefined) return
    setComputing(true)
    triggerAutoReliefIfNeeded(field.id).finally(() => setComputing(false))
    // Depend on the id only — not on `field.relief` — so that re-renders
    // triggered by the compute result itself don't re-fire the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id])

  // Any manual edit clears the autoComputed flag → locks the relief against
  // future background recomputations (e.g. after a polygon edit). The
  // updateField action persists to localStorage on every call.
  const update = (patch: Partial<typeof r>) =>
    updateField(field.id, { relief: { ...r, ...patch, autoComputed: false } })

  const handleAutoCompute = async () => {
    setComputing(true)
    try {
      const { relief, warnings, sampleCount } = await computeFieldRelief(field)
      updateField(field.id, { relief })
      if (warnings.length > 0) {
        toast(`⚠ Relief partiellement calculé (${sampleCount} pts) — ${warnings[0]}`, true)
      } else {
        toast(`✓ Relief calculé (${sampleCount} pts DEM)`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      toast(`⚠ ${msg}`, true)
    } finally {
      setComputing(false)
    }
  }

  const isAuto = field.relief?.autoComputed === true
  const hasRelief = field.relief !== undefined

  return (
    <div className="space-y-4">
      {/* Auto-compute button + status badge */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAutoCompute}
          disabled={computing}
          className="btn-cyan flex-1 text-[11px] py-2 disabled:opacity-50 disabled:cursor-wait"
          title="Calcule altitude, pente, exposition et ensoleillement à partir du polygone (Open-Meteo, gratuit)"
        >
          {computing ? '⏳ Calcul…' : hasRelief ? '✨ Recalculer' : '✨ Calculer automatiquement'}
        </button>
        {hasRelief && (
          <span
            className={`font-mono text-[9px] px-2 py-1 border ${isAuto ? 'text-cyan border-cyan/60' : 'text-amber border-amber/60'}`}
            title={isAuto ? 'Valeurs calculées automatiquement — seront mises à jour si vous modifiez le contour' : 'Valeurs modifiées manuellement — ne seront plus recalculées automatiquement'}
          >
            {isAuto ? 'AUTO' : 'MANUEL'}
          </span>
        )}
      </div>

      {/* Visible loading banner while the background/manual compute is running.
          The form stays interactive so the user can still edit manually, but
          the banner makes it clear that a background fetch is in flight. */}
      {computing && (
        <div className="bg-cyan/10 border border-cyan/40 p-2.5 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan animate-pulse" />
          <span className="font-mono text-[10px] text-cyan">
            Calcul en cours via Open-Meteo (altitude + ensoleillement)…
          </span>
        </div>
      )}

      <div>
        <Label>Exposition</Label>
        <select value={r.exposition} onChange={(e) => update({ exposition: e.target.value as Exposition })}
          className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-3 outline-none focus:border-olive-lit">
          {Object.entries(EXPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <Label>Ensoleillement (h/jour)</Label>
        <input type="number" value={r.sunlightHours ?? ''} placeholder="—" min={0} max={16} step={0.1}
          onChange={(e) => update({ sunlightHours: e.target.value ? parseFloat(e.target.value) : undefined })}
          className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-3 outline-none focus:border-olive-lit placeholder:text-muted" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Alt. min (m)</Label>
          <input type="number" value={r.altitudeMin ?? ''} placeholder="—"
            onChange={(e) => update({ altitudeMin: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-3 outline-none focus:border-olive-lit placeholder:text-muted" />
        </div>
        <div>
          <Label>Alt. max (m)</Label>
          <input type="number" value={r.altitudeMax ?? ''} placeholder="—"
            onChange={(e) => update({ altitudeMax: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-3 outline-none focus:border-olive-lit placeholder:text-muted" />
        </div>
        <div>
          <Label>Pente (%)</Label>
          <input type="number" value={r.slope ?? ''} placeholder="—" min={0} max={100} step={0.1}
            onChange={(e) => update({ slope: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-3 outline-none focus:border-olive-lit placeholder:text-muted" />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
//  BATCHES + PLAQUES (Germination) — Serre only
// ═══════════════════════════════════════

const STAGE_LABELS: Record<BatchStage, string> = { semis: 'Semis', germe: 'Germé', pousse: 'Pousse', pret: 'Prêt' }
const STAGE_COLOR: Record<BatchStage, string> = { semis: 'text-muted border-border', germe: 'text-cyan border-cyan/40', pousse: 'text-amber border-amber/40', pret: 'text-olive-lit border-olive-lit/40' }
const STAGE_BG: Record<BatchStage, string> = { semis: 'bg-border/40', germe: 'bg-cyan/20', pousse: 'bg-amber/20', pret: 'bg-olive/20' }

const PLAQUE_PRESETS = [
  { label: '24 (4×6)', rows: 4, cols: 6 },
  { label: '50 (5×10)', rows: 5, cols: 10 },
  { label: '72 (6×12)', rows: 6, cols: 12 },
  { label: '128 (8×16)', rows: 8, cols: 16 },
]

function BatchesTab() {
  const fieldId = useAppStore((s) => s.selectedFieldId)!
  const field = useAppStore((s) => s.fields.find((f) => f.id === fieldId))!
  const updateField = useAppStore((s) => s.updateField)
  const toast = useAppStore((s) => s.toast)
  const allChamps = useAppStore((s) => s.champs)
  const strains = useAppStore((s) => s.strains)
  const batches = field.batches || []
  const plaques = field.plaques || []
  const archived = !!field.archived
  const targetChamps = allChamps.filter((c) => c.type === 'champ')

  // Batch form — step wizard
  const [adding, setAdding] = useState(false)
  const [step, setStep] = useState(1)
  const [bName, setBName] = useState('')
  const [bStrain, setBStrain] = useState('')
  const [bDate, setBDate] = useState(new Date().toISOString().slice(0, 10))
  const [bSeeds, setBSeeds] = useState(50)
  const [bWeeks, setBWeeks] = useState(3)
  const [bTargetTemp, setBTargetTemp] = useState('')
  const [bTargetHum, setBTargetHum] = useState('')
  const [bTarget, setBTarget] = useState<number | ''>('')
  // Step 2: plaques
  const [bPlaquePreset, setBPlaquePreset] = useState(2) // index in PLAQUE_PRESETS
  const [bPlaqueCount, setBPlaqueCount] = useState(1)

  // Plaque add for existing batch
  const [addingPlaqueFor, setAddingPlaqueFor] = useState<number | null>(null)

  const nextBatchId = batches.reduce((m, b) => Math.max(m, b.id), 0) + 1
  const nextPlaqueId = plaques.reduce((m, p) => Math.max(m, p.id), 0) + 1

  const selectedPreset = PLAQUE_PRESETS[bPlaquePreset]
  const alveolesPerPlaque = selectedPreset.rows * selectedPreset.cols
  const totalAlveoles = alveolesPerPlaque * bPlaqueCount

  const handleAddBatch = () => {
    if (!bName.trim()) { toast('⚠ Nom du batch requis', true); return }
    if (!bStrain.trim()) { toast('⚠ Strain requise', true); return }
    const batch: typeof batches[0] = {
      id: nextBatchId, name: bName.trim(), strain: bStrain.trim(),
      plantingDate: bDate, seedCount: bSeeds, stage: 'semis',
      weeksToTransplant: bWeeks,
      targetTemp: bTargetTemp ? parseFloat(bTargetTemp) : undefined,
      targetHumidity: bTargetHum ? parseFloat(bTargetHum) : undefined,
      targetChampId: bTarget ? Number(bTarget) : undefined,
    }
    // Auto-create plaques — distribute seeds across plaques
    const newPlaques: typeof plaques = []
    let remaining = bSeeds
    for (let i = 0; i < bPlaqueCount; i++) {
      const filled = Math.min(remaining, alveolesPerPlaque)
      newPlaques.push({
        id: nextPlaqueId + i, name: `${bName.trim()} — Plaque ${i + 1}`,
        rows: selectedPreset.rows, cols: selectedPreset.cols,
        filledCount: Math.max(0, filled),
        batchId: nextBatchId,
      })
      remaining -= filled
    }
    updateField(fieldId, { batches: [...batches, batch], plaques: [...plaques, ...newPlaques] })

    // ── Auto-create agenda activities for this batch ──
    const store = useAppStore.getState()
    const batchLabel = `${bName.trim()} (${bStrain.trim()})`
    const targetName = bTarget ? allChamps.find((c) => c.id === Number(bTarget))?.name : null

    // 1. Semis day
    store.addActivity({
      date: bDate, type: 'other', fieldIds: [], workerCount: 0,
      notes: `${bSeeds} graines · ${bPlaqueCount} plaque(s) ${bPlaqueRows}×${bPlaqueCols}`,
      other: { title: `🌱 Semis — ${batchLabel}` },
    })

    // 2. Mid-point check (50% of weeks)
    const midDate = new Date(bDate)
    midDate.setDate(midDate.getDate() + Math.round(bWeeks * 7 / 2))
    store.addActivity({
      date: midDate.toISOString().slice(0, 10), type: 'other', fieldIds: [], workerCount: 0,
      notes: `Vérifier germination, temp, humidité. Objectif : 2-3 noeuds.`,
      other: { title: `🔍 Contrôle germination — ${batchLabel}` },
    })

    // 3. Transplant day
    const transplantDate = new Date(bDate)
    transplantDate.setDate(transplantDate.getDate() + bWeeks * 7)
    store.addActivity({
      date: transplantDate.toISOString().slice(0, 10), type: 'other', fieldIds: [], workerCount: 0,
      notes: targetName ? `Destination : ${targetName}` : 'Champ de destination à définir',
      other: { title: `🚜 TRANSPLANTATION — ${batchLabel}${targetName ? ` → ${targetName}` : ''}` },
    })

    toast(`✓ Batch "${bName.trim()}" + ${bPlaqueCount} plaque(s) créé · 3 jalons ajoutés à l'agenda`)
    setBName(''); setBStrain(''); setBSeeds(50); setBWeeks(3); setBTargetTemp(''); setBTargetHum(''); setBTarget(''); setBPlaqueCount(1); setStep(1); setAdding(false)
  }

  const updateBatch = (id: number, patch: Partial<typeof batches[0]>) => {
    updateField(fieldId, { batches: batches.map((b) => b.id === id ? { ...b, ...patch } : b) })
  }

  const removeBatch = (id: number) => {
    if (!confirm('Supprimer ce batch et ses plaques ?')) return
    updateField(fieldId, { batches: batches.filter((b) => b.id !== id), plaques: plaques.filter((p) => p.batchId !== id) })
    toast('Batch supprimé')
  }

  const handleAddPlaque = (batchId: number) => {
    if (!pName.trim()) { toast('⚠ Nom requis', true); return }
    const plaque: typeof plaques[0] = { id: nextPlaqueId, name: pName.trim(), rows: pRows, cols: pCols, filledCount: pRows * pCols, batchId }
    updateField(fieldId, { plaques: [...plaques, plaque] })
    toast(`✓ Plaque créée`)
    setPName(''); setAddingPlaqueFor(null)
  }

  const updatePlaque = (id: number, patch: Partial<typeof plaques[0]>) => {
    updateField(fieldId, { plaques: plaques.map((p) => p.id === id ? { ...p, ...patch } : p) })
  }

  const removePlaque = (id: number) => {
    if (!confirm('Supprimer cette plaque ?')) return
    updateField(fieldId, { plaques: plaques.filter((p) => p.id !== id) })
  }

  // Transplant date computation
  const transplantDate = (b: typeof batches[0]) => {
    const d = new Date(b.plantingDate)
    d.setDate(d.getDate() + b.weeksToTransplant * 7)
    return d
  }
  const daysLeft = (b: typeof batches[0]) => {
    const diff = transplantDate(b).getTime() - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm text-olive-lit tracking-[2px] uppercase">Germination</h3>
        {!archived && <button onClick={() => setAdding(!adding)} className="btn-sm btn-active text-[10px]">+ Nouveau batch</button>}
      </div>

      {/* ── New batch form — 2-step wizard ── */}
      {adding && (
        <div className="bg-bg border border-olive-lit/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="font-mono text-[9px] text-olive-lit uppercase tracking-[1px] flex-1">
              Nouveau batch — Étape {step}/2
            </div>
            <div className="flex gap-1">
              <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-olive-lit' : 'bg-border'}`} />
              <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-olive-lit' : 'bg-border'}`} />
            </div>
          </div>

          {step === 1 && (<>
            {/* Step 1: Batch info */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Nom du batch *</div>
                <input type="text" value={bName} onChange={(e) => setBName(e.target.value)} placeholder="ex: Lot A"
                  className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" autoFocus />
              </div>
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Strain / Variété *</div>
                {strains.length > 0 ? (
                  <select value={bStrain} onChange={(e) => setBStrain(e.target.value)}
                    className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit">
                    <option value="">— Choisir —</option>
                    {strains.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value="__custom">Saisie libre...</option>
                  </select>
                ) : (
                  <input type="text" value={bStrain} onChange={(e) => setBStrain(e.target.value)} placeholder="ex: OG Kush"
                    className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
                )}
              </div>
            </div>
            {bStrain === '__custom' && (
              <input type="text" onChange={(e) => setBStrain(e.target.value)} placeholder="Nom de la strain" autoFocus
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
            )}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Date de semis</div>
                <input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)}
                  className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
              </div>
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Nb. graines</div>
                <input type="number" min={1} value={bSeeds} onChange={(e) => setBSeeds(parseInt(e.target.value) || 1)}
                  className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
              </div>
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Sem. avant transfert</div>
                <input type="number" min={1} max={52} value={bWeeks} onChange={(e) => setBWeeks(parseInt(e.target.value) || 3)}
                  className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">T° cible (°C)</div>
                <input type="number" step="0.5" value={bTargetTemp} onChange={(e) => setBTargetTemp(e.target.value)} placeholder="ex: 25"
                  className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
              </div>
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Humidité cible (%)</div>
                <input type="number" min={0} max={100} value={bTargetHum} onChange={(e) => setBTargetHum(e.target.value)} placeholder="ex: 70"
                  className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
              </div>
            </div>
            {targetChamps.length > 0 && (
              <div>
                <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Champ de destination (optionnel)</div>
                <select value={bTarget} onChange={(e) => setBTarget(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit">
                  <option value="">— À définir plus tard —</option>
                  {targetChamps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button className="btn-danger text-[10px]" onClick={() => { setAdding(false); setStep(1) }}>Annuler</button>
              <button className="flex-1 btn-active text-[10px]" onClick={() => {
                if (!bName.trim()) { toast('⚠ Nom du batch requis', true); return }
                if (!bStrain.trim() || bStrain === '__custom') { toast('⚠ Strain requise', true); return }
                setStep(2)
              }}>Suivant → Plaques</button>
            </div>
          </>)}

          {step === 2 && (<>
            {/* Step 2: Plaques */}
            <div className="font-mono text-[10px] text-text">
              <span className="text-amber">{bName}</span> · {bStrain} · {bSeeds} graines
            </div>
            <div className="font-mono text-[8px] text-muted uppercase mb-1">Choisissez la taille des plaques</div>
            <div className="flex flex-wrap gap-1.5">
              {PLAQUE_PRESETS.map((pr, i) => (
                <button key={pr.label} onClick={() => setBPlaquePreset(i)}
                  className={`font-mono text-[10px] px-3 py-1.5 border cursor-pointer transition-all ${bPlaquePreset === i ? 'bg-olive border-olive-lit text-white' : 'bg-panel border-border text-muted hover:text-text'}`}>
                  {pr.label}
                </button>
              ))}
            </div>
            <div>
              <div className="font-mono text-[8px] text-muted uppercase mb-0.5">Combien de plaques ?</div>
              <input type="number" min={1} max={200} value={bPlaqueCount} onChange={(e) => setBPlaqueCount(parseInt(e.target.value) || 1)}
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
            </div>
            <div className="bg-panel border border-border p-2.5 space-y-1">
              <div className="font-mono text-[10px] text-olive-lit">Résumé :</div>
              <div className="font-mono text-[10px] text-text">{bPlaqueCount} plaque{bPlaqueCount > 1 ? 's' : ''} de {alveolesPerPlaque} alvéoles ({selectedPreset.rows}×{selectedPreset.cols})</div>
              <div className="font-mono text-[10px] text-text">= {totalAlveoles} alvéoles au total</div>
              <div className={`font-mono text-[10px] ${totalAlveoles >= bSeeds ? 'text-olive-lit' : 'text-amber'}`}>
                {totalAlveoles >= bSeeds
                  ? `✓ Suffisant pour ${bSeeds} graines (${totalAlveoles - bSeeds} vide${totalAlveoles - bSeeds > 1 ? 's' : ''})`
                  : `⚠ ${bSeeds - totalAlveoles} graine${bSeeds - totalAlveoles > 1 ? 's' : ''} sans place — ajoutez des plaques`}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-sm text-[10px] border border-border text-muted hover:text-text bg-transparent cursor-pointer" onClick={() => setStep(1)}>← Retour</button>
              <button className="flex-1 btn-active text-[10px]" onClick={handleAddBatch}>✓ Créer le batch + {bPlaqueCount} plaque{bPlaqueCount > 1 ? 's' : ''}</button>
            </div>
          </>)}
        </div>
      )}

      {batches.length === 0 && !adding && (
        <div className="text-center text-muted text-xs py-6">Aucun batch. Créez-en un pour démarrer la germination.</div>
      )}

      {/* ── Batch cards ── */}
      {batches.map((b) => {
        const bPlaques = plaques.filter((p) => p.batchId === b.id)
        const totalAlveoles = bPlaques.reduce((s, p) => s + p.rows * p.cols, 0)
        const totalFilled = bPlaques.reduce((s, p) => s + p.filledCount, 0)
        const fillPct = totalAlveoles > 0 ? Math.round((totalFilled / totalAlveoles) * 100) : 0
        const dl = daysLeft(b)
        const targetChamp = b.targetChampId ? allChamps.find((c) => c.id === b.targetChampId) : null

        return (
          <div key={b.id} className="border border-border">
            {/* Header */}
            <div className="bg-bg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text font-bold flex-1 truncate">{b.name}</span>
                <span className={`font-mono text-[9px] px-1.5 py-px border ${STAGE_COLOR[b.stage]}`}>{STAGE_LABELS[b.stage]}</span>
                {!archived && (
                  <button onClick={() => removeBatch(b.id)} className="text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs">✕</button>
                )}
              </div>

              <div className="font-mono text-[10px] text-amber">{b.strain}</div>

              <div className="grid grid-cols-5 gap-1 text-center">
                <div><div className="text-[7px] text-muted uppercase">Graines</div><div className="font-mono text-sm text-olive-lit">{b.seedCount}</div></div>
                <div><div className="text-[7px] text-muted uppercase">Semis</div><div className="font-mono text-[9px] text-text">{new Date(b.plantingDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</div></div>
                <div><div className="text-[7px] text-muted uppercase">T° cible</div><div className="font-mono text-sm text-cyan">{b.targetTemp != null ? `${b.targetTemp}°` : '—'}</div></div>
                <div><div className="text-[7px] text-muted uppercase">H% cible</div><div className="font-mono text-sm text-cyan">{b.targetHumidity != null ? `${b.targetHumidity}%` : '—'}</div></div>
                <div>
                  <div className="text-[7px] text-muted uppercase">Transfert</div>
                  <div className={`font-mono text-sm ${dl <= 0 ? 'text-red font-bold' : dl <= 7 ? 'text-amber' : 'text-muted'}`}>
                    {dl <= 0 ? 'Prêt !' : `${dl}j`}
                  </div>
                </div>
              </div>

              {targetChamp && (
                <div className="font-mono text-[9px] text-muted">
                  Destination : <span className="text-olive-lit">{targetChamp.name}</span>
                </div>
              )}

              {/* Editable stage */}
              {!archived && (
                <select value={b.stage} onChange={(e) => updateBatch(b.id, { stage: e.target.value as BatchStage })}
                  className="w-full font-mono text-[9px] bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-olive-lit">
                  <option value="semis">Semis</option><option value="germe">Germé</option>
                  <option value="pousse">Pousse</option><option value="pret">Prêt</option>
                </select>
              )}
              {!archived && !b.targetChampId && targetChamps.length > 0 && (
                <select value="" onChange={(e) => updateBatch(b.id, { targetChampId: parseInt(e.target.value) || undefined })}
                  className="w-full font-mono text-[9px] bg-panel border border-amber/40 text-amber py-1 px-1.5 outline-none focus:border-olive-lit">
                  <option value="">+ Définir le champ de destination</option>
                  {targetChamps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            {/* ── Plaques overview ── */}
            <div className="border-t border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="font-mono text-[8px] text-muted uppercase tracking-[1px] flex-1">
                  Plaques ({bPlaques.length}) · {totalFilled}/{totalAlveoles} alvéoles ({fillPct}%)
                </div>
                {!archived && (
                  <button onClick={() => { setAddingPlaqueFor(b.id); setPName(`${b.name} — P${bPlaques.length + 1}`); setPRows(bPlaques[0]?.rows || 6); setPCols(bPlaques[0]?.cols || 12) }}
                    className="font-mono text-[8px] px-2 py-0.5 border border-olive-lit/40 text-olive-lit bg-transparent cursor-pointer hover:bg-olive/20">+ Plaque</button>
                )}
              </div>

              {/* Progress bar */}
              {totalAlveoles > 0 && (
                <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                  <div className={`h-full transition-all rounded-full ${STAGE_BG[b.stage]}`} style={{ width: `${fillPct}%` }} />
                </div>
              )}

              {/* Plaque grid — compact cards */}
              {bPlaques.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {bPlaques.map((p) => {
                    const total = p.rows * p.cols
                    const pPct = total > 0 ? Math.round((p.filledCount / total) * 100) : 0
                    return (
                      <div key={p.id} className="bg-panel border border-border/60 p-2 space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[9px] text-text font-semibold flex-1 truncate">{p.name}</span>
                          {!archived && (
                            <button onClick={() => removePlaque(p.id)} className="text-muted hover:text-red bg-transparent border-none cursor-pointer text-[9px]">✕</button>
                          )}
                        </div>
                        <div className="font-mono text-[8px] text-muted">{p.rows}×{p.cols} · {p.filledCount}/{total}</div>
                        <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
                          <div className="h-full bg-olive-lit rounded-full transition-all" style={{ width: `${pPct}%` }} />
                        </div>
                        {!archived && (
                          <input type="number" min={0} max={total} value={p.filledCount}
                            onChange={(e) => updatePlaque(p.id, { filledCount: Math.min(total, Math.max(0, parseInt(e.target.value) || 0)) })}
                            className="w-full font-mono text-[9px] bg-bg border border-border text-text py-0.5 px-1.5 outline-none focus:border-olive-lit text-center" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add plaque form */}
              {addingPlaqueFor === b.id && (
                <div className="bg-panel border border-border p-2 space-y-1.5">
                  <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nom"
                    className="w-full font-mono text-[10px] bg-bg border border-border text-text py-1 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
                  <div className="flex flex-wrap gap-1">
                    {PLAQUE_PRESETS.map((pr) => (
                      <button key={pr.label} onClick={() => { setPRows(pr.rows); setPCols(pr.cols) }}
                        className={`font-mono text-[8px] px-1.5 py-0.5 border cursor-pointer transition-all ${pRows === pr.rows && pCols === pr.cols ? 'bg-olive border-olive-lit text-white' : 'bg-bg border-border text-muted'}`}>
                        {pr.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button className="flex-1 btn-active text-[9px]" onClick={() => handleAddPlaque(b.id)}>✓ Créer</button>
                    <button className="btn-danger text-[9px]" onClick={() => setAddingPlaqueFor(null)}>✕</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
