import type { LatLng, SamplingPoint, CultureInfo, Employee, WateringEntry, AmendmentEntry, SoilAnalysis, ReliefInfo, AgendaTask, Activity } from '../types'

const STORAGE_KEY = 'anrac-prelevements-v2'

export interface PersistedField {
  id: number
  name: string
  color: string
  latlngs: LatLng[]
  area: number
  perimeter: number
  points: SamplingPoint[]
  culture?: CultureInfo
  assignedEmployees: number[]
  assignedManager: number | null
  relief?: ReliefInfo
  archived?: boolean
  archivedAt?: string
  archivedVisible?: boolean
}

export interface PersistedData {
  exploitPolygon: LatLng[] | null
  exploitArea: number
  fields: PersistedField[]
  fieldIdCounter: number
  generationMethod: string
  density: number
  employees: Employee[]
  employeeIdCounter: number
  strains: string[]
  wateringLog: WateringEntry[]
  wateringIdCounter: number
  amendmentLog: AmendmentEntry[]
  amendmentIdCounter: number
  soilAnalyses: SoilAnalysis[]
  soilAnalysisIdCounter: number
  agendaTasks?: AgendaTask[]
  agendaIdCounter?: number
  activities?: Activity[]
  activityIdCounter?: number
}

export function saveToStorage(data: PersistedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* full */ }
}

export function loadFromStorage(): PersistedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PersistedData
    // Backwards compat
    data.employees ??= []
    data.employeeIdCounter ??= 0
    data.strains ??= []
    data.wateringLog ??= []
    data.wateringIdCounter ??= 0
    data.amendmentLog ??= []
    data.amendmentIdCounter ??= 0
    data.soilAnalyses ??= []
    data.soilAnalysisIdCounter ??= 0
    data.agendaTasks ??= []
    data.agendaIdCounter ??= 0
    data.activities ??= []
    data.activityIdCounter ??= 0
    data.fields?.forEach((f) => {
      f.assignedEmployees ??= []
      f.assignedManager ??= null
      f.archived ??= false
    })
    return data
  } catch {
    return null
  }
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
}
