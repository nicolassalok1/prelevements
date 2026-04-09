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

// Elevation API — same-origin proxy at /api/elevation.
//
// The client always calls our own origin, never an external elevation
// host. The actual upstream (Open-Meteo) lives behind a Vercel serverless
// function in production and a Vite dev middleware locally. This gives:
//   • Zero CORS concerns (same origin).
//   • Server-side outbound IP (Vercel edge / localhost), so Open-Meteo's
//     per-user-IP burst limiter no longer trips 429s for our users.
//   • Edge caching at Vercel's CDN — SRTM values are static, so the
//     proxy sets Cache-Control for 1 day fresh + 1 week stale.
//
// Previous attempts and why they failed:
//   • Direct Open-Meteo /v1/elevation: 429 persistent IP ban on bursts.
//   • Direct OpenTopoData /v1/srtm30m: Cloudflare strips ACAO → CORS fail.
//   • Direct Open-Elevation: flaky depending on user network/firewall.
const ELEVATION_URL = '/api/elevation'
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
const ELEVATION_BATCH_SIZE = 100        // proxy enforces the same upstream limit
const ELEVATION_CONCURRENCY = 3         // same-origin → no browser preflight per req
const ELEVATION_INTER_BATCH_DELAY_MS = 50
const RETRY_STATUSES = new Set([429, 502, 503, 504])
const RETRY_MAX_ATTEMPTS = 5            // 1 initial + 4 retries

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
 * Fetch elevations for a list of points. Batches into {@link ELEVATION_BATCH_SIZE}
 * chunks, runs them with a bounded concurrency of {@link ELEVATION_CONCURRENCY}
 * (to stay under Open-Meteo's burst limit) and retries with exponential
 * backoff on transient errors (429 / 503 / 504). Preserves input order.
 *
 * @throws {@link TerrainApiError} on any non-retriable failure or after
 *         all retry attempts are exhausted.
 */
export async function fetchElevations(points: LatLng[]): Promise<ReliefSample[]> {
  if (points.length === 0) return []

  // Split into batches preserving index ranges so we can reassemble in order.
  const batches: Array<{ offset: number; points: LatLng[] }> = []
  for (let i = 0; i < points.length; i += ELEVATION_BATCH_SIZE) {
    batches.push({ offset: i, points: points.slice(i, i + ELEVATION_BATCH_SIZE) })
  }

  const samples: ReliefSample[] = new Array(points.length)

  await runWithConcurrency(batches, ELEVATION_CONCURRENCY, async (b, isFirst) => {
    // Throttle between sequential batches to stay under Open-Meteo's
    // burst limit. Skip the delay for the very first batch.
    if (!isFirst) await sleep(ELEVATION_INTER_BATCH_DELAY_MS)
    const elevations = await fetchElevationBatch(b.points)
    for (let k = 0; k < elevations.length; k++) {
      const p = points[b.offset + k]
      samples[b.offset + k] = { lat: p.lat, lng: p.lng, altitude: elevations[k] }
    }
  })

  return samples
}

/**
 * Run `worker(item, isFirst)` over `items` with at most `limit` promises
 * in flight at any time. Stops on the first rejection and re-throws it.
 * `isFirst` lets the worker skip an initial throttle delay.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, isFirst: boolean) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  const queue = items.slice()
  let firstError: unknown = null
  let processed = 0
  const runners: Promise<void>[] = []
  const max = Math.min(limit, queue.length)
  for (let i = 0; i < max; i++) {
    runners.push((async () => {
      while (queue.length > 0 && firstError == null) {
        const item = queue.shift()!
        const isFirst = processed === 0
        processed++
        try {
          await worker(item, isFirst)
        } catch (e) {
          if (firstError == null) firstError = e
          return
        }
      }
    })())
  }
  await Promise.all(runners)
  if (firstError != null) throw firstError
}

interface ElevationProxyResponse {
  elevations?: number[]
  error?: string
}

/**
 * Query our own elevation proxy for a batch of points. The proxy lives at
 * {@link ELEVATION_URL} — Vercel serverless in prod, Vite middleware in dev.
 * Same contract either way:
 *
 *   POST /api/elevation
 *   Body:     { "locations": [{ "lat": <num>, "lng": <num> }, …] }
 *   Response: { "elevations": [<num>, …] }   — same length as locations
 */
async function fetchElevationBatch(batch: LatLng[]): Promise<number[]> {
  const body = JSON.stringify({
    locations: batch.map((p) => ({ lat: p.lat, lng: p.lng })),
  })
  const data = await fetchJsonPost<ElevationProxyResponse>(
    ELEVATION_URL,
    body,
    "Pas de connexion au serveur d'élévation",
    'élévation',
  )
  if (!data.elevations || data.elevations.length !== batch.length) {
    throw new TerrainApiError(data.error || "Données d'élévation incomplètes")
  }
  return data.elevations
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
 * JSON fetch wrapper with exponential backoff on transient statuses
 * (429 Too Many Requests, 5xx) so dense grids don't fail entirely on
 * burst limits. Non-retriable failures are normalized into TerrainApiError
 * with clear, user-facing French messages.
 *
 * @param init  Optional fetch RequestInit (method, headers, body).
 */
async function fetchJson<T>(
  url: string,
  offlineMsg: string,
  label: string,
  init?: RequestInit,
): Promise<T> {
  let lastStatus = 0
  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    let resp: Response
    try {
      resp = await fetch(url, init)
    } catch (e) {
      // Network errors are not retried — the user is probably offline.
      throw new TerrainApiError(offlineMsg, e)
    }
    if (resp.ok) {
      try {
        return (await resp.json()) as T
      } catch (e) {
        throw new TerrainApiError(`Réponse ${label} invalide (JSON)`, e)
      }
    }
    lastStatus = resp.status
    if (!RETRY_STATUSES.has(resp.status) || attempt === RETRY_MAX_ATTEMPTS - 1) {
      throw new TerrainApiError(`${label}: HTTP ${resp.status}`)
    }
    // Exponential backoff with jitter: 1s, 2s, 4s, 8s (+ 0-500ms).
    // Honor Retry-After if the server provides it (in seconds or HTTP-date
    // format — we only parse the numeric form).
    const retryAfterHeader = resp.headers.get('Retry-After')
    const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 0
    const backoff = Math.max(retryAfterMs, 1000 * Math.pow(2, attempt) + Math.random() * 500)
    await sleep(backoff)
  }
  // Unreachable — the loop either returns, throws, or sleeps and retries.
  throw new TerrainApiError(`${label}: HTTP ${lastStatus} après ${RETRY_MAX_ATTEMPTS} tentatives`)
}

/**
 * POST wrapper around {@link fetchJson} for JSON-body APIs.
 */
async function fetchJsonPost<T>(
  url: string,
  body: string,
  offlineMsg: string,
  label: string,
): Promise<T> {
  return fetchJson<T>(url, offlineMsg, label, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body,
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
