import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'

// ── Map singleton ─────────────────────────────────────────────
// The Leaflet map instance is owned by MapView's React lifecycle, but many
// other modules (FieldList, store callbacks, this module's renderers) need
// to imperatively add/remove layers. They access the map through getMap()
// instead of importing `globalMap` directly — that way the ownership stays
// clear and React remains the single writer via setMap()/clearMap().

let globalMap: L.Map | null = null

export function getMap(): L.Map | null {
  return globalMap
}

export function setMap(m: L.Map): void {
  globalMap = m
}

export function clearMap(): void {
  globalMap = null
}

// ── Sampling-point icon ───────────────────────────────────────

export function createPointIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    html: `<div class="point-marker" style="--pt-color:${color}">
      <svg width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="15" r="9" fill="#0d1117"/>
      </svg>
      <span class="point-label">${label}</span>
    </div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
    className: '',
  })
}

// ── Champ outline / re-coloring on the map ────────────────────

/**
 * Create or update the Leaflet layer for a champ on the map.
 * Recolors each parcelle with the champ color, then places a label at the
 * bounds center of all parcelles. Called after any change that affects a
 * champ's parcelles (add/remove, transfer, rename, custom outline reset).
 */
export function renderChampOnMap(champId: number): void {
  const map = globalMap
  if (!map) return
  const store = useAppStore.getState()
  const champ = store.champs.find((c) => c.id === champId)
  if (!champ) return

  // Remove old champ outline layer if any
  champ.layer?.remove()
  champ.labelMarker?.remove()

  const parcelles = store.fields.filter((f) => champ.parcelleIds.includes(f.id) && !f.archived)
  if (parcelles.length === 0) {
    store.setChampLayer(champId, undefined as unknown as L.Polygon, undefined as unknown as L.Marker)
    return
  }

  // Recolor each parcelle with the champ color
  const color = champ.color
  parcelles.forEach((f) => {
    store.updateField(f.id, { color })
    if (f.layer) {
      f.layer.setStyle({ color, fillColor: color, weight: 2, fillOpacity: 0.18 })
    }
    if (f.labelMarker) {
      f.labelMarker.setIcon(L.divIcon({
        html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;color:${color};text-shadow:0 0 4px #000,0 0 8px #000;white-space:nowrap">${f.name}</div>`,
        iconSize: [0, 0], className: '',
      }))
    }
  })

  // Place champ label at center of all parcelles bounds
  const allLatLngs = parcelles.flatMap((f) => f.latlngs.map((ll) => L.latLng(ll.lat, ll.lng)))
  const bounds = L.latLngBounds(allLatLngs)
  const center = bounds.getCenter()

  const labelMarker = L.marker(center, {
    zIndexOffset: 1000,
    icon: L.divIcon({
      html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700;color:${champ.color};text-shadow:0 0 6px #000,0 0 12px #000;white-space:nowrap;letter-spacing:1px;text-transform:uppercase;cursor:pointer">${champ.name}</div>`,
      iconSize: [0, 0], className: '',
    }),
  }).addTo(map)

  labelMarker.on('click', () => {
    useAppStore.getState().selectChamp(champId)
    useAppStore.getState().setMobileRightOpen(true)
  })

  // No champ outline polygon — parcelles themselves show the champ
  store.setChampLayer(champId, undefined as unknown as L.Polygon, labelMarker)
}
