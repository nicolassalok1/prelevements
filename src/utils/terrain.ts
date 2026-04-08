/**
 * Pure terrain math — no network, no React, fully unit-testable.
 *
 * Given a polygon and an optional set of (lat, lng, altitude) samples,
 * this module:
 *   - generates evenly-spread sampling points inside the polygon,
 *   - projects them into local meters,
 *   - fits a best-fit plane via least squares,
 *   - derives altitude stats, slope (%) and aspect (compass bearing),
 *   - converts bearings to the app's 8+1 exposition sectors.
 *
 * The equirectangular projection used here (centered on the polygon
 * centroid) is accurate to a few cm over plots of several km — far
 * beyond the precision of any DEM we'll feed into it.
 */

import type { LatLng, Exposition } from '../types'
import { isInsidePolygon } from './geometry'

// ═══════════════════════════════════════════════════════════════════════
//  PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════

/** One polygon sample point with its altitude (meters, WGS84-ish). */
export interface ReliefSample {
  lat: number
  lng: number
  altitude: number
}

/** Aggregated terrain statistics derived from a set of ReliefSamples. */
export interface ReliefStats {
  altMin: number              // meters
  altMax: number              // meters
  altMean: number             // meters
  slopePct: number            // % (0 = flat)
  aspectDeg: number | null    // compass bearing [0, 360), 0 = north, clockwise. null if flat.
  sampleCount: number
}

// ═══════════════════════════════════════════════════════════════════════
//  SAMPLING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate evenly-spaced sampling points inside a polygon.
 *
 * Algorithm:
 *   1. Compute the polygon bounding box.
 *   2. Lay down a regular N×N grid inside the bbox.
 *   3. Keep only points inside the polygon.
 *   4. Grow N progressively if rejection rate leaves us under the target.
 *   5. Always append the polygon vertices — they capture ridge and edge
 *      extrema that a pure interior grid misses.
 *   6. Cap the total at 100 (Open-Meteo Elevation API batch limit).
 *
 * @param latlngs Field polygon (>= 3 points, unclosed ring).
 * @param target  Approximate desired number of interior samples.
 */
export function sampleFieldPoints(latlngs: LatLng[], target: number): LatLng[] {
  if (latlngs.length < 3) return [...latlngs]

  const lats = latlngs.map((p) => p.lat)
  const lngs = latlngs.map((p) => p.lng)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)

  const desired = clamp(target, 9, 80)
  // Pre-inflate the grid to account for rejections (interior ratio ≈ area/bbox).
  let n = Math.ceil(Math.sqrt(desired * 1.8))
  let interior: LatLng[] = []

  // Up to 4 growth attempts — beyond that we accept what we have.
  for (let attempt = 0; attempt < 4; attempt++) {
    interior = []
    const stepLat = (north - south) / (n + 1)
    const stepLng = (east - west) / (n + 1)
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= n; j++) {
        const p: LatLng = { lat: south + i * stepLat, lng: west + j * stepLng }
        if (isInsidePolygon(p, latlngs)) interior.push(p)
      }
    }
    if (interior.length >= desired) break
    n += 2
  }

  // Append vertices (deduplicate via stringified coords — fast enough for <200 pts).
  const seen = new Set<string>()
  const all: LatLng[] = []
  const push = (p: LatLng) => {
    const key = `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`
    if (!seen.has(key)) { seen.add(key); all.push(p) }
  }
  latlngs.forEach(push)
  interior.forEach(push)

  // Cap at 100 — preserve vertices, downsample interior first.
  if (all.length <= 100) return all
  const vertices = all.slice(0, latlngs.length)
  const interiorKept = all.slice(latlngs.length)
  const budget = Math.max(0, 100 - vertices.length)
  const stride = Math.max(1, Math.ceil(interiorKept.length / budget))
  return [...vertices, ...interiorKept.filter((_, i) => i % stride === 0).slice(0, budget)]
}

/**
 * Sample a regular N×N grid over the polygon's bounding box (including
 * points that fall outside the polygon). Returns the flattened point list
 * together with the grid dimensions and a boolean "inside" mask, so
 * downstream consumers (e.g. a 3D mesh renderer) can choose whether to
 * show or mask out-of-polygon cells.
 *
 * Unlike {@link sampleFieldPoints}, this does NOT drop exterior points —
 * it keeps the whole bounding box so that a surface mesh can be rendered
 * continuously without holes. Polygon membership is surfaced via `inside`.
 *
 * @param latlngs Field polygon (>= 3 points, unclosed ring).
 * @param n       Grid resolution (n×n cells). Clamped to [8, 60].
 */
export function sampleBoundingBoxGrid(
  latlngs: LatLng[],
  n: number,
): { points: LatLng[]; width: number; height: number; inside: boolean[] } {
  if (latlngs.length < 3) {
    return { points: [], width: 0, height: 0, inside: [] }
  }
  const size = clamp(Math.round(n), 8, 60)

  const lats = latlngs.map((p) => p.lat)
  const lngs = latlngs.map((p) => p.lng)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)

  const points: LatLng[] = []
  const inside: boolean[] = []
  // j is the row (lat direction, south → north)
  // i is the column (lng direction, west → east)
  // Row-major layout: index = j * size + i — compatible with a PlaneGeometry.
  for (let j = 0; j < size; j++) {
    const lat = size === 1 ? (south + north) / 2 : south + ((north - south) * j) / (size - 1)
    for (let i = 0; i < size; i++) {
      const lng = size === 1 ? (west + east) / 2 : west + ((east - west) * i) / (size - 1)
      const p: LatLng = { lat, lng }
      points.push(p)
      inside.push(isInsidePolygon(p, latlngs))
    }
  }

  return { points, width: size, height: size, inside }
}

// ═══════════════════════════════════════════════════════════════════════
//  PROJECTION & PLANE FIT
// ═══════════════════════════════════════════════════════════════════════

const EARTH_RADIUS_M = 6371000

/**
 * Project a lat/lng point to local meters around a reference point,
 * using the equirectangular approximation. Accurate within centimeters
 * over plots of several kilometers.
 */
export function toLocalMeters(ref: LatLng, point: LatLng): { x: number; y: number } {
  const dLat = toRad(point.lat - ref.lat)
  const dLng = toRad(point.lng - ref.lng)
  const refLatRad = toRad(ref.lat)
  return {
    x: dLng * Math.cos(refLatRad) * EARTH_RADIUS_M, // east
    y: dLat * EARTH_RADIUS_M,                        // north
  }
}

/**
 * Least-squares plane fit `z = a·x + b·y + c` via normal equations.
 * Returns null if the 3×3 system is degenerate (collinear points, too
 * few samples, or numerical instability).
 */
export function fitPlane(
  samples: ReadonlyArray<{ x: number; y: number; z: number }>,
): { a: number; b: number; c: number } | null {
  if (samples.length < 3) return null

  let sxx = 0, sxy = 0, sx = 0
  let syy = 0, sy = 0
  let sxz = 0, syz = 0, sz = 0
  const n = samples.length

  for (const s of samples) {
    sxx += s.x * s.x
    sxy += s.x * s.y
    syy += s.y * s.y
    sx += s.x
    sy += s.y
    sxz += s.x * s.z
    syz += s.y * s.z
    sz += s.z
  }

  // Solve:
  //   [sxx sxy sx] [a]   [sxz]
  //   [sxy syy sy] [b] = [syz]
  //   [sx  sy  n ] [c]   [sz ]
  const det =
    sxx * (syy * n - sy * sy) -
    sxy * (sxy * n - sy * sx) +
    sx  * (sxy * sy - syy * sx)

  if (Math.abs(det) < 1e-9) return null

  const a = (
    sxz * (syy * n - sy * sy) -
    sxy * (syz * n - sy * sz) +
    sx  * (syz * sy - syy * sz)
  ) / det
  const b = (
    sxx * (syz * n - sy * sz) -
    sxz * (sxy * n - sy * sx) +
    sx  * (sxy * sz - syz * sx)
  ) / det
  const c = (
    sxx * (syy * sz - syz * sy) -
    sxy * (sxy * sz - syz * sx) +
    sxz * (sxy * sy - syy * sx)
  ) / det

  return { a, b, c }
}

// ═══════════════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute altitude min/max/mean, slope (%) and aspect bearing from a set
 * of georeferenced elevation samples. The reference frame is a local
 * equirectangular projection centered on the samples' centroid.
 */
export function computeReliefStats(samples: ReadonlyArray<ReliefSample>): ReliefStats {
  if (samples.length === 0) {
    return { altMin: 0, altMax: 0, altMean: 0, slopePct: 0, aspectDeg: null, sampleCount: 0 }
  }

  let altMin = Infinity
  let altMax = -Infinity
  let altSum = 0
  let latSum = 0
  let lngSum = 0
  for (const s of samples) {
    if (s.altitude < altMin) altMin = s.altitude
    if (s.altitude > altMax) altMax = s.altitude
    altSum += s.altitude
    latSum += s.lat
    lngSum += s.lng
  }
  const n = samples.length
  const altMean = altSum / n
  const ref: LatLng = { lat: latSum / n, lng: lngSum / n }

  const projected = samples.map((s) => {
    const m = toLocalMeters(ref, s)
    return { x: m.x, y: m.y, z: s.altitude }
  })

  const plane = fitPlane(projected)
  if (!plane) {
    return { altMin, altMax, altMean, slopePct: 0, aspectDeg: null, sampleCount: n }
  }

  // Gradient is (a, b) in meters/meter along (east, north).
  const slope = Math.hypot(plane.a, plane.b)
  const slopePct = slope * 100

  // Aspect = direction the slope FACES (downhill) = opposite of the uphill
  // gradient. atan2(east, north) → bearing measured clockwise from north.
  let aspectDeg: number | null = null
  if (slopePct >= 1) {
    const rad = Math.atan2(-plane.a, -plane.b)
    aspectDeg = (rad * 180 / Math.PI + 360) % 360
  }

  return { altMin, altMax, altMean, slopePct, aspectDeg, sampleCount: n }
}

// ═══════════════════════════════════════════════════════════════════════
//  EXPOSITION MAPPING
// ═══════════════════════════════════════════════════════════════════════

const SECTORS: readonly Exposition[] = [
  'nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest',
]

/**
 * Map a compass bearing (0-360, 0 = north, clockwise) + a slope value to
 * one of the 9 expositions used by the app (8 sectors + 'plat').
 *
 * Slopes below 2% are snapped to 'plat' regardless of their (noisy) aspect.
 */
export function bearingToExposition(deg: number | null, slopePct: number): Exposition {
  if (deg == null || slopePct < 2) return 'plat'
  // Offset by 22.5° so that [337.5, 22.5) → sector 0 (nord).
  const sector = Math.floor(((deg + 22.5) % 360) / 45)
  return SECTORS[sector]
}

// ═══════════════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
