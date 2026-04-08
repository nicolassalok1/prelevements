/**
 * Terrain auto-compute orchestration.
 *
 * End-to-end pipeline that turns a {@link Field} polygon into a populated
 * {@link ReliefInfo} object by:
 *   1. sampling the polygon with adaptive density,
 *   2. fetching elevations + sunshine from Open-Meteo in parallel,
 *   3. running the pure-math pipeline to derive stats,
 *   4. collecting non-fatal warnings when secondary data (sunshine) fails.
 *
 * Elevation failure is fatal (nothing worth reporting). Sunshine failure
 * is degraded to a warning so the user still gets altitude/slope/exposition.
 */

import type { Field, LatLng, ReliefInfo } from '../types'
import {
  sampleFieldPoints,
  sampleBoundingBoxGrid,
  computeReliefStats,
  bearingToExposition,
} from './terrain'
import {
  fetchElevations,
  fetchYearlySunshineHours,
  TerrainApiError,
} from './terrain-api'

export interface ComputeReliefResult {
  relief: ReliefInfo
  /** Non-fatal issues the user should know about (e.g. sunshine unavailable). */
  warnings: string[]
  /** Number of DEM samples that actually contributed to the fit. */
  sampleCount: number
}

export interface ComputeReliefOptions {
  /** Override the default adaptive sample count. */
  targetSamples?: number
  /** Skip the sunshine fetch entirely (faster, astronomical only). */
  skipSunshine?: boolean
}

/**
 * Compute a {@link ReliefInfo} object for the given field.
 *
 * @throws {@link TerrainApiError} if elevation data cannot be retrieved.
 *         Sunshine failures are captured as warnings, not thrown.
 */
export async function computeFieldRelief(
  field: Field,
  opts: ComputeReliefOptions = {},
): Promise<ComputeReliefResult> {
  const warnings: string[] = []

  // ── 1. Sampling ──
  const target = opts.targetSamples ?? adaptiveSampleCount(field.area)
  const samplePoints = sampleFieldPoints(field.latlngs, target)
  if (samplePoints.length < 3) {
    throw new TerrainApiError(
      "Polygone trop petit pour échantillonner le relief (min. 3 points)",
    )
  }

  // ── 2. Elevation + sunshine in parallel ──
  // Elevation is required → throw on failure.
  // Sunshine is optional → catch and degrade to a warning.
  const centroid = polygonCentroid(field.latlngs)
  const sunshinePromise: Promise<number | undefined> = opts.skipSunshine
    ? Promise.resolve(undefined)
    : fetchYearlySunshineHours(centroid).catch((e: unknown) => {
        warnings.push(
          e instanceof TerrainApiError
            ? `Ensoleillement: ${e.message}`
            : "Ensoleillement indisponible",
        )
        return undefined
      })

  const [samples, sunshineHours] = await Promise.all([
    fetchElevations(samplePoints),
    sunshinePromise,
  ])

  // ── 3. Pure math ──
  const stats = computeReliefStats(samples)

  // ── 4. Assemble ReliefInfo ──
  const relief: ReliefInfo = {
    altitudeMin: round(stats.altMin, 0),
    altitudeMax: round(stats.altMax, 0),
    slope: round(stats.slopePct, 1),
    exposition: bearingToExposition(stats.aspectDeg, stats.slopePct),
    sunlightHours:
      sunshineHours != null
        ? round(sunshineHours, 1)
        : field.relief?.sunlightHours, // preserve existing value on degraded fetch
    autoComputed: true,
  }

  return { relief, warnings, sampleCount: stats.sampleCount }
}

// ═══════════════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Pick a reasonable sample count based on the field area.
 * Small plots (~0.5 ha) → 30, large plots (>10 ha) → 80.
 */
function adaptiveSampleCount(areaHa: number): number {
  return Math.max(30, Math.min(80, Math.round(30 + areaHa * 5)))
}

/** Arithmetic mean of polygon vertices — good enough as a representative point. */
function polygonCentroid(latlngs: LatLng[]): LatLng {
  const n = latlngs.length
  let lat = 0
  let lng = 0
  for (const p of latlngs) {
    lat += p.lat
    lng += p.lng
  }
  return { lat: lat / n, lng: lng / n }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

// ═══════════════════════════════════════════════════════════════════════
//  3D TERRAIN GRID
// ═══════════════════════════════════════════════════════════════════════

/**
 * Dense regular grid of elevations covering a field's bounding box,
 * ready to be consumed by a 3D surface mesh renderer.
 *
 * The grid is kept rectangular (no holes) so that the surface can be
 * rendered continuously; the `inside` mask lets the renderer visually
 * distinguish cells that actually belong to the polygon from the
 * surrounding context.
 *
 * @see sampleBoundingBoxGrid for the geometry, {@link fetchElevations}
 *      for the DEM fetch.
 */
export interface FieldElevationGrid {
  width: number              // grid width  (columns, lng direction)
  height: number             // grid height (rows,    lat direction)
  points: LatLng[]           // length = width * height, row-major
  elevations: number[]       // length = width * height, meters
  inside: boolean[]          // length = width * height, polygon membership
  altMin: number             // min elevation across the grid (meters)
  altMax: number             // max elevation across the grid (meters)
  bboxWidthM: number         // bounding box width in local meters (east-west)
  bboxHeightM: number        // bounding box height in local meters (north-south)
}

/**
 * Pick a grid resolution adapted to the field area.
 *
 * Kept deliberately modest because Open-Meteo's free tier trips 429s on
 * anything larger, AND the underlying DEM (SRTM / Copernicus, ~30 m
 * horizontal) can't resolve finer detail anyway. The 3D renderer then
 * subdivides this grid client-side (bilinear interpolation) to achieve
 * visual smoothness without more API calls — see RENDER_SUBDIVISION in
 * Terrain3DView.tsx.
 */
export function adaptiveGridSize(areaHa: number): number {
  if (areaHa < 0.5) return 16   // 256 pts — 3 batches, ~1.5 s
  if (areaHa < 2) return 20     // 400 pts — 4 batches, ~2 s
  if (areaHa < 10) return 24    // 576 pts — 6 batches, ~2.5 s
  return 28                     // 784 pts — 8 batches, ~3.5 s
}

/**
 * Fetch a dense elevation grid for a field. This is the pendant of
 * {@link computeFieldRelief} but aimed at 3D visualization rather than
 * statistical summary.
 *
 * @throws {@link TerrainApiError} on network/HTTP/parsing failure.
 */
export async function fetchFieldElevationGrid(
  field: Field,
  opts: { gridSize?: number } = {},
): Promise<FieldElevationGrid> {
  const n = opts.gridSize ?? adaptiveGridSize(field.area)
  const { points, width, height, inside } = sampleBoundingBoxGrid(field.latlngs, n)
  if (points.length < 4) {
    throw new TerrainApiError("Polygone trop petit pour générer une grille 3D")
  }

  const samples = await fetchElevations(points)
  const elevations = samples.map((s) => s.altitude)

  let altMin = Infinity
  let altMax = -Infinity
  for (const z of elevations) {
    if (z < altMin) altMin = z
    if (z > altMax) altMax = z
  }

  // Compute bounding box dimensions in local meters via an equirectangular
  // projection around the polygon centroid — this is what the 3D renderer
  // needs for a correctly proportioned surface.
  const lats = field.latlngs.map((p) => p.lat)
  const lngs = field.latlngs.map((p) => p.lng)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)
  const midLatRad = ((south + north) / 2) * Math.PI / 180
  const EARTH_RADIUS_M = 6371000
  const bboxHeightM = ((north - south) * Math.PI / 180) * EARTH_RADIUS_M
  const bboxWidthM = ((east - west) * Math.PI / 180) * Math.cos(midLatRad) * EARTH_RADIUS_M

  return {
    width, height, points, elevations, inside,
    altMin, altMax,
    bboxWidthM, bboxHeightM,
  }
}
