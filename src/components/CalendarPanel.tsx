import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Activity, ActivityType, IrrigationMethod, AmendmentType } from '../types'

const IRRIGATION_LABELS: Record<IrrigationMethod, string> = { goutte_a_goutte: 'Goutte à goutte', aspersion: 'Aspersion', gravitaire: 'Gravitaire', manuel: 'Manuel' }
const AMENDMENT_LABELS: Record<AmendmentType, string> = { organique: 'Organique', mineral: 'Minéral', foliaire: 'Foliaire', correcteur: 'Correcteur' }

const TYPE_LABELS: Record<ActivityType, string> = { watering: 'Arrosage', amendment: 'Engrais', other: 'Autre', expense: 'Dépense', salary: 'Salaire' }
const TYPE_COLOR: Record<ActivityType, string> = {
  watering: 'text-cyan border-cyan/60',
  amendment: 'text-olive-lit border-olive-lit/60',
  other: 'text-amber border-amber/60',
  expense: 'text-red border-red/60',
  salary: 'text-amber border-amber/60',
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function formatDH(amount: number): string {
  // Simple thousands separator, no locale dependency (keeps bundle small).
  return amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' DH'
}
function activityLabel(a: Activity): string {
  if (a.type === 'watering') return `${TYPE_LABELS.watering} — ${IRRIGATION_LABELS[a.watering!.method]}`
  if (a.type === 'amendment') {
    const cat = a.amendment!.customType || AMENDMENT_LABELS[a.amendment!.type]
    return `${a.amendment!.product} (${cat})`
  }
  if (a.type === 'expense') {
    const cat = a.expense?.category ? ` — ${a.expense.category}` : ''
    return `Dépense${cat} · ${formatDH(a.expense?.amount ?? 0)}`
  }
  if (a.type === 'salary' && a.salary) {
    const hours = a.salary.duration === 'full' ? 8 : 4
    const total = a.salary.workerCount * a.salary.hourlyRate * hours
    return `Salaire · ${a.salary.workerCount} ouv. × ${a.salary.duration === 'full' ? '1j' : '½j'} · ${formatDH(total)}`
  }
  return a.other?.title || 'Activité'
}

export function CalendarPanel() {
  const open = useAppStore((s) => s.calendarOpen)
  const setOpen = useAppStore((s) => s.setCalendarOpen)
  const activities = useAppStore((s) => s.activities)
  const openActivityForm = useAppStore((s) => s.openActivityForm)
  const fields = useAppStore((s) => s.fields)

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  if (!open) return null

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: ({ day: number; iso: string } | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, iso })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const byDay = new Map<string, Activity[]>()
  activities.forEach((a) => {
    const arr = byDay.get(a.date) || []
    arr.push(a)
    byDay.set(a.date, arr)
  })

  const dayActivities = selectedDay ? (byDay.get(selectedDay) || []) : []
  const monthLabel = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className="bg-panel border border-border w-full h-full md:w-[92vw] md:max-w-[720px] md:h-[85vh] flex flex-col">
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-3 border-b border-border">
          <span className="font-mono text-xs md:text-sm text-olive-lit tracking-[2px] uppercase flex-1 truncate">◰ Agenda</span>
          <button onClick={() => openActivityForm({ date: selectedDay || todayISO(), presetType: 'watering' })} className="btn-cyan text-[10px]" title="Arrosage">💧</button>
          <button onClick={() => openActivityForm({ date: selectedDay || todayISO(), presetType: 'amendment' })} className="btn-active text-[10px]" title="Amendement">🌱</button>
          <button onClick={() => openActivityForm({ date: selectedDay || todayISO(), presetType: 'expense' })} className="btn-danger text-[10px]" title="Dépense">💰</button>
          <button onClick={() => openActivityForm({ date: selectedDay || todayISO(), presetType: 'salary' })} className="btn-amber text-[10px]" title="Salaire">👷</button>
          <button onClick={() => setOpen(false)} className="text-muted hover:text-red bg-transparent border-none text-lg cursor-pointer w-9 h-9 flex items-center justify-center">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2 gap-2">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="font-mono text-xs px-2 py-1 border border-border text-muted hover:text-olive-lit bg-transparent cursor-pointer">‹</button>
            <div className="flex items-center gap-2 flex-1 justify-center">
              <div className="font-mono text-xs text-text uppercase tracking-[2px]">{monthLabel}</div>
              <button
                onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelectedDay(todayISO()) }}
                className="font-mono text-[10px] px-2 py-0.5 border border-olive-lit text-olive-lit hover:bg-olive/20 bg-transparent cursor-pointer"
                title="Revenir au mois courant">
                ● Aujourd'hui
              </button>
            </div>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="font-mono text-xs px-2 py-1 border border-border text-muted hover:text-olive-lit bg-transparent cursor-pointer">›</button>
          </div>

          <div className="grid grid-cols-7 gap-px mb-px">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <div key={i} className="text-center font-mono text-[9px] text-muted py-1 uppercase tracking-[1px]">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="bg-bg min-h-[66px]" />
              const acts = byDay.get(cell.iso) || []
              const isToday = cell.iso === todayISO()
              const isSelected = cell.iso === selectedDay
              // Determine if any activities are on archived fields only (grayed)
              const allGrayed = acts.length > 0 && acts.every((a) =>
                a.fieldIds.every((fid) => fields.find((f) => f.id === fid)?.archived))
              return (
                <button key={i}
                  onClick={() => setSelectedDay(cell.iso)}
                  onDoubleClick={() => openActivityForm({ date: cell.iso })}
                  className={`bg-bg min-h-[66px] p-1 text-left cursor-pointer transition-all border-0 flex flex-col gap-0.5
                    ${isSelected ? 'outline outline-2 -outline-offset-2 outline-olive-lit' : ''}
                    ${isToday ? 'bg-olive/10' : ''} hover:bg-olive/5 ${allGrayed ? 'opacity-50' : ''}`}
                  title="Clic : détail · Double-clic : ajouter">
                  <div className={`font-mono text-[10px] ${isToday ? 'text-olive-lit font-bold' : 'text-muted'}`}>{cell.day}</div>
                  <div className="flex flex-col gap-0.5">
                    {acts.slice(0, 3).map((a) => (
                      <div key={a.id} className={`font-mono text-[8px] truncate px-1 py-px border ${TYPE_COLOR[a.type]}`}
                        title={activityLabel(a)}>
                        {TYPE_LABELS[a.type]}
                      </div>
                    ))}
                    {acts.length > 3 && <div className="font-mono text-[8px] text-muted">+{acts.length - 3}</div>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="mt-4 border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-[10px] text-olive-lit tracking-[2px] uppercase">
                  {new Date(selectedDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ({dayActivities.length})
                </div>
              </div>
              <div className="flex gap-1 mb-1 flex-wrap">
                <button onClick={() => openActivityForm({ date: selectedDay, presetType: 'watering' })} className="btn-sm btn-cyan text-[10px] flex-1">💧 Arrosage</button>
                <button onClick={() => openActivityForm({ date: selectedDay, presetType: 'amendment' })} className="btn-sm btn-active text-[10px] flex-1">🌱 Amendement</button>
                <button onClick={() => openActivityForm({ date: selectedDay, presetType: 'expense' })} className="btn-sm btn-danger text-[10px] flex-1">💰 Dépense</button>
                <button onClick={() => openActivityForm({ date: selectedDay, presetType: 'salary' })} className="btn-sm text-[10px] border border-amber text-amber bg-amber/10 hover:bg-amber/20 cursor-pointer flex-1">👷 Salaire</button>
                <button onClick={() => openActivityForm({ date: selectedDay, presetType: 'other' })} className="btn-sm text-[10px] border border-border text-muted hover:text-text hover:border-olive cursor-pointer flex-1">✦ Autre</button>
              </div>
              <button onClick={() => openActivityForm({ date: selectedDay })} className="w-full btn-sm text-[10px] border border-olive-lit text-olive-lit bg-olive/10 hover:bg-olive/20 cursor-pointer mb-2">+ Ajouter une activité</button>
              {dayActivities.length ? (
                <div className="space-y-1">
                  {dayActivities.map((a) => <ActivityRow key={a.id} activity={a} />)}
                </div>
              ) : <div className="text-center text-muted text-xs py-3">Aucune activité ce jour.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ activity }: { activity: Activity }) {
  const store = useAppStore()
  const fields = activity.fieldIds.map((id) => store.fields.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => !!f)
  const allArchived = fields.length > 0 && fields.every((f) => f.archived)
  return (
    <div className={`border border-border p-2 hover:bg-olive/5 transition-colors ${allArchived ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`font-mono text-[9px] px-1.5 py-px border ${TYPE_COLOR[activity.type]}`}>{TYPE_LABELS[activity.type]}</span>
        <span className="font-mono text-xs text-text font-bold">{activityLabel(activity)}</span>
        {activity.type !== 'watering' && activity.type !== 'expense' && (
          <span className="font-mono text-[10px] text-muted">{activity.workerCount} ouvrier{activity.workerCount > 1 ? 's' : ''}</span>
        )}
        <button onClick={() => store.openActivityForm({ date: activity.date, editId: activity.id })} className="ml-auto text-muted hover:text-olive-lit bg-transparent border-none cursor-pointer text-[11px]" title="Modifier">✎</button>
        <button onClick={() => { if (confirm('Supprimer cette activité ?')) store.removeActivity(activity.id) }} className="text-muted hover:text-red bg-transparent border-none cursor-pointer text-xs" title="Supprimer">✕</button>
      </div>
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {fields.map((f) => (
            <span key={f.id} className={`font-mono text-[9px] px-1.5 py-px border border-border text-muted flex items-center gap-1 ${f.archived ? 'line-through opacity-70' : ''}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.color }} />{f.name}
            </span>
          ))}
        </div>
      )}
      {activity.type === 'watering' && activity.watering && (
        <div className="font-mono text-[10px] text-muted mt-1">
          {activity.watering.durationMin} min
          {activity.watering.flowRatePerHour ? ` · ${activity.watering.flowRatePerHour} L/h` : ''}
          {activity.watering.flowRatePerHour ? ` · ≈${(activity.watering.flowRatePerHour * activity.watering.durationMin / 60).toFixed(1)} L` : (activity.watering.volumeL ? ` · ${activity.watering.volumeL} L` : '')}
        </div>
      )}
      {activity.type === 'amendment' && activity.amendment && (
        <div className="font-mono text-[10px] text-muted mt-1">{activity.amendment.quantityKg} kg</div>
      )}
      {activity.type === 'salary' && activity.salary && (
        <div className="font-mono text-[10px] text-muted mt-1">
          {activity.salary.workerCount} ouvrier{activity.salary.workerCount > 1 ? 's' : ''} · {activity.salary.hourlyRate} DH/h · {activity.salary.duration === 'full' ? '8h (journée)' : '4h (½ journée)'}
        </div>
      )}
      {activity.notes && <div className="font-mono text-[10px] text-muted mt-1 border-t border-border/30 pt-1 italic">{activity.notes}</div>}
    </div>
  )
}
