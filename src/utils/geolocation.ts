import type { UserLocation } from '../types'

/**
 * Wrapper around navigator.geolocation that emits UserLocation objects.
 *
 * Notes :
 * - Altitude is given in meters above the WGS84 ellipsoid (NOT mean sea level).
 * - Altitude is typically `null` on desktop (IP/WiFi geolocation) and may be
 *   null on mobile when the GPS hasn't acquired enough satellites.
 * - HTTPS is required by browsers for geolocation (localhost is exempt).
 */

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

function toUserLocation(pos: GeolocationPosition): UserLocation {
  const c = pos.coords
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: c.accuracy,
    altitude: c.altitude,
    altitudeAccuracy: c.altitudeAccuracy,
    heading: c.heading,
    speed: c.speed,
    timestamp: pos.timestamp,
  }
}

function describeError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Permission de localisation refusée'
    case err.POSITION_UNAVAILABLE:
      return 'Position GPS indisponible'
    case err.TIMEOUT:
      return 'Délai dépassé pour obtenir la position'
    default:
      return err.message || 'Erreur de géolocalisation'
  }
}

export function getCurrentPosition(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Géolocalisation non supportée par ce navigateur'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(toUserLocation(pos)),
      (err) => reject(new Error(describeError(err))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

export function watchPosition(
  onUpdate: (loc: UserLocation) => void,
  onError: (msg: string) => void,
): number | null {
  if (!isGeolocationSupported()) {
    onError('Géolocalisation non supportée par ce navigateur')
    return null
  }
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate(toUserLocation(pos)),
    (err) => onError(describeError(err)),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
  )
}

export function clearWatch(watchId: number | null): void {
  if (watchId != null && isGeolocationSupported()) {
    navigator.geolocation.clearWatch(watchId)
  }
}
