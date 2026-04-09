/**
 * Vercel serverless function — elevation proxy.
 *
 * Runs server-side so that:
 *   1. The browser calls only our own origin (/api/elevation) → no CORS issues
 *      regardless of the upstream provider's headers.
 *   2. The outbound IP is the Vercel function's, not the user's — avoids
 *      the IP bans we were getting on Open-Meteo's free tier.
 *   3. We can edge-cache responses (SRTM never changes).
 *
 * Contract:
 *   POST /api/elevation
 *   Body: { "locations": [{ "lat": <num>, "lng": <num> }, …] }  (max 100)
 *   200:  { "elevations": [<num>, …] }   (same length as locations)
 *   400:  { "error": "<reason>" }
 *   502:  { "error": "<upstream failure>" }
 */

interface LatLng { lat: number; lng: number }
interface ElevationBody { locations?: unknown }

const UPSTREAM_URL = 'https://api.open-meteo.com/v1/elevation'
const MAX_LOCATIONS = 100

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: ElevationBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const locations = sanitizeLocations(body.locations)
  if (!locations) {
    return json({ error: 'locations must be a non-empty array of {lat, lng}' }, 400)
  }
  if (locations.length > MAX_LOCATIONS) {
    return json({ error: `max ${MAX_LOCATIONS} locations per request` }, 400)
  }

  const lats = locations.map((p) => p.lat.toFixed(6)).join(',')
  const lngs = locations.map((p) => p.lng.toFixed(6)).join(',')
  const url = `${UPSTREAM_URL}?latitude=${lats}&longitude=${lngs}`

  let resp: Response
  try {
    resp = await fetch(url)
  } catch {
    return json({ error: 'upstream fetch failed' }, 502)
  }
  if (!resp.ok) {
    return json({ error: `upstream HTTP ${resp.status}` }, resp.status >= 500 ? 502 : resp.status)
  }

  let data: { elevation?: number[] }
  try {
    data = (await resp.json()) as { elevation?: number[] }
  } catch {
    return json({ error: 'upstream returned invalid JSON' }, 502)
  }
  if (!Array.isArray(data.elevation) || data.elevation.length !== locations.length) {
    return json({ error: 'upstream returned incomplete elevation data' }, 502)
  }

  return new Response(JSON.stringify({ elevations: data.elevation }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // SRTM is static — cache aggressively at the Vercel edge. A full day
      // of shared cache + a week of stale-while-revalidate keeps things
      // snappy even for repeated lookups on the same field.
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}

function sanitizeLocations(input: unknown): LatLng[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const out: LatLng[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') return null
    const lat = (item as Record<string, unknown>).lat
    const lng = (item as Record<string, unknown>).lng
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
    out.push({ lat, lng })
  }
  return out
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
