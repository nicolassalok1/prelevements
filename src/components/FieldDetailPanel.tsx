import { useEffect, useState } from 'react'
import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { computeFieldRelief } from '../utils/terrain-auto'
import { triggerAutoReliefIfNeeded } from '../utils/relief-background'
import { useField, Label, Empty, StatCard, IRRIGATION_LABELS, AMENDMENT_LABELS, EXPO_LABELS } from './fieldDetail/shared'
import { QuickAddActivityButton, ActivityList } from './fieldDetail/activityList'
import { BatchesTab } from './fieldDetail/BatchesTab'
import { OtherActivitiesTab } from './fieldDetail/OtherActivitiesTab'
import type { FieldDetailTab, SeedType, Exposition } from '../types'

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
      <div className="w-full md:w-[480px] md:max-w-[90vw] h-full bg-panel border-l border-border flex flex-col animate-[slideIn_0.2s_ease-out]">
        {/* Header */}
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-3 border-b border-border shrink-0">
          <div className="w-3 h-3 rounded-full" style={{ background: field.color }} />
          <h2 className={`font-mono text-xs md:text-sm font-bold flex-1 truncate ${field.archived ? 'text-muted line-through' : 'text-text'}`}>{field.name}</h2>
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
        <div className="flex-1 overflow-y-auto p-3 md:p-5">
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

// ═══════════════════════════════════════
//  CULTURE
// ═══════════════════════════════════════

const DEFAULT_CALI_STRAINS = ['Cali Water', 'Mochi Coco', 'One Hitter', 'Yuzu']

function CultureTab() {
  const field = useField()
  const updateField = useAppStore((s) => s.updateField)
  const userStrains = useAppStore((s) => s.strains)
  const seedType = field.culture?.seedType || 'beldia'
  const strain = field.culture?.strain || ''
  const [customStrain, setCustomStrain] = useState('')

  // Merge default strains + user-added strains (deduplicated)
  const allStrains = [...new Set([...DEFAULT_CALI_STRAINS, ...userStrains])]

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
          <select value={allStrains.includes(strain) ? strain : (strain ? '__custom' : '')}
            onChange={(e) => {
              if (e.target.value === '__custom') { setCustomStrain(strain); return }
              updateField(field.id, { culture: { seedType: 'cali', strain: e.target.value } })
            }}
            className="w-full font-mono text-xs bg-bg border border-border text-text py-2 px-3 outline-none focus:border-olive-lit">
            <option value="">— Choisir —</option>
            {allStrains.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__custom">Custom...</option>
          </select>
          {(strain && !allStrains.includes(strain)) || customStrain !== '' ? (
            <div className="flex gap-2 mt-1.5">
              <input type="text" value={customStrain || strain} onChange={(e) => setCustomStrain(e.target.value)}
                placeholder="Nom de la strain" autoFocus
                className="flex-1 font-mono text-xs bg-bg border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
              <button className="btn-sm btn-active text-[10px]" onClick={() => {
                if (customStrain.trim()) {
                  updateField(field.id, { culture: { seedType: 'cali', strain: customStrain.trim() } })
                  setCustomStrain('')
                }
              }}>✓</button>
            </div>
          ) : null}
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
