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
