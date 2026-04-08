import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { ActivityType, IrrigationMethod, AmendmentType } from '../types'

const IRRIGATION_LABELS: Record<IrrigationMethod, string> = { goutte_a_goutte: 'Goutte à goutte', aspersion: 'Aspersion', gravitaire: 'Gravitaire', manuel: 'Manuel' }
const AMENDMENT_LABELS: Record<AmendmentType, string> = { organique: 'Organique', mineral: 'Minéral', foliaire: 'Foliaire', correcteur: 'Correcteur' }

function todayISO() { return new Date().toISOString().slice(0, 10) }

export function ActivityForm() {
  const open = useAppStore((s) => s.activityFormOpen)
  const close = useAppStore((s) => s.closeActivityForm)
  const initialDate = useAppStore((s) => s.activityFormDate)
  const editId = useAppStore((s) => s.activityFormEditId)
  const presetType = useAppStore((s) => s.activityFormPresetType)
  const presetFieldId = useAppStore((s) => s.activityFormPresetFieldId)
  const activities = useAppStore((s) => s.activities)
  const addActivity = useAppStore((s) => s.addActivity)
  const updateActivity = useAppStore((s) => s.updateActivity)
  const toast = useAppStore((s) => s.toast)
  const fields = useAppStore((s) => s.fields).filter((f) => !f.archived)

  const [type, setType] = useState<ActivityType>('watering')
  const [date, setDate] = useState(todayISO())
  const [fieldIds, setFieldIds] = useState<number[]>([])
  const [workerCount, setWorkerCount] = useState(1)
  const [notes, setNotes] = useState('')
  // Watering
  const [wMethod, setWMethod] = useState<IrrigationMethod>('goutte_a_goutte')
  const [wDuration, setWDuration] = useState(30)
  const [wFlowRate, setWFlowRate] = useState('')
  // Amendment
  const [aType, setAType] = useState<AmendmentType>('organique')
  const [aCustomType, setACustomType] = useState('')
  const [aProduct, setAProduct] = useState('')
  const [aQty, setAQty] = useState(10)
  // Other
  const [otherTitle, setOtherTitle] = useState('')

  // Initialize/reset when form opens
  useEffect(() => {
    if (!open) return
    if (editId != null) {
      const a = activities.find((x) => x.id === editId)
      if (a) {
        setType(a.type)
        setDate(a.date)
        setFieldIds([...a.fieldIds])
        setWorkerCount(a.workerCount)
        setNotes(a.notes || '')
        if (a.watering) {
          setWMethod(a.watering.method)
          setWDuration(a.watering.durationMin)
          setWFlowRate(a.watering.flowRatePerHour != null ? String(a.watering.flowRatePerHour) : '')
        }
        if (a.amendment) {
          setAType(a.amendment.type)
          setACustomType(a.amendment.customType || '')
          setAProduct(a.amendment.product)
          setAQty(a.amendment.quantityKg)
        }
        if (a.other) { setOtherTitle(a.other.title) }
        return
      }
    }
    // New
    setType(presetType || 'watering')
    setDate(initialDate || todayISO())
    setFieldIds(presetFieldId ? [presetFieldId] : [])
    setWorkerCount(1); setNotes('')
    setWMethod('goutte_a_goutte'); setWDuration(30); setWFlowRate('')
    setAType('organique'); setACustomType(''); setAProduct(''); setAQty(10)
    setOtherTitle('')
  }, [open, editId, initialDate, presetType, presetFieldId])

  if (!open) return null

  const toggleField = (id: number) => setFieldIds(fieldIds.includes(id) ? fieldIds.filter((x) => x !== id) : [...fieldIds, id])

  const handleSubmit = () => {
    if (!fieldIds.length) { toast('⚠ Sélectionnez au moins une zone', true); return }
    if (type !== 'watering' && workerCount < 1) { toast('⚠ Au moins 1 ouvrier', true); return }
    if (type === 'amendment' && !aProduct.trim()) { toast('⚠ Nom du produit requis', true); return }
    if (type === 'other' && !otherTitle.trim()) { toast('⚠ Titre de l\'activité requis', true); return }

    const payload = {
      date, type, fieldIds,
      // Watering n'a pas d'ouvriers — on stocke 0 pour cohérence du schéma
      workerCount: type === 'watering' ? 0 : workerCount,
      notes: notes.trim() || undefined,
      watering: type === 'watering' ? {
        method: wMethod,
        durationMin: wDuration,
        flowRatePerHour: wFlowRate ? parseFloat(wFlowRate) : undefined,
      } : undefined,
      amendment: type === 'amendment' ? {
        type: aType,
        customType: aCustomType.trim() || undefined,
        product: aProduct.trim(),
        quantityKg: aQty,
      } : undefined,
      other: type === 'other' ? { title: otherTitle.trim() } : undefined,
    }

    if (editId != null) {
      updateActivity(editId, payload)
      toast('✓ Activité mise à jour')
    } else {
      addActivity(payload)
      toast('✓ Activité enregistrée')
    }
    close()
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[10001] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="bg-panel border border-border w-[92vw] max-w-[560px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <span className="font-mono text-sm text-olive-lit tracking-[2px] uppercase flex-1">
            {editId != null ? '✎ Modifier l\'activité' : '+ Nouvelle activité'}
          </span>
          <button onClick={close} className="text-muted hover:text-red bg-transparent border-none text-lg cursor-pointer">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type */}
          <div>
            <div className="font-mono text-[9px] text-muted uppercase tracking-[1px] mb-1">Type d'activité</div>
            <div className="flex gap-1">
              {(['watering', 'amendment', 'other'] as ActivityType[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 font-mono text-[11px] px-2 py-1.5 border cursor-pointer transition-all ${type === t ? 'bg-olive border-olive-lit text-white' : 'bg-bg border-border text-muted hover:text-text'}`}>
                  {t === 'watering' ? 'Arrosage' : t === 'amendment' ? 'Engrais' : 'Autre'}
                </button>
              ))}
            </div>
          </div>

          {/* Date + (workers if not watering) */}
          <div className={`grid gap-3 ${type === 'watering' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div>
              <div className="font-mono text-[9px] text-muted uppercase tracking-[1px] mb-1">Date</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full font-mono text-xs bg-bg border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
            </div>
            {type !== 'watering' && (
              <div>
                <div className="font-mono text-[9px] text-muted uppercase tracking-[1px] mb-1">Nombre d'ouvriers</div>
                <input type="number" min={1} value={workerCount} onChange={(e) => setWorkerCount(parseInt(e.target.value) || 1)}
                  className="w-full font-mono text-xs bg-bg border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit" />
              </div>
            )}
          </div>

          {/* Zones */}
          <div>
            <div className="font-mono text-[9px] text-muted uppercase tracking-[1px] mb-1">Zones concernées</div>
            {fields.length ? (
              <div className="flex flex-wrap gap-1">
                {fields.map((f) => {
                  const on = fieldIds.includes(f.id)
                  return (
                    <button key={f.id} onClick={() => toggleField(f.id)}
                      className={`font-mono text-[10px] px-2 py-1 border cursor-pointer transition-all flex items-center gap-1.5 ${on ? 'bg-olive border-olive-lit text-white' : 'bg-bg border-border text-muted hover:border-olive hover:text-olive-lit'}`}>
                      <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />{f.name}
                    </button>
                  )
                })}
              </div>
            ) : <div className="text-[10px] text-muted italic">Aucune zone active.</div>}
          </div>

          {/* Type-specific fields */}
          {type === 'watering' && (
            <div className="bg-bg border border-border p-3 space-y-2">
              <div className="font-mono text-[9px] text-muted uppercase tracking-[1px]">Arrosage</div>
              <select value={wMethod} onChange={(e) => setWMethod(e.target.value as IrrigationMethod)}
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit">
                {Object.entries(IRRIGATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-mono text-[9px] text-muted uppercase tracking-[.5px] mb-1">Temps d'arrosage</div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} value={wDuration} onChange={(e) => setWDuration(parseInt(e.target.value) || 0)}
                      className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit w-0" />
                    <span className="text-[9px] text-muted shrink-0">min</span>
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] text-muted uppercase tracking-[.5px] mb-1">Débit</div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} step="0.1" value={wFlowRate} onChange={(e) => setWFlowRate(e.target.value)} placeholder="—"
                      className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted w-0" />
                    <span className="text-[9px] text-muted shrink-0">L/h</span>
                  </div>
                </div>
              </div>
              {wFlowRate && wDuration > 0 && (
                <div className="font-mono text-[10px] text-muted">
                  Volume estimé: <span className="text-cyan">{((parseFloat(wFlowRate) || 0) * wDuration / 60).toFixed(1)} L</span>
                </div>
              )}
            </div>
          )}

          {type === 'amendment' && (
            <div className="bg-bg border border-border p-3 space-y-2">
              <div className="font-mono text-[9px] text-muted uppercase tracking-[1px]">Engrais</div>
              <div className="grid grid-cols-2 gap-2">
                <select value={aType} onChange={(e) => setAType(e.target.value as AmendmentType)}
                  className="font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit">
                  {Object.entries(AMENDMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} value={aQty} onChange={(e) => setAQty(parseFloat(e.target.value) || 0)}
                    className="flex-1 font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit w-0" />
                  <span className="text-[9px] text-muted shrink-0">kg</span>
                </div>
              </div>
              <input type="text" value={aCustomType} onChange={(e) => setACustomType(e.target.value)} placeholder="Type d'engrais (ex: NPK 15-15-15, fumier composté…)"
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
              <input type="text" value={aProduct} onChange={(e) => setAProduct(e.target.value)} placeholder="Nom du produit / marque"
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
            </div>
          )}

          {type === 'other' && (
            <div className="bg-bg border border-border p-3 space-y-2">
              <div className="font-mono text-[9px] text-muted uppercase tracking-[1px]">Activité personnalisée</div>
              <input type="text" value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} placeholder="Ex: Désherbage, Taille, Récolte..."
                className="w-full font-mono text-xs bg-panel border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted" />
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="font-mono text-[9px] text-muted uppercase tracking-[1px] mb-1">Notes</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Notes complémentaires (optionnel)"
              className="w-full font-mono text-xs bg-bg border border-border text-text py-1.5 px-2 outline-none focus:border-olive-lit placeholder:text-muted resize-none" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={close} className="flex-1 btn-danger text-[11px] py-2">Annuler</button>
            <button onClick={handleSubmit} className="flex-1 btn-active text-[11px] py-2">
              {editId != null ? '✓ Mettre à jour' : '+ Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
