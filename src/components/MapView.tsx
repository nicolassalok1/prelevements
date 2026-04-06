import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import { useAppStore, FIELD_COLORS } from '../store/useAppStore'
import { calcArea, calcPerimeter, isInsidePolygon } from '../utils/geometry'
import { generatePoints } from '../utils/generators'
import { loadFromStorage } from '../utils/persistence'
import type { LatLng, Field } from '../types'

export function MapView() {
  const mapRef = useRef<L.Map | null>(null)
  const drawnRef = useRef<L.FeatureGroup | null>(null)
  const drawHandlerRef = useRef<L.Draw.Polygon | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const drawTarget = useAppStore((s) => s.drawTarget)
  const drawTargetRef = useRef(drawTarget)
  drawTargetRef.current = drawTarget

  const editTarget = useAppStore((s) => s.editTarget)

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [34.9615, -4.6181],
      zoom: 17,
      maxZoom: 22,
      zoomControl: true,
    })

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19,
      maxNativeZoom: 19,
    })

    const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: '© Google',
      maxZoom: 22,
      maxNativeZoom: 22,
    })

    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB',
      maxZoom: 22,
      maxNativeZoom: 20,
    })

    googleSat.addTo(map)

    L.control.layers(
      { 'Google Satellite': googleSat, 'Esri Satellite': satellite, 'Sombre': dark },
      {},
      { position: 'topright', collapsed: false }
    ).addTo(map)

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

    // Wire up generate-all button
    const handleGenerateClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('#btn-generate-all')
      if (btn) {
        const store = useAppStore.getState()
        let total = 0
        const updatedFields = store.fields.map((f) => {
          const result = generateForField(f, store.generationMethod, store.density, map)
          total += result.points.length
          return result
        })
        updatedFields.forEach((f) => {
          store.setFieldPoints(f.id, f.points, f.pointMarkers)
        })
        store.toast(`✓ ${total} points générés sur ${store.fields.length} champ(s)`)
      }

      // Individual field generate buttons
      const regenBtn = (e.target as HTMLElement).closest('[id^="btn-regen-"]')
      if (regenBtn) {
        const fieldId = parseInt(regenBtn.id.replace('btn-regen-', ''))
        const store = useAppStore.getState()
        const field = store.fields.find((f) => f.id === fieldId)
        if (field) {
          const result = generateForField(field, store.generationMethod, store.density, map)
          store.setFieldPoints(field.id, result.points, result.pointMarkers)
          store.toast(`✓ ${result.points.length} points pour "${field.name}"`)
        }
      }
    }
    document.addEventListener('click', handleGenerateClick)

    mapRef.current = map

    // Restore persisted data
    restorePersistedData(map)

    return () => {
      document.removeEventListener('click', handleGenerateClick)
      map.remove()
      mapRef.current = null
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

    if (!editTarget) {
      store.setStatus(store.fields.length > 0 ? 'EN ATTENTE' : store.exploitPolygon ? 'AJOUTEZ VOS CHAMPS' : 'EN ATTENTE')
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
    }
  }, [editTarget])

  function stopDraw() {
    if (drawHandlerRef.current) {
      try { drawHandlerRef.current.disable() } catch { /* ignore */ }
      drawHandlerRef.current = null
    }
  }

  return <div ref={containerRef} className="w-full h-full bg-bg" />
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
  const name = input?.value.trim() || `Champ ${store.fieldIdCounter + 1}`

  const rawLatLngs = layer.getLatLngs()[0] as L.LatLng[]
  const latlngs: LatLng[] = rawLatLngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }))

  // Validate inside exploitation
  if (store.exploitPolygon) {
    const outside = latlngs.filter((ll) => !isInsidePolygon(ll, store.exploitPolygon!))
    if (outside.length > 0) {
      store.toast('⚠ Le champ doit être entièrement dans l\'exploitation !', true)
      store.setStatus('CHAMP REJETÉ — hors exploitation')
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
  store.setStatus(`CHAMP "${name.toUpperCase()}" AJOUTÉ`)
  store.toast(`✓ "${name}" ajouté — ${area.toFixed(2)} ha`)
}

function generateForField(
  field: Field,
  method: string,
  density: number,
  map: L.Map
): Field {
  // Remove existing markers
  field.pointMarkers.forEach((m) => m.remove())

  const targetCount = Math.max(1, Math.round(field.area * density))
  const generated = generatePoints(field.latlngs, method as 'grid' | 'zigzag' | 'random', targetCount)

  const prefix = field.name.substring(0, 3).toUpperCase().replace(/\s/g, '')
  const points = generated.map((ll, i) => ({
    label: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    lat: ll.lat,
    lng: ll.lng,
  }))

  const pointMarkers = points.map((pt, i) => {
    const icon = L.divIcon({
      html: `<div style="
        background:${field.color};color:#000;
        font-family:'Share Tech Mono',monospace;font-size:8px;font-weight:700;
        width:24px;height:24px;display:flex;align-items:center;justify-content:center;
        border:2px solid #0d1117;border-radius:50%;box-shadow:0 0 0 1px ${field.color};
      ">${i + 1}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

    return L.marker([pt.lat, pt.lng], { icon })
      .addTo(map)
      .bindPopup(`<b>${pt.label}</b><br>${field.name}<br>Lat: ${pt.lat.toFixed(6)}<br>Lng: ${pt.lng.toFixed(6)}`)
  })

  return { ...field, points, pointMarkers }
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
      }).addTo(map)

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
      }).addTo(map)

      // Restore point markers
      const pointMarkers = sf.points.map((pt, i) => {
        const icon = L.divIcon({
          html: `<div style="
            background:${sf.color};color:#000;
            font-family:'Share Tech Mono',monospace;font-size:8px;font-weight:700;
            width:24px;height:24px;display:flex;align-items:center;justify-content:center;
            border:2px solid #0d1117;border-radius:50%;box-shadow:0 0 0 1px ${sf.color};
          ">${i + 1}</div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        })
        return L.marker([pt.lat, pt.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>${pt.label}</b><br>${sf.name}<br>Lat: ${pt.lat.toFixed(6)}<br>Lng: ${pt.lng.toFixed(6)}`)
      })

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
