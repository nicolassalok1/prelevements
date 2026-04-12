import turfUnion from '@turf/union'
import { polygon as turfPolygon } from '@turf/helpers'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import type { LatLng } from '../types'

export function isInsidePolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false
  const x = point.lng, y = point.lat
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat
    const xj = polygon[j].lng, yj = polygon[j].lat
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/** Spherical area using Shoelace formula (returns m²) */
export function calcArea(latlngs: LatLng[]): number {
  let area = 0
  const n = latlngs.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const lat1 = latlngs[i].lat * Math.PI / 180
    const lat2 = latlngs[j].lat * Math.PI / 180
    const lng1 = latlngs[i].lng * Math.PI / 180
    const lng2 = latlngs[j].lng * Math.PI / 180
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  return Math.abs(area * 6378137 * 6378137 / 2)
}

/** Perimeter in meters using Leaflet's distanceTo */
export function calcPerimeter(latlngs: L.LatLng[]): number {
  let total = 0
  for (let i = 0; i < latlngs.length; i++) {
    total += latlngs[i].distanceTo(latlngs[(i + 1) % latlngs.length])
  }
  return total
}

export function getCentroid(polygon: LatLng[]): LatLng {
  let lat = 0, lng = 0
  polygon.forEach((p) => { lat += p.lat; lng += p.lng })
  return { lat: lat / polygon.length, lng: lng / polygon.length }
}

/**
 * Compute the convex hull of a set of points using Graham scan.
 */
export function computeConvexHull(points: LatLng[]): LatLng[] {
  if (points.length < 3) return [...points]

  let start = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i].lat < points[start].lat ||
        (points[i].lat === points[start].lat && points[i].lng < points[start].lng)) {
      start = i
    }
  }

  const pivot = points[start]
  const sorted = points
    .filter((_, i) => i !== start)
    .sort((a, b) => {
      const angleA = Math.atan2(a.lat - pivot.lat, a.lng - pivot.lng)
      const angleB = Math.atan2(b.lat - pivot.lat, b.lng - pivot.lng)
      if (angleA !== angleB) return angleA - angleB
      const distA = (a.lng - pivot.lng) ** 2 + (a.lat - pivot.lat) ** 2
      const distB = (b.lng - pivot.lng) ** 2 + (b.lat - pivot.lat) ** 2
      return distA - distB
    })

  const hull: LatLng[] = [pivot]
  for (const p of sorted) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2]
      const b = hull[hull.length - 1]
      const cross = (b.lng - a.lng) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lng - a.lng)
      if (cross <= 0) hull.pop()
      else break
    }
    hull.push(p)
  }
  return hull
}

/**
 * Compute champ outline from its parcelles' polygons.
 * Uses Turf.js polygon union so the outline tightly follows the actual
 * parcelle boundaries instead of producing a loose convex hull.
 * Returns multiple polygons when parcelles are disjoint (MultiPolygon).
 * Falls back to convex hull if the union fails for any reason.
 */
export function computeChampOutline(parcellePolygons: LatLng[][]): LatLng[] {
  return computeChampOutlineMulti(parcellePolygons).flat()
}

export function computeChampOutlineMulti(parcellePolygons: LatLng[][]): LatLng[][] {
  if (parcellePolygons.length === 0) return []
  if (parcellePolygons.length === 1) return [[...parcellePolygons[0]]]

  try {
    // Build closed GeoJSON rings from each parcelle
    const turfPolys = parcellePolygons.map((poly) => {
      const ring = poly.map((p) => [p.lng, p.lat] as [number, number])
      if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
        ring.push([...ring[0]] as [number, number])
      }
      return turfPolygon([ring])
    })

    // Union all parcelle polygons directly — the outline follows
    // each parcelle's exact border. Disjoint parcelles stay as
    // separate parts in a MultiPolygon.
    let merged: Feature<Polygon | MultiPolygon> = turfPolys[0]
    for (let i = 1; i < turfPolys.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (turfUnion as any)(merged, turfPolys[i])
      if (result) merged = result
    }

    // Extract all outer rings (handles both Polygon and MultiPolygon)
    const allRings: number[][][] = merged.geometry.type === 'MultiPolygon'
      ? merged.geometry.coordinates.map((poly) => poly[0])
      : [merged.geometry.coordinates[0]]

    const outlines: LatLng[][] = allRings
      .map((ring) => ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng })))
      .filter((o) => o.length >= 3)

    return outlines.length > 0 ? outlines : [computeConvexHull(parcellePolygons.flat())]
  } catch {
    return [computeConvexHull(parcellePolygons.flat())]
  }
}

export function getBounds(polygon: LatLng[]) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  polygon.forEach((p) => {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  })
  return { minLat, maxLat, minLng, maxLng }
}
