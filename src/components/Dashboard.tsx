import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { computeFieldRelief } from '../utils/terrain-auto'
import type { SeedType, DashboardTab, IrrigationMethod, AmendmentType, Exposition, Field } from '../types'

const NAV_ITEMS: { key: DashboardTab; icon: string; label: string }[] = [
  { key: 'overview', icon: '◈', label: 'Vue d\'ensemble' },
  { key: 'cultures', icon: '❋', label: 'Cultures' },
  { key: 'agenda', icon: '◰', label: 'Agenda' },
  { key: 'watering', icon: '◇', label: 'Arrosage' },
  { key: 'amendments', icon: '▣', label: 'Amendements' },
  { key: 'soil', icon: '◬', label: 'Analyse sols' },
  { key: 'relief', icon: '▲', label: 'Relief' },
]

export function Dashboard() {
  const open = useAppStore((s) => s.dashboardOpen)
  const tab = useAppStore((s) => s.dashboardTab)
  const setTab = useAppStore((s) => s.setDashboardTab)
  const setOpen = useAppStore((s) => s.setDashboardOpen)

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="bg-panel border border-border w-full h-full md:w-[92vw] md:max-w-[900px] md:h-[85vh] flex flex-col md:flex-row relative">
        {/* Nav — horizontal tabs on mobile, vertical sidebar on desktop */}
        <nav className="flex md:flex-col md:w-[180px] border-b md:border-b-0 md:border-r border-border bg-bg shrink-0 overflow-x-auto md:overflow-x-visible">
          <div className="hidden md:block px-4 py-4 border-b border-border">
            <div className="font-mono text-[10px] text-olive-lit tracking-[2px]">DASHBOARD</div>
            <div className="font-mono text-[9px] text-muted mt-1">v2.0</div>
          </div>
          {NAV_ITEMS.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`text-left px-3 md:px-4 py-2 md:py-2.5 text-[11px] md:text-xs font-semibold tracking-[.5px] whitespace-nowrap border-b-2 md:border-b-0 md:border-l-2 transition-all cursor-pointer bg-transparent border-t-0 border-r-0 md:border-y-0
                ${tab === item.key ? 'border-b-olive-lit md:border-b-transparent md:border-l-olive-lit text-olive-lit bg-olive/10' : 'border-b-transparent md:border-l-transparent text-muted hover:text-text hover:bg-panel'}`}>
              <span className="mr-1.5 md:mr-2 opacity-60">{item.icon}</span>{item.label}
            </button>
          ))}
          <div className="hidden md:block mt-auto p-3 border-t border-border">
            <button onClick={() => setOpen(false)} className="btn-danger w-full text-[10px] py-1.5">Fermer</button>
          </div>
        </nav>

        {/* Mobile close button */}
        <button
          onClick={() => setOpen(false)}
          className="md:hidden absolute top-2 right-2 z-10 w-9 h-9 flex items-center justify-center text-[var(--color-muted)] border border-[var(--color-border)] bg-[var(--color-panel)] text-lg"
        >
          ✕
        </button>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'cultures' && <CulturesTab />}
          {tab === 'agenda' && <AgendaTab />}
          {tab === 'watering' && <WateringTab />}
          {tab === 'amendments' && <AmendmentsTab />}
          {tab === 'soil' && <SoilTab />}
          {tab === 'relief' && <ReliefTab />}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
//  SHARED
// ═══════════════════════════════════════

function TabHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-mono text-sm text-olive-lit tracking-[2px] uppercase">{title}</h2>
      <p className="text-xs text-muted mt-1">{subtitle}</p>
    </div>
  )
}

function FieldSelector({ value, onChange, label = 'Champ' }: { value: number; onChange: (id: number) => void; label?: string }) {
  const fields = useAppStore((s) => s.fields)
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-muted uppercase tracking-[.5px] min-w-[50px]">{label}</label>
      <select value={value} onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 font-mono text-xs bg-bg border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit">
        <option value={0}>— Tous les champs —</option>
        {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center text-muted text-xs py-8 leading-relaxed">{text}</div>
}

// ═══════════════════════════════════════
//  OVERVIEW
// ═══════════════════════════════════════

function OverviewTab() {
  const store = useAppStore()
  const totalPts = store.fields.reduce((s, f) => s + f.points.length, 0)

  return (
    <>
      <TabHeader title="Vue d'ensemble" subtitle="Résumé de l'exploitation et de l'activité récente" />

      <div className="grid grid-cols-4 gap-3 mb-6">
        <OverviewCard label="Surface" value={store.exploitArea > 0 ? store.exploitArea.toFixed(1) : '—'} unit="ha" color="text-cyan" />
        <OverviewCard label="Champs" value={String(store.fields.length)} unit="parcelles" color="text-olive-lit" />
        <OverviewCard label="Points" value={String(totalPts)} unit="prélèvements" color="text-amber" />
        <OverviewCard label="Personnel" value={String(store.employees.length)} unit="personnes" color="text-text" />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <OverviewCard label="Arrosages" value={String(store.wateringLog.length)} unit="entrées" color="text-cyan" />
        <OverviewCard label="Amendements" value={String(store.amendmentLog.length)} unit="entrées" color="text-olive-lit" />
        <OverviewCard label="Analyses sol" value={String(store.soilAnalyses.length)} unit="analyses" color="text-amber" />
      </div>

      {/* Recent activity */}
      <div className="border border-border p-4">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase mb-3">Activité récente</div>
        {(() => {
          type ActivityItem = { date: string; text: string }
          const items: ActivityItem[] = []
          store.wateringLog.slice(-5).forEach((w) => {
            const f = store.fields.find((f) => f.id === w.fieldId)
            items.push({ date: w.date, text: `Arrosage ${f?.name || '?'} — ${w.durationMin} min` })
          })
          store.amendmentLog.slice(-5).forEach((a) => {
            const f = store.fields.find((f) => f.id === a.fieldId)
            items.push({ date: a.date, text: `${a.product} sur ${f?.name || '?'} — ${a.quantityKg} kg` })
          })
          store.soilAnalyses.slice(-3).forEach((s) => {
            const f = store.fields.find((f) => f.id === s.fieldId)
            items.push({ date: s.date, text: `Analyse sol ${f?.name || '?'} — pH ${s.ph}` })
          })
          items.sort((a, b) => b.date.localeCompare(a.date))
          if (!items.length) return <EmptyState text="Aucune activité enregistrée." />
          return items.slice(0, 8).map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/30 last:border-b-0">
              <span className="font-mono text-[10px] text-muted min-w-[72px]">{item.date}</span>
              <span className="text-xs text-text">{item.text}</span>
            </div>
          ))
        })()}
      </div>
    </>
  )
}

function OverviewCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="bg-bg border border-border p-3">
      <div className="text-[9px] text-muted tracking-[1px] uppercase">{label}</div>
      <div className={`font-mono text-xl mt-1 ${color}`}>{value}</div>
      <div className="text-[9px] text-muted">{unit}</div>
    </div>
  )
}

// ═══════════════════════════════════════
//  CULTURES
// ═══════════════════════════════════════

function CulturesTab() {
  const store = useAppStore()
  const [newStrain, setNewStrain] = useState('')

  return (
    <>
      <TabHeader title="Cultures" subtitle="Type de graine et strains par champ" />

      <div className="mb-6">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase mb-2">Catalogue strains Cali</div>
        <div className="flex gap-2 mb-3">
          <input type="text" value={newStrain} onChange={(e) => setNewStrain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newStrain.trim() && (store.addStrain(newStrain.trim()), setNewStrain(''))}
            placeholder="Nom de la strain (ex: OG Kush)"
            className="flex-1 font-mono text-xs bg-bg border border-border text-text py-1.5 px-2.5 outline-none focus:border-olive-lit placeholder:text-muted" />
          <button className="btn-active" onClick={() => { if (newStrain.trim()) { store.addStrain(newStrain.trim()); store.toast(`✓ "${newStrain.trim()}" ajoutée`); setNewStrain('') } }}>+</button>
        </div>
        {store.strains.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {store.strains.map((s) => (
              <span key={s} className="font-mono text-[11px] bg-bg border border-border px-2 py-1 text-text flex items-center gap-2">
                {s}
                <button onClick={() => store.removeStrain(s)} className="text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs">✕</button>
              </span>
            ))}
          </div>
        ) : <EmptyState text="Ajoutez des strains pour les champs Cali." />}
      </div>

      <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase mb-3">Configuration par champ</div>
      {store.fields.length > 0 ? (
        <div className="space-y-2">
          {store.fields.map((f) => {
            const seedType = f.culture?.seedType || 'beldia'
            const strain = f.culture?.strain || ''
            return (
              <div key={f.id} className="bg-bg border border-border p-3 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
                <span className="font-mono text-xs text-text font-bold min-w-[80px]">{f.name}</span>
                <select value={seedType}
                  onChange={(e) => { const t = e.target.value as SeedType; store.updateField(f.id, { culture: { seedType: t, strain: t === 'beldia' ? '' : strain } }) }}
                  className="font-mono text-xs bg-panel border border-border text-text py-1 px-2 outline-none focus:border-olive-lit">
                  <option value="beldia">Beldia</option>
                  <option value="cali">Cali</option>
                </select>
                {seedType === 'cali' && (
                  <select value={strain}
                    onChange={(e) => store.updateField(f.id, { culture: { seedType: 'cali', strain: e.target.value } })}
                    className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1 px-2 outline-none focus:border-olive-lit">
                    <option value="">— Strain —</option>
                    {store.strains.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      ) : <EmptyState text="Aucun champ défini." />}
    </>
  )
}

// ═══════════════════════════════════════
//  AGENDA
// ═══════════════════════════════════════

function AgendaTab() {
  const store = useAppStore()
  const activities = store.activities
  const recent = [...activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

  return (
    <>
      <TabHeader title="Agenda" subtitle="Planifier et journaliser les activités sur les zones" />

      <div className="bg-bg border border-border p-6 mb-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="font-mono text-sm text-olive-lit mb-1">◰ Calendrier des activités</div>
          <p className="text-xs text-muted leading-relaxed">
            Gérez vos activités (arrosage, engrais, autres) au quotidien depuis le calendrier.
            Cliquez sur un jour pour voir le détail ou ajouter une nouvelle activité.
          </p>
        </div>
        <button
          onClick={() => { store.setDashboardOpen(false); store.setCalendarOpen(true) }}
          className="btn-cyan text-xs px-4 py-2.5 whitespace-nowrap">
          Ouvrir le calendrier →
        </button>
      </div>

      <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase mb-3">
        Activités récentes ({activities.length})
      </div>
      {recent.length === 0 ? (
        <EmptyState text="Aucune activité enregistrée." />
      ) : (
        <div className="space-y-1">
          {recent.map((a) => {
            const fieldNames = a.fieldIds.map((id) => store.fields.find((f) => f.id === id)?.name).filter(Boolean).join(', ')
            const label = a.type === 'watering'
              ? `Arrosage — ${IRRIGATION_LABELS[a.watering!.method]} (${a.watering!.durationMin} min${a.watering!.flowRatePerHour ? `, ${a.watering!.flowRatePerHour} L/h` : ''})`
              : a.type === 'amendment'
                ? `${a.amendment!.product} (${a.amendment!.customType || AMENDMENT_LABELS[a.amendment!.type]}, ${a.amendment!.quantityKg} kg)`
                : a.type === 'expense'
                  ? `Dépense${a.expense?.category ? ` — ${a.expense.category}` : ''} · ${(a.expense?.amount ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DH`
                  : a.other?.title || 'Activité'
            return (
              <div key={a.id} className="border border-border p-2.5 hover:bg-olive/5 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[10px] text-muted">{a.date}</span>
                  <span className={`font-mono text-xs font-bold ${a.type === 'expense' ? 'text-red' : 'text-text'}`}>{label}</span>
                  {a.type !== 'watering' && a.type !== 'expense' && (
                    <span className="font-mono text-[10px] text-muted">· {a.workerCount} ouv.</span>
                  )}
                  {fieldNames && <span className="font-mono text-[10px] text-muted truncate">({fieldNames})</span>}
                  <button onClick={() => { store.setDashboardOpen(false); store.openActivityForm({ date: a.date, editId: a.id }) }}
                    className="ml-auto text-muted hover:text-olive-lit bg-transparent border-none cursor-pointer text-[11px]">✎</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}


// ═══════════════════════════════════════
//  ARROSAGE
// ═══════════════════════════════════════

const IRRIGATION_LABELS: Record<IrrigationMethod, string> = { goutte_a_goutte: 'Goutte à goutte', aspersion: 'Aspersion', gravitaire: 'Gravitaire', manuel: 'Manuel' }

function WateringTab() {
  const store = useAppStore()
  const [fieldId, setFieldId] = useState(store.fields[0]?.id || 0)
  const [filterField, setFilterField] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState<IrrigationMethod>('goutte_a_goutte')
  const [duration, setDuration] = useState(30)
  const [volume, setVolume] = useState('')
  const [notes, setNotes] = useState('')

  const handleAdd = () => {
    if (!fieldId) { store.toast('⚠ Sélectionnez un champ', true); return }
    store.addWatering({ date, fieldId, method, durationMin: duration, volumeL: volume ? parseFloat(volume) : undefined, notes: notes || undefined })
    store.toast('✓ Arrosage enregistré')
    setNotes(''); setVolume('')
  }

  const filtered = filterField ? store.wateringLog.filter((w) => w.fieldId === filterField) : store.wateringLog
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <TabHeader title="Historique arrosage" subtitle="Enregistrez et suivez l'irrigation de chaque champ" />

      <div className="bg-bg border border-border p-4 mb-5">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase mb-3">Nouvel arrosage</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <FieldSelector value={fieldId} onChange={setFieldId} />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted min-w-[50px]">DATE</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted min-w-[40px]">TYPE</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as IrrigationMethod)}
              className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit">
              {Object.entries(IRRIGATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted min-w-[40px]">DURÉE</label>
            <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} min={1}
              className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit w-0" />
            <span className="text-[9px] text-muted shrink-0">min</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[10px] text-muted min-w-[40px]">VOL.</label>
          <input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="optionnel"
            className="w-[120px] font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
          <span className="text-[9px] text-muted shrink-0">litres</span>
        </div>
        <div className="flex gap-2">
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optionnel)"
            className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2.5 outline-none focus:border-olive-lit placeholder:text-muted" />
          <button className="btn-active" onClick={handleAdd}>+ Enregistrer</button>
        </div>
      </div>

      {/* History */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase">Historique ({sorted.length})</div>
        <div className="w-[200px]"><FieldSelector value={filterField} onChange={setFilterField} label="Filtre" /></div>
      </div>
      {sorted.length ? (
        <div className="space-y-1">
          {sorted.map((w) => {
            const f = store.fields.find((f) => f.id === w.fieldId)
            return (
              <div key={w.id} className="border border-border p-2.5 hover:bg-olive/5 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[10px] text-muted">{w.date}</span>
                  <span className="font-mono text-xs text-text font-bold">{f?.name || '?'}</span>
                  <span className="font-mono text-[10px] bg-panel border border-border px-1.5 py-px text-muted">{IRRIGATION_LABELS[w.method]}</span>
                  <span className="font-mono text-xs text-cyan">{w.durationMin} min</span>
                  {w.volumeL && <span className="font-mono text-xs text-muted">{w.volumeL} L</span>}
                  <button onClick={() => store.removeWatering(w.id)} className="ml-auto text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs">✕</button>
                </div>
                {w.notes && <div className="font-mono text-[10px] text-muted mt-1.5 border-t border-border/30 pt-1 italic">{w.notes}</div>}
              </div>
            )
          })}
        </div>
      ) : <EmptyState text="Aucun arrosage enregistré." />}
    </>
  )
}

// ═══════════════════════════════════════
//  AMENDEMENTS
// ═══════════════════════════════════════

const AMENDMENT_LABELS: Record<AmendmentType, string> = { organique: 'Organique', mineral: 'Minéral', foliaire: 'Foliaire', correcteur: 'Correcteur' }

function AmendmentsTab() {
  const store = useAppStore()
  const [fieldId, setFieldId] = useState(store.fields[0]?.id || 0)
  const [filterField, setFilterField] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<AmendmentType>('organique')
  const [product, setProduct] = useState('')
  const [qty, setQty] = useState(10)
  const [notes, setNotes] = useState('')

  const handleAdd = () => {
    if (!fieldId) { store.toast('⚠ Sélectionnez un champ', true); return }
    if (!product.trim()) { store.toast('⚠ Saisissez le nom du produit', true); return }
    store.addAmendment({ date, fieldId, type, product: product.trim(), quantityKg: qty, notes: notes || undefined })
    store.toast('✓ Amendement enregistré')
    setProduct(''); setNotes('')
  }

  const filtered = filterField ? store.amendmentLog.filter((a) => a.fieldId === filterField) : store.amendmentLog
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <TabHeader title="Amendements & Engrais" subtitle="Suivi des apports nutritifs par champ" />

      <div className="bg-bg border border-border p-4 mb-5">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase mb-3">Nouvel apport</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <FieldSelector value={fieldId} onChange={setFieldId} />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted min-w-[50px]">DATE</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted min-w-[40px]">TYPE</label>
            <select value={type} onChange={(e) => setType(e.target.value as AmendmentType)}
              className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit">
              {Object.entries(AMENDMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted min-w-[40px]">QTÉ</label>
            <input type="number" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} min={0}
              className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit w-0" />
            <span className="text-[9px] text-muted shrink-0">kg</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[10px] text-muted min-w-[40px]">PRODUIT</label>
          <input type="text" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Nom du produit"
            className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
        </div>
        <div className="flex gap-2">
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optionnel)"
            className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2.5 outline-none focus:border-olive-lit placeholder:text-muted" />
          <button className="btn-active" onClick={handleAdd}>+ Enregistrer</button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase">Historique ({sorted.length})</div>
        <div className="w-[200px]"><FieldSelector value={filterField} onChange={setFilterField} label="Filtre" /></div>
      </div>
      {sorted.length ? (
        <div className="space-y-1">
          {sorted.map((a) => {
            const f = store.fields.find((f) => f.id === a.fieldId)
            return (
              <div key={a.id} className="border border-border p-2.5 hover:bg-olive/5 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[10px] text-muted">{a.date}</span>
                  <span className="font-mono text-xs text-text font-bold">{f?.name || '?'}</span>
                  <span className="font-mono text-[10px] bg-panel border border-border px-1.5 py-px text-muted">{AMENDMENT_LABELS[a.type]}</span>
                  <span className="font-mono text-xs text-amber">{a.product}</span>
                  <span className="font-mono text-xs text-olive-lit">{a.quantityKg} kg</span>
                  <button onClick={() => store.removeAmendment(a.id)} className="ml-auto text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs">✕</button>
                </div>
                {a.notes && <div className="font-mono text-[10px] text-muted mt-1.5 border-t border-border/30 pt-1 italic">{a.notes}</div>}
              </div>
            )
          })}
        </div>
      ) : <EmptyState text="Aucun amendement enregistré." />}
    </>
  )
}

// ═══════════════════════════════════════
//  ANALYSE SOLS
// ═══════════════════════════════════════

function SoilTab() {
  const store = useAppStore()
  const [fieldId, setFieldId] = useState(store.fields[0]?.id || 0)
  const [filterField, setFilterField] = useState(0)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [ph, setPh] = useState(7.0); const [ec, setEc] = useState(0); const [n, setN] = useState(0); const [p, setP] = useState(0); const [k, setK] = useState(0)
  const [om, setOm] = useState(0); const [texture, setTexture] = useState(''); const [notes, setNotes] = useState('')

  const handleAdd = () => {
    if (!fieldId) { store.toast('⚠ Sélectionnez un champ', true); return }
    store.addSoilAnalysis({
      date, fieldId, ph,
      ec: ec > 0 ? ec : undefined,
      nitrogen: n, phosphorus: p, potassium: k, organicMatter: om,
      texture: texture || undefined,
      notes: notes || undefined,
    })
    store.toast('✓ Analyse enregistrée')
    setNotes(''); setTexture('')
  }

  const filtered = filterField ? store.soilAnalyses.filter((s) => s.fieldId === filterField) : store.soilAnalyses
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  const phColor = (v: number) => v < 6 ? 'text-red' : v > 8 ? 'text-red' : v >= 6.5 && v <= 7.5 ? 'text-olive-lit' : 'text-amber'
  const ecColor = (v: number) => v <= 0 ? 'text-muted' : v < 0.7 ? 'text-olive-lit' : v <= 3 ? 'text-amber' : 'text-red'

  return (
    <>
      <TabHeader title="Analyse des sols" subtitle="Résultats d'analyses pH, EC, NPK, matière organique" />

      <div className="bg-bg border border-border p-4 mb-5">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase mb-3">Nouvelle analyse</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <FieldSelector value={fieldId} onChange={setFieldId} />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted min-w-[50px]">DATE</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
          </div>
        </div>
        <div className="grid grid-cols-6 gap-2 mb-2">
          {[
            ['pH', ph, setPh, 0, 14, 0.1, ''],
            ['EC', ec, setEc, 0, 20, 0.1, 'mS/cm'],
            ['N', n, setN, 0, 999, 1, 'mg/kg'],
            ['P', p, setP, 0, 999, 1, 'mg/kg'],
            ['K', k, setK, 0, 999, 1, 'mg/kg'],
            ['M.O.', om, setOm, 0, 100, 0.1, '%'],
          ].map(([lbl, val, setter, min, max, step, unit]) => (
            <div key={lbl as string} className="flex flex-col gap-0.5">
              <label className="text-[9px] text-muted uppercase tracking-[.5px]">{lbl as string} <span className="text-[8px]">{unit as string}</span></label>
              <input type="number" value={val as number} onChange={(e) => (setter as (v: number) => void)(parseFloat(e.target.value) || 0)}
                min={min as number} max={max as number} step={step as number}
                className="font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit w-full" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={texture} onChange={(e) => setTexture(e.target.value)} placeholder="Texture (ex: argilo-limoneux)"
            className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2.5 outline-none focus:border-olive-lit placeholder:text-muted" />
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes"
            className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2.5 outline-none focus:border-olive-lit placeholder:text-muted" />
          <button className="btn-active" onClick={handleAdd}>+ Enregistrer</button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase">Résultats ({sorted.length})</div>
        <div className="w-[200px]"><FieldSelector value={filterField} onChange={setFilterField} label="Filtre" /></div>
      </div>
      {sorted.length ? (
        <div className="space-y-2">
          {sorted.map((s) => {
            const f = store.fields.find((f) => f.id === s.fieldId)
            return (
              <div key={s.id} className="border border-border p-3 hover:bg-olive/5 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-[10px] text-muted">{s.date}</span>
                  <span className="font-mono text-xs text-text font-bold">{f?.name || '?'}</span>
                  {s.texture && <span className="font-mono text-[10px] text-muted border border-border px-1.5 py-px">{s.texture}</span>}
                  <button onClick={() => store.removeSoilAnalysis(s.id)} className="ml-auto text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs">✕</button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  <div className="text-center"><div className="text-[9px] text-muted">pH</div><div className={`font-mono text-lg font-bold ${phColor(s.ph)}`}>{s.ph}</div></div>
                  <div className="text-center">
                    <div className="text-[9px] text-muted">EC</div>
                    <div className={`font-mono text-lg ${ecColor(s.ec ?? 0)}`}>{s.ec != null ? s.ec : '—'}</div>
                  </div>
                  <div className="text-center"><div className="text-[9px] text-muted">N</div><div className="font-mono text-lg text-olive-lit">{s.nitrogen}</div></div>
                  <div className="text-center"><div className="text-[9px] text-muted">P</div><div className="font-mono text-lg text-amber">{s.phosphorus}</div></div>
                  <div className="text-center"><div className="text-[9px] text-muted">K</div><div className="font-mono text-lg text-cyan">{s.potassium}</div></div>
                  <div className="text-center"><div className="text-[9px] text-muted">M.O.%</div><div className="font-mono text-lg text-text">{s.organicMatter}</div></div>
                </div>
                {s.notes && <div className="font-mono text-[10px] text-muted mt-2 border-t border-border/30 pt-1">{s.notes}</div>}
              </div>
            )
          })}
        </div>
      ) : <EmptyState text="Aucune analyse enregistrée." />}
    </>
  )
}

// ═══════════════════════════════════════
//  RELIEF
// ═══════════════════════════════════════

const EXPO_LABELS: Record<Exposition, string> = {
  nord: '↑ Nord', 'nord-est': '↗ Nord-Est', est: '→ Est', 'sud-est': '↘ Sud-Est',
  sud: '↓ Sud', 'sud-ouest': '↙ Sud-Ouest', ouest: '← Ouest', 'nord-ouest': '↖ Nord-Ouest', plat: '⊙ Plat',
}
const EXPO_SUN: Record<Exposition, string> = {
  sud: 'Excellent', 'sud-est': 'Très bon', 'sud-ouest': 'Très bon', est: 'Bon', ouest: 'Bon',
  plat: 'Bon', 'nord-est': 'Modéré', 'nord-ouest': 'Modéré', nord: 'Faible',
}

function ReliefTab() {
  const store = useAppStore()
  const [computingId, setComputingId] = useState<number | null>(null)
  const [computingAll, setComputingAll] = useState(false)

  const activeFields = store.fields.filter((f) => !f.archived)

  const computeOne = async (f: Field) => {
    try {
      const { relief, warnings, sampleCount } = await computeFieldRelief(f)
      store.updateField(f.id, { relief })
      if (warnings.length > 0) {
        store.toast(`⚠ ${f.name}: ${warnings[0]}`, true)
      } else {
        store.toast(`✓ ${f.name} — relief calculé (${sampleCount} pts)`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      store.toast(`⚠ ${f.name}: ${msg}`, true)
      throw e
    }
  }

  const handleAutoOne = async (f: Field) => {
    setComputingId(f.id)
    try { await computeOne(f) } catch { /* toast already shown */ }
    finally { setComputingId(null) }
  }

  const handleAutoAll = async () => {
    setComputingAll(true)
    let ok = 0
    let fail = 0
    for (const f of activeFields) {
      setComputingId(f.id)
      try {
        await computeOne(f)
        ok++
      } catch {
        fail++
      }
    }
    setComputingId(null)
    setComputingAll(false)
    store.toast(
      fail > 0
        ? `Relief: ${ok} réussis · ${fail} échoués`
        : `✓ Relief calculé pour ${ok} zone${ok > 1 ? 's' : ''}`,
      fail > 0,
    )
  }

  return (
    <>
      <TabHeader title="Relief & Exposition" subtitle="Altitude, pente, orientation et ensoleillement par champ" />

      {activeFields.length > 0 && (
        <button
          onClick={handleAutoAll}
          disabled={computingAll}
          className="btn-cyan w-full text-xs py-2 mb-4 disabled:opacity-50 disabled:cursor-wait"
          title="Calcule le relief de toutes les zones actives via Open-Meteo"
        >
          {computingAll
            ? `⏳ Calcul en cours (${activeFields.length} zones)…`
            : `✨ Calculer automatiquement toutes les zones (${activeFields.length})`}
        </button>
      )}

      {store.fields.length > 0 ? (
        <div className="space-y-3">
          {store.fields.map((f) => {
            const r = f.relief || { exposition: 'plat' as Exposition }
            const isComputing = computingId === f.id
            // Manual edits always clear autoComputed → locks the zone against
            // background re-runs on polygon edit or global recompute.
            const updateManual = (patch: Partial<typeof r>) =>
              store.updateField(f.id, { relief: { ...r, ...patch, autoComputed: false } })
            return (
              <div key={f.id} className="bg-bg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} />
                  <span className="font-mono text-xs text-text font-bold flex-1">{f.name}</span>
                  <span className="font-mono text-[9px] text-muted">{f.area.toFixed(2)} ha</span>
                  {!f.archived && (
                    <button
                      onClick={() => handleAutoOne(f)}
                      disabled={isComputing || computingAll}
                      className="font-mono text-[10px] px-2 py-0.5 border border-cyan text-cyan hover:bg-cyan/20 bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                      title="Calculer relief via Open-Meteo"
                    >
                      {isComputing ? '⏳' : '✨ Auto'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-[.5px] mb-1">Exposition</label>
                    <select value={r.exposition}
                      onChange={(e) => updateManual({ exposition: e.target.value as Exposition })}
                      className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit">
                      {Object.entries(EXPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-[.5px] mb-1">Ensoleillement</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={r.sunlightHours ?? ''} placeholder="—"
                        onChange={(e) => updateManual({ sunlightHours: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" min={0} max={16} step={0.1} />
                      <span className="text-[9px] text-muted">h/jour</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-[.5px] mb-1">Alt. min</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={r.altitudeMin ?? ''} placeholder="—"
                        onChange={(e) => updateManual({ altitudeMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
                      <span className="text-[9px] text-muted">m</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-[.5px] mb-1">Alt. max</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={r.altitudeMax ?? ''} placeholder="—"
                        onChange={(e) => updateManual({ altitudeMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
                      <span className="text-[9px] text-muted">m</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted uppercase tracking-[.5px] mb-1">Pente</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={r.slope ?? ''} placeholder="—"
                        onChange={(e) => updateManual({ slope: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" min={0} max={100} />
                      <span className="text-[9px] text-muted">%</span>
                    </div>
                  </div>
                </div>

                {/* Summary badges */}
                <div className="flex gap-2 flex-wrap">
                  <span className="font-mono text-[10px] bg-panel border border-border px-2 py-0.5 text-text">
                    {EXPO_LABELS[r.exposition]}
                  </span>
                  <span className={`font-mono text-[10px] bg-panel border border-border px-2 py-0.5 ${
                    EXPO_SUN[r.exposition] === 'Excellent' || EXPO_SUN[r.exposition] === 'Très bon' ? 'text-amber' :
                    EXPO_SUN[r.exposition] === 'Bon' ? 'text-olive-lit' : 'text-red'
                  }`}>
                    Soleil: {EXPO_SUN[r.exposition]}{r.sunlightHours ? ` (${r.sunlightHours}h)` : ''}
                  </span>
                  {r.slope !== undefined && <span className="font-mono text-[10px] bg-panel border border-border px-2 py-0.5 text-cyan">Pente: {r.slope}%</span>}
                  {r.altitudeMin !== undefined && r.altitudeMax !== undefined && (
                    <span className="font-mono text-[10px] bg-panel border border-border px-2 py-0.5 text-muted">{r.altitudeMin}m — {r.altitudeMax}m</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : <EmptyState text="Aucun champ défini." />}
    </>
  )
}
