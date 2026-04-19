import L from 'leaflet'
import { useAppStore } from '../store/useAppStore'
import { loadFromCloud, loadFromStorage } from './persistence'
import { createPointIcon, renderChampOnMap } from './mapRenderers'
import type { Field, Champ } from '../types'

/**
 * Hydrate the app from its last persisted snapshot (Supabase first, localStorage
 * fallback). Recreates the Leaflet layers for the exploitation, each field and
 * each champ outline, then pushes the result into the Zustand store.
 *
 * Call once on map mount — relies on the map singleton being set via setMap()
 * before any renderChampOnMap() call inside.
 */
export async function restorePersistedData(map: L.Map, userId?: string): Promise<void> {
  const saved = (userId ? await loadFromCloud(userId) : null) ?? loadFromStorage()
  if (!saved) return

  const store = useAppStore.getState()

  // Restore config
  if (saved.generationMethod) store.setGenerationMethod(saved.generationMethod)
  if (saved.density) store.setDensity(saved.density)

  // Restore exploitation
  if (saved.exploitPolygon && saved.exploitPolygon.length > 0) {
    const leafletLatLngs = saved.exploitPolygon.map((ll) => L.latLng(ll.lat, ll.lng))
    const layer = L.polygon(leafletLatLngs, {
      color: '#4fa8a0', weight: 3, fillColor: '#4fa8a0', fillOpacity: 0.06, dashArray: '8 4',
    }).addTo(map)

    const center = layer.getBounds().getCenter()
    const label = L.marker(center, {
      icon: L.divIcon({
        html: '<div style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;color:#4fa8a0;text-shadow:0 0 6px #000,0 0 12px #000;white-space:nowrap">EXPLOITATION</div>',
        iconSize: [0, 0], className: '',
      }),
    }).addTo(map)

    store.setExploitation(saved.exploitPolygon, saved.exploitArea, layer, label)
    // Respect the hidden-by-default state
    if (store.exploitContourHidden) {
      layer.remove()
      label.remove()
    }
  }

  // Restore fields
  if (saved.fields && saved.fields.length > 0) {
    saved.fields.forEach((sf) => {
      const leafletLatLngs = sf.latlngs.map((ll) => L.latLng(ll.lat, ll.lng))
      const layer = L.polygon(leafletLatLngs, {
        color: sf.color, weight: 2, fillColor: sf.color, fillOpacity: 0.15,
      })

      layer.on('click', () => {
        useAppStore.getState().openFieldDetail(sf.id)
        useAppStore.getState().setMobileRightOpen(true)
      })

      const center = layer.getBounds().getCenter()
      const labelMarker = L.marker(center, {
        icon: L.divIcon({
          html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;color:${sf.color};text-shadow:0 0 4px #000,0 0 8px #000;white-space:nowrap">${sf.name}</div>`,
          iconSize: [0, 0], className: '',
        }),
      })

      // Restore point markers
      const pointMarkers = sf.points.map((pt) => {
        return L.marker([pt.lat, pt.lng], { icon: createPointIcon(sf.color, pt.label) })
          .bindPopup(`<b>${pt.label}</b><br>${sf.name}<br>Lat: ${pt.lat.toFixed(6)}<br>Lng: ${pt.lng.toFixed(6)}${pt.notes ? `<br><i>${pt.notes}</i>` : ''}`)
      })

      // Add to map based on archived state:
      // - active zone → full render (layer + label + points)
      // - archived zone + archivedVisible → layer + label with dashed/faded style, no points
      // - archived zone + !archivedVisible → nothing on map
      if (!sf.archived) {
        layer.addTo(map)
        labelMarker.addTo(map)
        pointMarkers.forEach((m) => m.addTo(map))
      } else if (sf.archivedVisible) {
        layer.addTo(map)
        layer.setStyle({ dashArray: '6 6', fillOpacity: 0.05, opacity: 0.6 })
        labelMarker.addTo(map)
      }

      const field: Field = {
        id: sf.id,
        name: sf.name,
        color: sf.color,
        latlngs: sf.latlngs,
        area: sf.area,
        perimeter: sf.perimeter,
        points: sf.points,
        culture: sf.culture,
        assignedEmployees: sf.assignedEmployees || [],
        assignedManager: sf.assignedManager ?? null,
        relief: sf.relief,
        notes: sf.notes,
        archived: sf.archived,
        archivedAt: sf.archivedAt,
        archivedVisible: sf.archivedVisible,
        champId: sf.champId,
        batches: sf.batches,
        plaques: sf.plaques,
        climateMeasures: sf.climateMeasures,
        layer,
        labelMarker,
        pointMarkers,
      }

      store.addField(field)
    })

    // Restore counter
    if (saved.fieldIdCounter) {
      useAppStore.setState({ fieldIdCounter: saved.fieldIdCounter })
    }
  }

  // Restore champs — no outline polygon, just register and recolor parcelles
  if (saved.champs && saved.champs.length > 0) {
    saved.champs.forEach((sc) => {
      const champ: Champ = {
        id: sc.id, name: sc.name, color: sc.color,
        type: sc.type || 'champ',
        parcelleIds: sc.parcelleIds,
        customOutline: sc.customOutline,
        serreInfo: sc.serreInfo,
      }
      store.addChamp(champ)
    })
    if (saved.champIdCounter) {
      useAppStore.setState({ champIdCounter: saved.champIdCounter })
    }
    // Recolor parcelles per champ after all fields and champs are loaded
    saved.champs.forEach((sc) => {
      renderChampOnMap(sc.id)
    })
  }

  // Restore employees, strains, logs, agenda, activities
  useAppStore.setState({
    employees: saved.employees || [],
    employeeIdCounter: saved.employeeIdCounter || 0,
    strains: saved.strains || [],
    wateringLog: saved.wateringLog || [],
    wateringIdCounter: saved.wateringIdCounter || 0,
    amendmentLog: saved.amendmentLog || [],
    amendmentIdCounter: saved.amendmentIdCounter || 0,
    soilAnalyses: saved.soilAnalyses || [],
    soilAnalysisIdCounter: saved.soilAnalysisIdCounter || 0,
    agendaTasks: saved.agendaTasks || [],
    agendaIdCounter: saved.agendaIdCounter || 0,
    activities: saved.activities || [],
    activityIdCounter: saved.activityIdCounter || 0,
  })

  store.setStatus(saved.exploitPolygon ? (saved.fields.length > 0 ? 'DONNÉES RESTAURÉES' : 'AJOUTEZ VOS CHAMPS') : 'EN ATTENTE')
}
