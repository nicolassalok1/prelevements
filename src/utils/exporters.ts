import type { Field, LatLng } from '../types'
import type { PersistedData } from './persistence'
import { normalizePersistedData } from './persistence'

interface ExportPoint {
  field: string
  label: string
  lat: number
  lng: number
}

function getAllPoints(fields: Field[]): ExportPoint[] {
  return fields.flatMap((f) =>
    f.points.map((pt) => ({ field: f.name, label: pt.label, lat: pt.lat, lng: pt.lng }))
  )
}

function download(filename: string, content: string, mime: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function exportCSV(fields: Field[]): number {
  const pts = getAllPoints(fields)
  if (!pts.length) return 0
  const rows = [
    'Champ,Label,Latitude,Longitude',
    ...pts.map((p) => `${p.field},${p.label},${p.lat.toFixed(8)},${p.lng.toFixed(8)}`),
  ]
  download('prelevements.csv', rows.join('\n'), 'text/csv')
  return pts.length
}

export function exportGeoJSON(fields: Field[], exploitPolygon: LatLng[] | null, exploitArea: number): number {
  const pts = getAllPoints(fields)
  if (!pts.length) return 0

  const features: object[] = pts.map((p) => ({
    type: 'Feature',
    properties: { field: p.field, label: p.label },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
  }))

  if (exploitPolygon) {
    features.push({
      type: 'Feature',
      properties: { type: 'exploitation', area_ha: +exploitArea.toFixed(2) },
      geometry: {
        type: 'Polygon',
        coordinates: [exploitPolygon.map((ll) => [ll.lng, ll.lat]).concat([[exploitPolygon[0].lng, exploitPolygon[0].lat]])],
      },
    })
  }

  fields.forEach((f) => {
    features.push({
      type: 'Feature',
      properties: { type: 'champ', name: f.name, area_ha: +f.area.toFixed(2) },
      geometry: {
        type: 'Polygon',
        coordinates: [f.latlngs.map((ll) => [ll.lng, ll.lat]).concat([[f.latlngs[0].lng, f.latlngs[0].lat]])],
      },
    })
  })

  download(
    'prelevements.geojson',
    JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    'application/json'
  )
  return pts.length
}

export function exportKML(fields: Field[]): number {
  const total = fields.reduce((s, f) => s + f.points.length, 0)
  if (!total) return 0

  let body = ''
  fields.forEach((f) => {
    body += `\n  <Folder><name>${f.name}</name>`
    f.points.forEach((pt) => {
      body += `\n    <Placemark><name>${pt.label}</name><description>${f.name}</description>`
      body += `<Point><coordinates>${pt.lng.toFixed(8)},${pt.lat.toFixed(8)},0</coordinates></Point></Placemark>`
    })
    body += `\n  </Folder>`
  })

  download(
    'prelevements.kml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document><name>Prélèvements ANRAC</name>${body}\n</Document>\n</kml>`,
    'application/vnd.google-earth.kml+xml'
  )
  return total
}

// ── Export/Import projet complet ──

/**
 * Export the entire project as JSON. Accepts a PersistedData-shaped payload
 * so that every persistable field (including activities, archived zones,
 * agenda tasks, etc.) is included by default — no risk of data loss at export.
 */
export function exportProject(data: PersistedData): boolean {
  if (!data.exploitPolygon && (!data.fields || data.fields.length === 0)) return false

  const date = new Date().toISOString().slice(0, 10)
  download(`projet-anrac-${date}.json`, JSON.stringify(data, null, 2), 'application/json')
  return true
}

export function parseProjectFile(content: string): PersistedData | null {
  try {
    const raw = JSON.parse(content) as PersistedData
    if (!raw.exploitPolygon && (!raw.fields || raw.fields.length === 0)) return null
    // Apply defaults so older JSON files (without activities/agendaTasks/archived) load cleanly.
    return normalizePersistedData(raw)
  } catch {
    return null
  }
}
