import { useState } from 'react'
import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { computeFieldRelief } from '../utils/terrain-auto'
import type { FieldDetailTab, SeedType, IrrigationMethod, AmendmentType, Exposition } from '../types'

const TABS: { key: FieldDetailTab; label: string }[] = [
  { key: 'info', label: 'Infos' },
  { key: 'culture', label: 'Culture' },
  { key: 'watering', label: 'Arrosage' },
  { key: 'amendments', label: 'Engrais' },
  { key: 'other', label: 'Autres' },
  { key: 'soil', label: 'Sol' },
  { key: 'relief', label: 'Relief' },
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

  if (!open || !field) return null

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
          {TABS.map((t) => (
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
  const toast = useAppStore((s) => s.toast)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(field.name)

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

      {/* Summary */}
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

function QuickAddActivityButton({ fieldId, type, disabled }: { fieldId: number; type: 'watering' | 'amendment' | 'other'; disabled?: boolean }) {
  const openActivityForm = useAppStore((s) => s.openActivityForm)
  const label = type === 'watering' ? 'Arrosage' : type === 'amendment' ? 'Engrais' : 'Activité'
  return (
    <button
      disabled={disabled}
      onClick={() => openActivityForm({ date: new Date().toISOString().slice(0, 10), presetType: type, presetFieldId: fieldId })}
      className="btn-active w-full text-[11px] py-2 disabled:opacity-50 disabled:cursor-not-allowed">
      + Nouvel(le) {label.toLowerCase()} (via agenda)
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

function ActivityList({ fieldId, type, showEmpty }: { fieldId: number; type: 'watering' | 'amendment' | 'other'; showEmpty?: boolean }) {
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

  const typeLabel = type === 'watering' ? 'arrosages' : type === 'amendment' ? 'engrais' : 'activités'

  return (
    <div>
      <Label>Activités — {typeLabel} ({sorted.length})</Label>
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
  const [ph, setPh] = useState(7.0); const [n, setN] = useState(0); const [p, setP] = useState(0); const [k, setK] = useState(0)
  const [om, setOm] = useState(0); const [texture, setTexture] = useState(''); const [notes, setNotes] = useState('')

  const handleAdd = () => {
    store.addSoilAnalysis({ date, fieldId: field.id, ph, nitrogen: n, phosphorus: p, potassium: k, organicMatter: om, texture: texture || undefined, notes: notes || undefined })
    store.toast('✓ Analyse enregistrée')
    setTexture(''); setNotes('')
  }

  const phColor = (v: number) => v < 6 ? 'text-red' : v > 8 ? 'text-red' : v >= 6.5 && v <= 7.5 ? 'text-olive-lit' : 'text-amber'

  return (
    <div className="space-y-4">
      <div className="bg-bg border border-border p-3 space-y-2">
        <Label>Nouvelle analyse</Label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit mb-1" />
        <div className="grid grid-cols-5 gap-1.5">
          {([['pH', ph, setPh, 0, 14, 0.1], ['N', n, setN, 0, 999, 1], ['P', p, setP, 0, 999, 1], ['K', k, setK, 0, 999, 1], ['MO%', om, setOm, 0, 100, 0.1]] as const).map(([lbl, val, setter, min, max, step]) => (
            <div key={lbl}>
              <div className="text-[8px] text-muted uppercase text-center mb-0.5">{lbl}</div>
              <input type="number" value={val} onChange={(e) => setter(parseFloat(e.target.value) || 0)}
                min={min} max={max} step={step}
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1 px-1.5 outline-none focus:border-olive-lit text-center" />
            </div>
          ))}
        </div>
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
                <div className="grid grid-cols-5 gap-1 text-center">
                  <div><div className="text-[8px] text-muted">pH</div><div className={`font-mono text-base font-bold ${phColor(s.ph)}`}>{s.ph}</div></div>
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

  // Any manual edit clears the autoComputed flag → locks the relief against
  // future background recomputations (e.g. after a polygon edit).
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
