import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import { useAppStore, FIELD_COLORS } from '../store/useAppStore'
import { calcArea, calcPerimeter, isInsidePolygon, computeChampOutline } from '../utils/geometry'
import { loadFromStorage } from '../utils/persistence'
import { triggerAutoReliefIfNeeded } from '../utils/relief-background'
import { GeolocationControl } from './GeolocationControl'
import type { LatLng, Field, UserLocation, Champ } from '../types'

// Module-level ref so other components can interact with the map programmatically.
// Use getMap() to access it — don't read `globalMap` directly from other modules.
let globalMap: L.Map | null = null
// Guards against React StrictMode double-mount duplicating persisted data into the store.
let persistedDataRestored = false

export function getMap(): L.Map | null {
  return globalMap
}

export function addPointFromCoords(fieldId: number, lat: number, lng: number, notes?: string): { ok: boolean; error?: string } {
  const map = globalMap
  if (!map) return { ok: false, error: 'Carte non prête' }
  const store = useAppStore.getState()
  const field = store.fields.find((f) => f.id === fieldId)
  if (!field) return { ok: false, error: 'Champ introuvable' }
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { ok: false, error: 'Coordonnées invalides' }
  if (!isInsidePolygon({ lat, lng }, field.latlngs)) return { ok: false, error: 'Point hors du champ' }

  const ptNum = field.points.length + 1
  const label = 'P' + String(ptNum).padStart(3, '0')
  const icon = createPointIcon(field.color, label)
  const marker = L.marker([lat, lng], { icon })
    .addTo(map)
    .bindPopup(`<b>${label}</b><br>${field.name}<br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}${notes ? `<br><i>${notes}</i>` : ''}`)

  store.addManualPoint(fieldId, { label, lat, lng, notes: notes || undefined }, marker)
  return { ok: true }
}

/**
 * Add a sampling point at the user's current GPS position.
 * Captures altitude and accuracy if provided by the device.
 */
export function addPointFromUserLocation(fieldId: number, loc: UserLocation, notes?: string): { ok: boolean; error?: string } {
  const map = globalMap
  if (!map) return { ok: false, error: 'Carte non prête' }
  const store = useAppStore.getState()
  const field = store.fields.find((f) => f.id === fieldId)
  if (!field) return { ok: false, error: 'Champ introuvable' }
  if (!isInsidePolygon({ lat: loc.lat, lng: loc.lng }, field.latlngs)) {
    return { ok: false, error: 'Vous êtes hors du champ' }
  }

  const ptNum = field.points.length + 1
  const label = 'P' + String(ptNum).padStart(3, '0')
  const icon = createPointIcon(field.color, label)
  const altText = loc.altitude != null
    ? `<br>Alt: ${loc.altitude.toFixed(1)} m${loc.altitudeAccuracy != null ? ` (±${loc.altitudeAccuracy.toFixed(0)} m)` : ''}`
    : ''
  const marker = L.marker([loc.lat, loc.lng], { icon })
    .addTo(map)
    .bindPopup(`<b>${label}</b><br>${field.name}<br>Lat: ${loc.lat.toFixed(6)}<br>Lng: ${loc.lng.toFixed(6)}${altText}<br>Précision: ±${loc.accuracy.toFixed(0)} m${notes ? `<br><i>${notes}</i>` : ''}`)

  store.addManualPoint(fieldId, {
    label,
    lat: loc.lat,
    lng: loc.lng,
    notes: notes || undefined,
    altitude: loc.altitude ?? undefined,
    altitudeAccuracy: loc.altitudeAccuracy ?? undefined,
    accuracy: loc.accuracy,
  }, marker)
  return { ok: true }
}

export function MapView() {
  const mapRef = useRef<L.Map | null>(null)
  const drawnRef = useRef<L.FeatureGroup | null>(null)
  const drawHandlerRef = useRef<L.Draw.Polygon | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const drawTarget = useAppStore((s) => s.drawTarget)
  const drawTargetRef = useRef(drawTarget)
  drawTargetRef.current = drawTarget

  const editTarget = useAppStore((s) => s.editTarget)
  const addPointFieldId = useAppStore((s) => s.addPointFieldId)
  const userLocation = useAppStore((s) => s.userLocation)
  const exploitContourHidden = useAppStore((s) => s.exploitContourHidden)

  // Show/hide the exploitation outline on the map when the toggle changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const { exploitLayer, exploitLabel } = useAppStore.getState()
    if (!exploitLayer) return
    if (exploitContourHidden) {
      exploitLayer.remove()
      exploitLabel?.remove()
    } else {
      if (!map.hasLayer(exploitLayer)) exploitLayer.addTo(map)
      if (exploitLabel && !map.hasLayer(exploitLabel)) exploitLabel.addTo(map)
    }
  }, [exploitContourHidden])

  // User location layer refs
  const userMarkerRef = useRef<L.Marker | null>(null)
  const accuracyCircleRef = useRef<L.Circle | null>(null)
  const firstFixRef = useRef(true)

  // Crosshair cursor when in add-point mode
  useEffect(() => {
    if (addPointFieldId) {
      containerRef.current?.classList.add('cursor-crosshair')
      const field = useAppStore.getState().fields.find((f) => f.id === addPointFieldId)
      if (field) useAppStore.getState().setStatus(`AJOUT POINT — cliquez dans "${field.name}"`)
    } else {
      if (!drawTarget) containerRef.current?.classList.remove('cursor-crosshair')
    }
  }, [addPointFieldId, drawTarget])

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [34.9615, -4.6181],
      zoom: 17,
      maxZoom: 22,
      zoomControl: true,
    })

    // ── Single base layer: Google Satellite ──
    // No layer selector — Esri and the old dark tiles were removed.
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: '© Google',
      maxZoom: 22,
      maxNativeZoom: 22,
    }).addTo(map)

    const drawnItems = new L.FeatureGroup().addTo(map)
    drawnRef.current = drawnItems

    // Add draw control (hidden) for internal use
    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems, edit: false, remove: false },
      draw: {
        polygon: { shapeOptions: {} },
        rectangle: false, circle: false, marker: false, polyline: false, circlemarker: false,
      },
    })
    map.addControl(drawControl)

    // Handle polygon creation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const target = drawTargetRef.current
      const store = useAppStore.getState()
      store.setDrawTarget(null)
      stopDraw()

      if (target === 'exploit') {
        handleExploitCreated(e.layer as L.Polygon, map)
      } else if (target === 'field') {
        handleFieldCreated(e.layer as L.Polygon, map)
      }
    })

    // Manual point placement on map click
    map.on('click', (e: L.LeafletMouseEvent) => {
      const store = useAppStore.getState()
      const fieldId = store.addPointFieldId
      if (!fieldId) return

      const field = store.fields.find((f) => f.id === fieldId)
      if (!field) return

      const latlng = e.latlng
      // Check point is inside the field polygon
      if (!isInsidePolygon({ lat: latlng.lat, lng: latlng.lng }, field.latlngs)) {
        store.toast('⚠ Point hors du champ', true)
        return
      }

      // Read notes from the sidebar input (if present)
      const notesInput = document.getElementById('point-notes-input') as HTMLInputElement | null
      const notes = notesInput?.value.trim() || undefined

      const ptNum = field.points.length + 1
      const label = 'P' + String(ptNum).padStart(3, '0')

      const icon = createPointIcon(field.color, label)

      const marker = L.marker(latlng, { icon })
        .addTo(map)
        .bindPopup(`<b>${label}</b><br>${field.name}<br>Lat: ${latlng.lat.toFixed(6)}<br>Lng: ${latlng.lng.toFixed(6)}${notes ? `<br><i>${notes}</i>` : ''}`)

      store.addManualPoint(fieldId, { label, lat: latlng.lat, lng: latlng.lng, notes }, marker)
      store.toast(`✓ ${label} ajouté dans "${field.name}"`)
      if (notesInput) notesInput.value = ''
    })

    mapRef.current = map
    globalMap = map

    // Reset map-bound store state before restoring. This prevents StrictMode's
    // double-mount from duplicating fields (the Zustand store outlives the
    // component, and the previous mount's leaflet layers are dead after map.remove()).
    if (persistedDataRestored) {
      useAppStore.setState({
        fields: [], fieldIdCounter: 0, selectedFieldId: null,
        champs: [], champIdCounter: 0, selectedChampId: null,
        exploitPolygon: null, exploitArea: 0, exploitLayer: null, exploitLabel: null,
      })
    }
    restorePersistedData(map)
    persistedDataRestored = true

    return () => {
      map.remove()
      mapRef.current = null
      globalMap = null
    }
  }, [])

  // React to drawTarget changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    stopDraw()

    if (drawTarget === 'exploit') {
      containerRef.current?.classList.add('cursor-crosshair')
      const handler = new L.Draw.Polygon(map as any, {
        shapeOptions: { color: '#4fa8a0', weight: 3, fillColor: '#4fa8a0', fillOpacity: 0.06, dashArray: '8 4' },
      })
      handler.enable()
      drawHandlerRef.current = handler
    } else if (drawTarget === 'field') {
      containerRef.current?.classList.add('cursor-crosshair')
      const store = useAppStore.getState()
      const color = FIELD_COLORS[store.fieldIdCounter % FIELD_COLORS.length]
      const handler = new L.Draw.Polygon(map as any, {
        shapeOptions: { color, weight: 2, fillColor: color, fillOpacity: 0.15 },
      })
      handler.enable()
      drawHandlerRef.current = handler
    } else {
      containerRef.current?.classList.remove('cursor-crosshair')
    }
  }, [drawTarget])

  // Edit mode: enable/disable vertex editing on polygons
  useEffect(() => {
    const store = useAppStore.getState()

    // Disable editing on all polygons first
    if (store.exploitLayer) {
      (store.exploitLayer as any).editing?.disable()
      store.exploitLayer.setStyle({ dashArray: '8 4' })
    }
    store.fields.forEach((f) => {
      if (f.layer) {
        (f.layer as any).editing?.disable()
        f.layer.setStyle({ weight: 2 })
      }
    })
    store.champs.forEach((c) => {
      if (c.layer) {
        (c.layer as any).editing?.disable()
        c.layer.setStyle({ weight: 3, dashArray: '10 6' })
      }
    })

    if (!editTarget) {
      store.setStatus(store.fields.length > 0 ? 'EN ATTENTE' : store.exploitPolygon ? 'AJOUTEZ VOS PARCELLES' : 'EN ATTENTE')
      return
    }

    if (editTarget.type === 'exploit' && store.exploitLayer) {
      (store.exploitLayer as any).editing?.enable()
      store.exploitLayer.setStyle({ dashArray: '', weight: 4 })
      store.setStatus('ÉDITION EXPLOITATION — déplacez les sommets puis cliquez Valider')
    } else if (editTarget.type === 'field') {
      const field = store.fields.find((f) => f.id === editTarget.fieldId)
      if (field?.layer) {
        (field.layer as any).editing?.enable()
        field.layer.setStyle({ weight: 4 })
        store.setStatus(`ÉDITION "${field.name.toUpperCase()}" — déplacez les sommets`)
      }
    } else if (editTarget.type === 'champ') {
      const champ = store.champs.find((c) => c.id === editTarget.champId)
      if (champ?.layer) {
        (champ.layer as any).editing?.enable()
        champ.layer.setStyle({ weight: 4, dashArray: '' })
        store.setStatus(`ÉDITION CONTOUR "${champ.name.toUpperCase()}" — déplacez les sommets`)
      }
    }
  }, [editTarget])

  // React to user location updates: render/update the blue marker and accuracy circle
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!userLocation) {
      // Cleanup when geolocation is disabled
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      accuracyCircleRef.current?.remove()
      accuracyCircleRef.current = null
      firstFixRef.current = true
      return
    }

    const latlng: [number, number] = [userLocation.lat, userLocation.lng]

    if (!userMarkerRef.current) {
      const icon = L.divIcon({
        html: '<div class="user-location-marker"><div class="user-location-pulse"></div><div class="user-location-dot"></div></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        className: '',
      })
      userMarkerRef.current = L.marker(latlng, { icon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map)
    } else {
      userMarkerRef.current.setLatLng(latlng)
    }

    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(latlng, {
        radius: userLocation.accuracy,
        color: '#3b82f6',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(map)
    } else {
      accuracyCircleRef.current.setLatLng(latlng)
      accuracyCircleRef.current.setRadius(userLocation.accuracy)
    }

    // Auto-zoom on first fix only
    if (firstFixRef.current) {
      firstFixRef.current = false
      map.setView(latlng, Math.max(map.getZoom(), 18), { animate: true })
    }
  }, [userLocation])

  function stopDraw() {
    if (drawHandlerRef.current) {
      try { drawHandlerRef.current.disable() } catch { /* ignore */ }
      drawHandlerRef.current = null
    }
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full bg-bg" />
      <GeolocationControl />
    </div>
  )
}

// ── Handlers ──

function handleExploitCreated(layer: L.Polygon, map: L.Map) {
  const store = useAppStore.getState()

  // Remove old exploitation
  if (store.exploitLayer) {
    store.exploitLayer.remove()
    store.exploitLabel?.remove()
  }

  layer.setStyle({ color: '#4fa8a0', weight: 3, fillColor: '#4fa8a0', fillOpacity: 0.06, dashArray: '8 4' })
  layer.addTo(map)

  const rawLatLngs = layer.getLatLngs()[0] as L.LatLng[]
  const polygon: LatLng[] = rawLatLngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }))
  const area = calcArea(polygon) / 10000

  const center = layer.getBounds().getCenter()
  const label = L.marker(center, {
    icon: L.divIcon({
      html: '<div style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;color:#4fa8a0;text-shadow:0 0 6px #000,0 0 12px #000;white-space:nowrap">EXPLOITATION</div>',
      iconSize: [0, 0],
      className: '',
    }),
  }).addTo(map)

  store.setExploitation(polygon, area, layer, label)
  store.setStatus('AJOUTEZ VOS CHAMPS')
  store.toast(`✓ Exploitation définie — ${area.toFixed(2)} ha`)
}

function handleFieldCreated(layer: L.Polygon, map: L.Map) {
  const store = useAppStore.getState()

  const input = document.getElementById('field-name-input') as HTMLInputElement
  const name = input?.value.trim() || `Parcelle ${store.fieldIdCounter + 1}`

  const rawLatLngs = layer.getLatLngs()[0] as L.LatLng[]
  const latlngs: LatLng[] = rawLatLngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }))

  // Validate inside exploitation
  if (store.exploitPolygon) {
    const outside = latlngs.filter((ll) => !isInsidePolygon(ll, store.exploitPolygon!))
    if (outside.length > 0) {
      store.toast('⚠ La parcelle doit être entièrement dans l\'exploitation !', true)
      store.setStatus('PARCELLE REJETÉE — hors exploitation')
      return
    }
  }

  const color = FIELD_COLORS[store.fieldIdCounter % FIELD_COLORS.length]
  layer.setStyle({ color, weight: 2, fillColor: color, fillOpacity: 0.15 })
  layer.addTo(map)

  const fieldId = store.fieldIdCounter + 1
  layer.on('click', () => {
      useAppStore.getState().selectField(fieldId)
      document.getElementById('field-card-' + fieldId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })

  const area = calcArea(latlngs) / 10000
  const perimeter = calcPerimeter(rawLatLngs)

  const center = layer.getBounds().getCenter()
  const labelMarker = L.marker(center, {
    icon: L.divIcon({
      html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;color:${color};text-shadow:0 0 4px #000,0 0 8px #000;white-space:nowrap">${name}</div>`,
      iconSize: [0, 0],
      className: '',
    }),
  }).addTo(map)

  const field: Field = {
    id: fieldId,
    name,
    color,
    latlngs,
    area,
    perimeter,
    points: [],
    assignedEmployees: [],
    assignedManager: null,
    layer,
    labelMarker,
    pointMarkers: [],
  }

  store.addField(field)
  if (input) input.value = ''

  // Auto-assign to champ if drawing was triggered from a ChampCard
  const champId = store.drawForChampId
  if (champId) {
    store.addParcelleToChamp(champId, fieldId)
    store.setDrawForChampId(null)
    // Rebuild champ outline after the new parcelle is added
    setTimeout(() => renderChampOnMap(champId), 50)
    store.setStatus(`PARCELLE "${name.toUpperCase()}" AJOUTÉE AU CHAMP`)
    store.toast(`✓ "${name}" ajouté au champ — ${area.toFixed(2)} ha`)
  } else {
    store.setStatus(`PARCELLE "${name.toUpperCase()}" AJOUTÉE`)
    store.toast(`✓ "${name}" ajouté — ${area.toFixed(2)} ha`)
  }

  // Background auto-compute relief (altitude, slope, exposition, sunshine)
  // for the newly created field. Silently skipped if offline.
  void triggerAutoReliefIfNeeded(field.id)
}

// ── Point icon ──

function createPointIcon(color: string, label: string) {
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

// ── Champ outline helpers ──

/**
 * Create or update the Leaflet layer for a champ on the map.
 * Uses customOutline if set, otherwise auto-computes convex hull from parcelles.
 */
export function renderChampOnMap(champId: number) {
  const map = globalMap
  if (!map) return
  const store = useAppStore.getState()
  const champ = store.champs.find((c) => c.id === champId)
  if (!champ) return

  champ.layer?.remove()
  champ.labelMarker?.remove()

  const parcelles = store.fields.filter((f) => champ.parcelleIds.includes(f.id) && !f.archived)
  if (parcelles.length === 0) {
    store.setChampLayer(champId, undefined as unknown as L.Polygon, undefined as unknown as L.Marker)
    return
  }

  const outline = champ.customOutline ?? computeChampOutline(parcelles.map((p) => p.latlngs))
  if (outline.length < 3) return

  const leafletLatLngs = outline.map((ll) => L.latLng(ll.lat, ll.lng))
  const layer = L.polygon(leafletLatLngs, {
    color: champ.color, weight: 3, fillColor: champ.color, fillOpacity: 0.04, dashArray: '10 6',
  }).addTo(map)

  layer.on('click', () => { useAppStore.getState().selectChamp(champId) })

  const center = layer.getBounds().getCenter()
  const labelMarker = L.marker(center, {
    icon: L.divIcon({
      html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;color:${champ.color};text-shadow:0 0 6px #000,0 0 12px #000;white-space:nowrap;letter-spacing:1px">${champ.name}</div>`,
      iconSize: [0, 0], className: '',
    }),
  }).addTo(map)

  store.setChampLayer(champId, layer, labelMarker)
}

// ── Restore persisted data ──

function restorePersistedData(map: L.Map) {
  const saved = loadFromStorage()
  if (!saved) return

  const store = useAppStore.getState()

  // Restore config
  if (saved.generationMethod) store.setGenerationMethod(saved.generationMethod as any)
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
  }

  // Restore fields
  if (saved.fields && saved.fields.length > 0) {
    saved.fields.forEach((sf) => {
      const leafletLatLngs = sf.latlngs.map((ll) => L.latLng(ll.lat, ll.lng))
      const layer = L.polygon(leafletLatLngs, {
        color: sf.color, weight: 2, fillColor: sf.color, fillOpacity: 0.15,
      })

      layer.on('click', () => {
        useAppStore.getState().selectField(sf.id)
        document.getElementById('field-card-' + sf.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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

  // Restore champs
  if (saved.champs && saved.champs.length > 0) {
    saved.champs.forEach((sc) => {
      const parcelles = (useAppStore.getState().fields).filter((f) => sc.parcelleIds.includes(f.id) && !f.archived)
      const outline = sc.customOutline ?? (parcelles.length >= 1 ? computeChampOutline(parcelles.map((p) => p.latlngs)) : [])

      let layer: L.Polygon | undefined
      let labelMarker: L.Marker | undefined

      if (outline.length >= 3) {
        const leafletLatLngs = outline.map((ll) => L.latLng(ll.lat, ll.lng))
        layer = L.polygon(leafletLatLngs, {
          color: sc.color, weight: 3, fillColor: sc.color, fillOpacity: 0.04, dashArray: '10 6',
        }).addTo(map)
        layer.on('click', () => { useAppStore.getState().selectChamp(sc.id) })

        const center = layer.getBounds().getCenter()
        labelMarker = L.marker(center, {
          icon: L.divIcon({
            html: `<div style="font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;color:${sc.color};text-shadow:0 0 6px #000,0 0 12px #000;white-space:nowrap;letter-spacing:1px">${sc.name}</div>`,
            iconSize: [0, 0], className: '',
          }),
        }).addTo(map)
      }

      const champ: Champ = {
        id: sc.id, name: sc.name, color: sc.color,
        parcelleIds: sc.parcelleIds,
        customOutline: sc.customOutline,
        layer, labelMarker,
      }
      store.addChamp(champ)
    })
    if (saved.champIdCounter) {
      useAppStore.setState({ champIdCounter: saved.champIdCounter })
    }
  }

  // Restore employees, strains, logs
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
  })

  store.setStatus(saved.exploitPolygon ? (saved.fields.length > 0 ? 'DONNÉES RESTAURÉES' : 'AJOUTEZ VOS CHAMPS') : 'EN ATTENTE')
}
