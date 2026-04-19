import L from 'leaflet'
import 'leaflet-draw'
import { useAppStore } from '../store/useAppStore'
import { calcArea, calcPerimeter } from './geometry'
import { renderChampOnMap } from './mapRenderers'
import { triggerAutoReliefIfNeeded } from './relief-background'

// ── Active draw handler singleton ─────────────────────────────
// MapView owns the leaflet-draw handler's lifecycle (creation, disposal)
// via event wiring. This singleton gives Header buttons (Valider / Annuler)
// a way to complete or cancel the in-flight draw without reaching into
// MapView internals directly.

let globalDrawHandler: L.Draw.Polygon | null = null

export function setDrawHandler(h: L.Draw.Polygon | null): void {
  globalDrawHandler = h
}

// ── Draw controls ─────────────────────────────────────────────

/** Complete the current draw (validate the polygon). Called from Header. */
export function finishDraw(): void {
  if (globalDrawHandler) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { (globalDrawHandler as any).completeShape() } catch { /* not enough points */ }
  }
}

/** Cancel the current draw. Called from Header. */
export function cancelDraw(): void {
  useAppStore.getState().setDrawTarget(null)
  useAppStore.getState().setStatus('EN ATTENTE')
}

// ── Edit controls ─────────────────────────────────────────────

/** Validate exploit contour edit. */
function finishEditExploit(): void {
  const store = useAppStore.getState()
  if (store.exploitLayer) {
    const raw = store.exploitLayer.getLatLngs()[0] as L.LatLng[]
    const polygon = raw.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }))
    const area = calcArea(polygon) / 10000
    store.updateExploitPolygon(polygon, area)
    if (store.exploitLabel) {
      store.exploitLabel.setLatLng(store.exploitLayer.getBounds().getCenter())
    }
  }
  store.setEditTarget(null)
  store.toast('✓ Exploitation mise à jour')
}

/** Cancel exploit contour edit. */
function cancelEditExploit(): void {
  const store = useAppStore.getState()
  if (store.exploitLayer && store.exploitPolygon) {
    store.exploitLayer.setLatLngs(store.exploitPolygon.map((ll) => [ll.lat, ll.lng]))
  }
  store.setEditTarget(null)
}

/** Validate any contour edit (exploit, field, champ). Called from Header. */
export function finishEdit(): void {
  const store = useAppStore.getState()
  const et = store.editTarget
  if (!et) return

  if (et.type === 'exploit') {
    finishEditExploit()
  } else if (et.type === 'field') {
    const f = store.fields.find((fld) => fld.id === et.fieldId)
    if (f?.layer) {
      const raw = f.layer.getLatLngs()[0] as L.LatLng[]
      const latlngs = raw.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }))
      const area = calcArea(latlngs) / 10000
      const perimeter = calcPerimeter(raw)
      store.updateFieldPolygon(f.id, latlngs, area, perimeter)
      if (f.labelMarker) f.labelMarker.setLatLng(f.layer.getBounds().getCenter())
      if (f.champId) renderChampOnMap(f.champId)
      void triggerAutoReliefIfNeeded(f.id)
    }
    store.setEditTarget(null)
    store.toast('✓ Contour mis à jour')
  } else if (et.type === 'champ') {
    const champ = store.champs.find((c) => c.id === et.champId)
    if (champ?.layer) {
      const raw = champ.layer.getLatLngs()[0] as L.LatLng[]
      const outline = raw.map((ll: L.LatLng) => ({ lat: ll.lat, lng: ll.lng }))
      store.setChampCustomOutline(champ.id, outline)
      if (champ.labelMarker) champ.labelMarker.setLatLng(champ.layer.getBounds().getCenter())
    }
    store.setEditTarget(null)
    store.toast('✓ Contour du champ mis à jour')
  }
}

/** Cancel any contour edit (exploit, field, champ). Called from Header. */
export function cancelEdit(): void {
  const store = useAppStore.getState()
  const et = store.editTarget
  if (!et) return

  if (et.type === 'exploit') {
    cancelEditExploit()
  } else if (et.type === 'field') {
    const f = store.fields.find((fld) => fld.id === et.fieldId)
    if (f?.layer) f.layer.setLatLngs(f.latlngs.map((ll) => [ll.lat, ll.lng]))
    store.setEditTarget(null)
  } else if (et.type === 'champ') {
    const champ = store.champs.find((c) => c.id === et.champId)
    if (champ) renderChampOnMap(champ.id)
    store.setEditTarget(null)
  }
}
