import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useAppStore, FIELD_COLORS } from '../store/useAppStore'
import { calcArea, calcPerimeter, isInsidePolygon } from '../utils/geometry'
import { generatePoints } from '../utils/generators'
import type { LatLng, Field } from '../types'

export function MapView() {
  const mapRef = useRef<L.Map | null>(null)
  const drawnRef = useRef<L.FeatureGroup | null>(null)
  const drawHandlerRef = useRef<L.Draw.Polygon | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const drawTarget = useAppStore((s) => s.drawTarget)
  const drawTargetRef = useRef(drawTarget)
  drawTargetRef.current = drawTarget

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [34.9615, -4.6181],
      zoom: 14,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB',
      maxZoom: 20,
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

    // Wire up generate-all button
    document.addEventListener('click', (e) => {
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
    })

    mapRef.current = map

    return () => { map.remove() }
  }, [])

  // React to drawTarget changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    stopDraw()

    if (drawTarget === 'exploit') {
      containerRef.current?.classList.add('cursor-crosshair')
      const handler = new L.Draw.Polygon(map, {
        shapeOptions: { color: '#4fa8a0', weight: 3, fillColor: '#4fa8a0', fillOpacity: 0.06, dashArray: '8 4' },
      })
      handler.enable()
      drawHandlerRef.current = handler
    } else if (drawTarget === 'field') {
      containerRef.current?.classList.add('cursor-crosshair')
      const store = useAppStore.getState()
      const color = FIELD_COLORS[store.fieldIdCounter % FIELD_COLORS.length]
      const handler = new L.Draw.Polygon(map, {
        shapeOptions: { color, weight: 2, fillColor: color, fillOpacity: 0.15 },
      })
      handler.enable()
      drawHandlerRef.current = handler
    } else {
      containerRef.current?.classList.remove('cursor-crosshair')
    }
  }, [drawTarget])

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
    id: store.fieldIdCounter + 1,
    name,
    color,
    latlngs,
    area,
    perimeter,
    points: [],
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
