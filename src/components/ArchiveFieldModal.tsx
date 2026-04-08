import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Activity, IrrigationMethod, AmendmentType } from '../types'

const IRRIGATION_LABELS: Record<IrrigationMethod, string> = { goutte_a_goutte: 'Goutte à goutte', aspersion: 'Aspersion', gravitaire: 'Gravitaire', manuel: 'Manuel' }
const AMENDMENT_LABELS: Record<AmendmentType, string> = { organique: 'Organique', mineral: 'Minéral', foliaire: 'Foliaire', correcteur: 'Correcteur' }

function activityLabel(a: Activity): string {
  if (a.type === 'watering' && a.watering) return `Arrosage — ${IRRIGATION_LABELS[a.watering.method]} (${a.watering.durationMin} min)`
  if (a.type === 'amendment' && a.amendment) return `${a.amendment.product} (${AMENDMENT_LABELS[a.amendment.type]}, ${a.amendment.quantityKg} kg)`
  return a.other?.title || 'Activité'
}

export function ArchiveFieldModal({ fieldId, onClose }: { fieldId: number; onClose: () => void }) {
  const field = useAppStore((s) => s.fields.find((f) => f.id === fieldId))
  const otherFields = useAppStore((s) => s.fields.filter((f) => f.id !== fieldId && !f.archived))
  const activities = useAppStore((s) => s.activities.filter((a) => a.fieldIds.includes(fieldId)))
  const archiveField = useAppStore((s) => s.archiveField)
  const toast = useAppStore((s) => s.toast)

  // Map activityId -> selected target field ids
  const [reassignMap, setReassignMap] = useState<Record<number, number[]>>({})

  if (!field) return null

  const toggle = (activityId: number, targetFieldId: number) => {
    setReassignMap((m) => {
      const current = m[activityId] || []
      const next = current.includes(targetFieldId) ? current.filter((x) => x !== targetFieldId) : [...current, targetFieldId]
      return { ...m, [activityId]: next }
    })
  }

  const handleConfirm = () => {
    const reassignments = Object.entries(reassignMap)
      .filter(([, targets]) => targets.length > 0)
      .map(([activityId, targets]) => ({ activityId: parseInt(activityId), targetFieldIds: targets }))
    archiveField(fieldId, reassignments)
    // Hide the field layer on the map
    if (field.layer) field.layer.remove()
    field.labelMarker?.remove()
    field.pointMarkers.forEach((m) => m.remove())
    toast(`✓ "${field.name}" archivée`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[10002] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-panel border border-border w-[92vw] max-w-[600px] max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <span className="font-mono text-sm text-amber tracking-[2px] uppercase flex-1">
            ◱ Archiver « {field.name} »
          </span>
          <button onClick={onClose} className="text-muted hover:text-red bg-transparent border-none text-lg cursor-pointer">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-xs text-muted leading-relaxed">
            La zone sera archivée : son contour sera conservé dans la section <span className="text-amber">Archives</span> et ne sera plus modifiable.
            Vous pouvez optionnellement <span className="text-olive-lit">réattribuer</span> certaines activités de l'historique de cette zone à d'autres zones actives
            (les activités restent aussi dans l'historique de la zone archivée).
          </div>

          {activities.length === 0 ? (
            <div className="text-center text-muted text-xs py-4 italic">Aucune activité à réattribuer.</div>
          ) : otherFields.length === 0 ? (
            <div className="text-center text-muted text-xs py-4 italic">Aucune autre zone active pour recevoir les activités.</div>
          ) : (
            <div className="space-y-2">
              <div className="font-mono text-[10px] text-olive-lit uppercase tracking-[1px]">Activités de la zone ({activities.length})</div>
              {activities.map((a) => (
                <div key={a.id} className="border border-border p-2.5 bg-bg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-[10px] text-muted">{a.date}</span>
                    <span className="font-mono text-xs text-text font-bold flex-1">{activityLabel(a)}</span>
                  </div>
                  <div className="text-[9px] text-muted uppercase tracking-[.5px] mb-1">Réattribuer à :</div>
                  <div className="flex flex-wrap gap-1">
                    {otherFields.map((f) => {
                      const on = (reassignMap[a.id] || []).includes(f.id)
                      return (
                        <button key={f.id} onClick={() => toggle(a.id, f.id)}
                          className={`font-mono text-[10px] px-2 py-1 border cursor-pointer transition-all flex items-center gap-1.5 ${on ? 'bg-olive border-olive-lit text-white' : 'bg-panel border-border text-muted hover:border-olive hover:text-olive-lit'}`}>
                          <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />
                          {f.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border shrink-0">
          <button onClick={onClose} className="flex-1 btn-danger text-[11px] py-2">Annuler</button>
          <button onClick={handleConfirm} className="flex-1 btn-active text-[11px] py-2">✓ Archiver</button>
        </div>
      </div>
    </div>
  )
}
