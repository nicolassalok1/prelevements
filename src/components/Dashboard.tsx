import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { DashboardTab, IrrigationMethod, AmendmentType } from '../types'

const NAV_ITEMS: { key: DashboardTab; icon: string; label: string }[] = [
  { key: 'overview', icon: '◈', label: 'Vue d\'ensemble' },
  { key: 'watering', icon: '◇', label: 'Arrosage' },
  { key: 'amendments', icon: '▣', label: 'Amendements' },
  { key: 'expenses', icon: '◉', label: 'Dépenses' },
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
          {tab === 'watering' && <WateringTab />}
          {tab === 'amendments' && <AmendmentsTab />}
          {tab === 'expenses' && <ExpensesTab />}
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
//  ARROSAGE
// ═══════════════════════════════════════

const IRRIGATION_LABELS: Record<IrrigationMethod, string> = { goutte_a_goutte: 'Goutte à goutte', aspersion: 'Aspersion', gravitaire: 'Gravitaire', manuel: 'Manuel' }

function WateringTab() {
  const store = useAppStore()
  const [filterField, setFilterField] = useState(0)

  const filtered = filterField ? store.wateringLog.filter((w) => w.fieldId === filterField) : store.wateringLog
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <TabHeader title="Historique arrosage" subtitle="Consultation de l'irrigation par champ" />

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
  const [filterField, setFilterField] = useState(0)

  const filtered = filterField ? store.amendmentLog.filter((a) => a.fieldId === filterField) : store.amendmentLog
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <TabHeader title="Amendements & Engrais" subtitle="Consultation des apports nutritifs par champ" />

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
//  DÉPENSES & SALAIRES
// ═══════════════════════════════════════

function ExpensesTab() {
  const store = useAppStore()
  const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
  const expenses = store.activities.filter((a) => a.type === 'expense')
  const salaries = store.activities.filter((a) => a.type === 'salary')

  const expenseTotal = expenses.reduce((s, e) => s + (e.expense?.amount ?? 0), 0)
  const salaryTotal = salaries.reduce((s, a) => {
    if (!a.salary) return s
    const hours = a.salary.duration === 'full' ? 8 : 4
    return s + a.salary.workerCount * a.salary.hourlyRate * hours
  }, 0)
  const grandTotal = expenseTotal + salaryTotal

  const sortedExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date))
  const sortedSalaries = [...salaries].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <TabHeader title="Dépenses & Salaires" subtitle="Consultation des dépenses et de la masse salariale" />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-bg border border-border p-3">
          <div className="text-[9px] text-muted tracking-[1px] uppercase">Total général</div>
          <div className="font-mono text-xl mt-1 text-red">{fmt(grandTotal)} DH</div>
        </div>
        <div className="bg-bg border border-border p-3">
          <div className="text-[9px] text-muted tracking-[1px] uppercase">Dépenses</div>
          <div className="font-mono text-xl mt-1 text-red">{fmt(expenseTotal)} DH</div>
          <div className="text-[9px] text-muted">{expenses.length} entrée{expenses.length > 1 ? 's' : ''}</div>
        </div>
        <div className="bg-bg border border-border p-3">
          <div className="text-[9px] text-muted tracking-[1px] uppercase">Salaires</div>
          <div className="font-mono text-xl mt-1 text-amber">{fmt(salaryTotal)} DH</div>
          <div className="text-[9px] text-muted">{salaries.length} entrée{salaries.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Dépenses */}
      <div className="font-mono text-[10px] text-red tracking-[2px] uppercase mb-2">Dépenses ({expenses.length})</div>
      {sortedExpenses.length ? (
        <div className="space-y-1 mb-6">
          {sortedExpenses.map((a) => (
            <div key={a.id} className="border border-border p-2.5 hover:bg-olive/5 transition-colors">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[10px] text-muted">{a.date}</span>
                <span className="font-mono text-xs text-red font-bold">{fmt(a.expense?.amount ?? 0)} DH</span>
                {a.expense?.category && <span className="font-mono text-[10px] bg-panel border border-border px-1.5 py-px text-muted">{a.expense.category}</span>}
              </div>
              {a.notes && <div className="font-mono text-[10px] text-muted mt-1.5 border-t border-border/30 pt-1 italic">{a.notes}</div>}
            </div>
          ))}
        </div>
      ) : <EmptyState text="Aucune dépense enregistrée." />}

      {/* Salaires */}
      <div className="font-mono text-[10px] text-amber tracking-[2px] uppercase mb-2">Salaires ({salaries.length})</div>
      {sortedSalaries.length ? (
        <div className="space-y-1">
          {sortedSalaries.map((a) => {
            const s = a.salary!
            const hours = s.duration === 'full' ? 8 : 4
            const total = s.workerCount * s.hourlyRate * hours
            return (
              <div key={a.id} className="border border-border p-2.5 hover:bg-olive/5 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[10px] text-muted">{a.date}</span>
                  <span className="font-mono text-xs text-amber font-bold">{fmt(total)} DH</span>
                  <span className="font-mono text-[10px] text-muted">
                    {s.workerCount} ouv. × {s.hourlyRate} DH/h × {s.duration === 'full' ? '8h' : '4h'}
                  </span>
                </div>
                {a.notes && <div className="font-mono text-[10px] text-muted mt-1.5 border-t border-border/30 pt-1 italic">{a.notes}</div>}
              </div>
            )
          })}
        </div>
      ) : <EmptyState text="Aucun salaire enregistré." />}
    </>
  )
}
