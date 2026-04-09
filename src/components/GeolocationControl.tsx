import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { clearWatch, isGeolocationSupported, watchPosition } from '../utils/geolocation'
import { getMap, addPointFromUserLocation } from './MapView'
import { isInsidePolygon } from '../utils/geometry'

/**
 * Floating overlay on the map providing:
 *  - "Me localiser" toggle (starts/stops live GPS tracking)
 *  - Live readout: lat/lng, altitude, horizontal/vertical accuracy
 *  - "Centrer" button to recenter the map on the current position
 *  - "Ajouter point ici" shortcut when an add-point mode is active
 */
export function GeolocationControl() {
  const userLocation = useAppStore((s) => s.userLocation)
  const geolocationActive = useAppStore((s) => s.geolocationActive)
  const geolocationError = useAppStore((s) => s.geolocationError)
  const addPointFieldId = useAppStore((s) => s.addPointFieldId)
  const fields = useAppStore((s) => s.fields)

  const watchIdRef = useRef<number | null>(null)

  // Manage the watchPosition lifecycle in sync with geolocationActive
  useEffect(() => {
    const store = useAppStore.getState()
    if (geolocationActive) {
      store.setGeolocationError(null)
      const id = watchPosition(
        (loc) => {
          useAppStore.getState().setUserLocation(loc)
        },
        (msg) => {
          useAppStore.getState().setGeolocationError(msg)
          useAppStore.getState().setGeolocationActive(false)
          useAppStore.getState().toast(`⚠ ${msg}`, true)
        },
      )
      watchIdRef.current = id
    } else {
      clearWatch(watchIdRef.current)
      watchIdRef.current = null
      // Clear the marker on stop
      useAppStore.getState().setUserLocation(null)
    }
    return () => {
      clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [geolocationActive])

  const handleToggle = () => {
    if (!isGeolocationSupported()) {
      useAppStore.getState().toast('⚠ Géolocalisation non supportée', true)
      return
    }
    useAppStore.getState().setGeolocationActive(!geolocationActive)
  }

  const handleRecenter = () => {
    if (!userLocation) return
    const map = getMap()
    if (!map) return
    map.setView([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 18), { animate: true })
  }

  const handleAddPointHere = () => {
    if (!userLocation || !addPointFieldId) return
    const notesInput = document.getElementById('point-notes-input') as HTMLInputElement | null
    const notes = notesInput?.value.trim() || undefined
    const res = addPointFromUserLocation(addPointFieldId, userLocation, notes)
    if (res.ok) {
      useAppStore.getState().toast('✓ Point ajouté à votre position GPS')
      if (notesInput) notesInput.value = ''
    } else {
      useAppStore.getState().toast(`⚠ ${res.error}`, true)
    }
  }

  // Distance to nearest non-archived field (purely informative, mobile-field UX)
  const nearestField = userLocation ? findNearestField(userLocation.lat, userLocation.lng, fields) : null

  return (
    // Stacked below Leaflet's built-in zoom controls (which live at top-left,
    // ~70 px tall). We offset by 88 px so this cluster sits comfortably
    // under them without overlap.
    <div className="absolute top-[88px] left-3 z-[500] flex flex-col gap-2 pointer-events-none">
      {/* Main locate button */}
      <button
        onClick={handleToggle}
        className={`pointer-events-auto w-11 h-11 flex items-center justify-center border font-mono text-lg shadow-lg transition-all ${
          geolocationActive
            ? 'bg-blue-500 border-blue-400 text-white'
            : 'bg-panel border-border text-text hover:border-blue-400 hover:text-blue-400'
        }`}
        title={geolocationActive ? 'Arrêter la géolocalisation' : 'Me localiser (GPS)'}
      >
        {geolocationActive ? '◉' : '⊙'}
      </button>

      {/* Live readout panel — only when we have a fix */}
      {userLocation && (
        <div className="pointer-events-auto bg-panel/95 backdrop-blur-sm border border-border p-2 px-3 font-mono text-[10px] text-text shadow-lg min-w-[180px]">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-blue-400 font-semibold tracking-[1px] uppercase">Position GPS</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-muted">Lat</span>
            <span className="text-right">{userLocation.lat.toFixed(6)}</span>
            <span className="text-muted">Lng</span>
            <span className="text-right">{userLocation.lng.toFixed(6)}</span>
            <span className="text-muted">Altitude</span>
            <span className="text-right">
              {userLocation.altitude != null ? `${userLocation.altitude.toFixed(1)} m` : '—'}
            </span>
            <span className="text-muted">Précision H</span>
            <span className="text-right">±{userLocation.accuracy.toFixed(0)} m</span>
            {userLocation.altitudeAccuracy != null && (
              <>
                <span className="text-muted">Précision V</span>
                <span className="text-right">±{userLocation.altitudeAccuracy.toFixed(0)} m</span>
              </>
            )}
            {userLocation.speed != null && userLocation.speed > 0.3 && (
              <>
                <span className="text-muted">Vitesse</span>
                <span className="text-right">{(userLocation.speed * 3.6).toFixed(1)} km/h</span>
              </>
            )}
          </div>

          {nearestField && (
            <div className="mt-1.5 pt-1.5 border-t border-border text-[9px] text-muted">
              {nearestField.inside
                ? <span className="text-emerald-400">● Dans « {nearestField.field.name} »</span>
                : <>À ~{nearestField.distance.toFixed(0)} m de « {nearestField.field.name} »</>}
            </div>
          )}

          <div className="flex gap-1 mt-2">
            <button
              onClick={handleRecenter}
              className="flex-1 bg-bg border border-border text-text py-1 px-2 text-[10px] hover:border-blue-400 hover:text-blue-400 transition-all"
            >
              ⊕ Centrer
            </button>
            {addPointFieldId && (
              <button
                onClick={handleAddPointHere}
                className="flex-1 bg-blue-500/20 border border-blue-500 text-blue-400 py-1 px-2 text-[10px] font-semibold hover:bg-blue-500 hover:text-white transition-all"
              >
                + Point ici
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error banner */}
      {geolocationError && !userLocation && (
        <div className="pointer-events-auto bg-red-500/10 border border-red-500 text-red-400 p-2 px-3 font-mono text-[10px] max-w-[200px]">
          {geolocationError}
        </div>
      )}
    </div>
  )
}

// ── helpers ──

function findNearestField(
  lat: number,
  lng: number,
  fields: ReturnType<typeof useAppStore.getState>['fields'],
) {
  const active = fields.filter((f) => !f.archived)
  if (active.length === 0) return null
  let best: { field: typeof active[number]; distance: number; inside: boolean } | null = null
  for (const f of active) {
    const inside = isInsidePolygon({ lat, lng }, f.latlngs)
    const distance = inside ? 0 : minDistanceToPolygon(lat, lng, f.latlngs)
    if (!best || distance < best.distance) {
      best = { field: f, distance, inside }
    }
  }
  return best
}

function minDistanceToPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]): number {
  let min = Infinity
  for (const p of polygon) {
    const d = haversine(lat, lng, p.lat, p.lng)
    if (d < min) min = d
  }
  return min
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
