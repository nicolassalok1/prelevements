/**
 * Open-Meteo API client — elevation + historical sunshine.
 *
 * Both endpoints are free, key-less and CORS-friendly:
 *   • Elevation: https://api.open-meteo.com/v1/elevation   (SRTM/Copernicus DEM, ~30 m)
 *   • Historical: https://archive-api.open-meteo.com/v1/archive
 *
 * All errors bubble up as {@link TerrainApiError} so callers can display
 * a single clear message to the user without guessing at cause.
 */

import type { LatLng } from '../types'
import type { ReliefSample } from './terrain'

const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation'
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
const ELEVATION_BATCH_SIZE = 100  // Open-Meteo hard limit per request

/** Unified error type for all network/parsing failures in this module. */
export class TerrainApiError extends Error {
  // Declared as an explicit field rather than a parameter-property so the
  // code stays compatible with TypeScript's `erasableSyntaxOnly` flag
  // (parameter-properties are not pure-JS-erasable).
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'TerrainApiError'
    this.cause = cause
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ELEVATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch elevations for a list of points. Batches requests if there are
 * more than {@link ELEVATION_BATCH_SIZE} points. Preserves input order.
 *
 * @throws {@link TerrainApiError} on any network / HTTP / parsing failure.
 */
export async function fetchElevations(points: LatLng[]): Promise<ReliefSample[]> {
  if (points.length === 0) return []

  const samples: ReliefSample[] = []

  for (let i = 0; i < points.length; i += ELEVATION_BATCH_SIZE) {
    const batch = points.slice(i, i + ELEVATION_BATCH_SIZE)
    const elevations = await fetchElevationBatch(batch)
    batch.forEach((p, idx) => {
      samples.push({ lat: p.lat, lng: p.lng, altitude: elevations[idx] })
    })
  }

  return samples
}

async function fetchElevationBatch(batch: LatLng[]): Promise<number[]> {
  const lats = batch.map((p) => p.lat.toFixed(6)).join(',')
  const lngs = batch.map((p) => p.lng.toFixed(6)).join(',')
  const url = `${ELEVATION_URL}?latitude=${lats}&longitude=${lngs}`

  const data = await fetchJson<{ elevation?: number[] }>(
    url,
    'Pas de connexion à Open-Meteo (élévation)',
    'élévation',
  )
  if (!data.elevation || data.elevation.length !== batch.length) {
    throw new TerrainApiError("Données d'élévation incomplètes")
  }
  return data.elevation
}

// ═══════════════════════════════════════════════════════════════════════
//  HISTORICAL SUNSHINE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Fetch the average daily sunshine duration (in hours) over the last
 * full calendar year, at a given location. Uses the Open-Meteo Archive
 * "sunshine_duration" daily variable (accounts for cloud cover).
 *
 * @throws {@link TerrainApiError} on any network / HTTP / parsing failure.
 */
export async function fetchYearlySunshineHours(point: LatLng): Promise<number> {
  const today = new Date()
  // "Last full calendar year" — from Jan 1 to Dec 31 of (current year - 1).
  const lastYear = today.getFullYear() - 1
  const start = `${lastYear}-01-01`
  const end = `${lastYear}-12-31`

  const url =
    `${ARCHIVE_URL}?latitude=${point.lat.toFixed(4)}&longitude=${point.lng.toFixed(4)}` +
    `&start_date=${start}&end_date=${end}` +
    `&daily=sunshine_duration&timezone=auto`

  const data = await fetchJson<{ daily?: { sunshine_duration?: (number | null)[] } }>(
    url,
    'Pas de connexion à Open-Meteo (historique)',
    'historique',
  )
  const series = data.daily?.sunshine_duration
  if (!series || series.length === 0) {
    throw new TerrainApiError("Aucune donnée d'ensoleillement disponible")
  }

  // sunshine_duration is in seconds/day. Skip null entries (missing data days).
  let sumSec = 0
  let count = 0
  for (const v of series) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      sumSec += v
      count++
    }
  }
  if (count === 0) throw new TerrainApiError("Série d'ensoleillement vide")

  const avgSec = sumSec / count
  return avgSec / 3600 // seconds → hours
}

// ═══════════════════════════════════════════════════════════════════════
//  HTTP HELPER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Minimal JSON fetch wrapper that normalizes all failure modes into
 * TerrainApiError with clear, user-facing French messages.
 */
async function fetchJson<T>(url: string, offlineMsg: string, label: string): Promise<T> {
  let resp: Response
  try {
    resp = await fetch(url)
  } catch (e) {
    throw new TerrainApiError(offlineMsg, e)
  }
  if (!resp.ok) {
    throw new TerrainApiError(`Open-Meteo ${label}: HTTP ${resp.status}`)
  }
  try {
    return (await resp.json()) as T
  } catch (e) {
    throw new TerrainApiError(`Réponse ${label} invalide (JSON)`, e)
  }
}
