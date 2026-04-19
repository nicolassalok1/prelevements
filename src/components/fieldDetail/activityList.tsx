import { useAppStore } from '../../store/useAppStore'
import { useField, Empty, Label, IRRIGATION_LABELS, AMENDMENT_LABELS } from './shared'

export type ListableActivityType = 'watering' | 'amendment' | 'other'

export function QuickAddActivityButton({ fieldId, type, disabled }: { fieldId: number; type: ListableActivityType; disabled?: boolean }) {
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

export function ActivityList({ fieldId, type, showEmpty }: { fieldId: number; type: ListableActivityType; showEmpty?: boolean }) {
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
