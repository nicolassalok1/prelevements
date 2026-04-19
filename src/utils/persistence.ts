import type { LatLng, SamplingPoint, CultureInfo, Employee, WateringEntry, AmendmentEntry, SoilAnalysis, ReliefInfo, AgendaTask, Activity, Champ, ChampType, SerreInfo, SerreBatch, SerrePlaque, ClimateMeasure, GenerationMethod } from '../types'

const GENERATION_METHODS: readonly GenerationMethod[] = ['grid', 'zigzag', 'random']
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'anrac-prelevements-v2'

// ── Cloud persistence (Supabase) ──

let _currentUserId: string | null = null
let _saveTimeout: ReturnType<typeof setTimeout> | null = null

export function setCurrentUserId(userId: string | null) {
  _currentUserId = userId
}

/** Save to Supabase (debounced — waits 1s after last call) + localStorage as cache */
export function saveToCloud(data: PersistedData): void {
  // Always keep localStorage as fast cache
  saveToStorage(data)

  if (!_currentUserId || !supabase) return

  const sb = supabase
  if (_saveTimeout) clearTimeout(_saveTimeout)
  _saveTimeout = setTimeout(async () => {
    try {
      await sb
        .from('user_data')
        .upsert({ user_id: _currentUserId, data }, { onConflict: 'user_id' })
    } catch { /* silent — localStorage is the fallback */ }
  }, 1000)
}

/** Save to Supabase immediately (no debounce). Use for file imports before reload. */
export async function saveToCloudImmediate(data: PersistedData): Promise<{ ok: boolean; error?: string }> {
  saveToStorage(data)
  if (!supabase) return { ok: true } // local-only mode

  // Get user ID from module state or from current session
  let userId = _currentUserId
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }
  if (!userId) return { ok: false, error: 'Non connecté' }

  const { error } = await supabase
    .from('user_data')
    .upsert({ user_id: userId, data }, { onConflict: 'user_id' })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Load from Supabase. Returns null for new users (= blank app). */
export async function loadFromCloud(userId: string): Promise<PersistedData | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) return null
    return normalizePersistedData(data.data as PersistedData)
  } catch {
    return null
  }
}

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
  notes?: string
  archived?: boolean
  archivedAt?: string
  archivedVisible?: boolean
  champId?: number
  batches?: SerreBatch[]
  plaques?: SerrePlaque[]
  climateMeasures?: ClimateMeasure[]
}

export interface PersistedChamp {
  id: number
  name: string
  color: string
  parcelleIds: number[]
  customOutline?: LatLng[]
  type?: ChampType
  serreInfo?: SerreInfo
}

export interface PersistedData {
  exploitPolygon: LatLng[] | null
  exploitArea: number
  fields: PersistedField[]
  fieldIdCounter: number
  generationMethod: GenerationMethod
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
  champs?: PersistedChamp[]
  champIdCounter?: number
}

export function saveToStorage(data: PersistedData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* full */ }
}

/**
 * Build a PersistedData snapshot from the current AppState.
 * Single source of truth for what "all user data" means — used by both
 * automatic localStorage persistence and the manual JSON export/save button.
 * If you add a new persistable field, add it here and nowhere else.
 */
export function buildPersistedData(state: {
  exploitPolygon: LatLng[] | null
  exploitArea: number
  fields: Array<{
    id: number; name: string; color: string; latlngs: LatLng[]
    area: number; perimeter: number; points: SamplingPoint[]
    culture?: CultureInfo
    assignedEmployees: number[]
    assignedManager: number | null
    relief?: ReliefInfo
    notes?: string
    archived?: boolean
    archivedAt?: string
    archivedVisible?: boolean
    champId?: number
    batches?: SerreBatch[]
    plaques?: SerrePlaque[]
    climateMeasures?: ClimateMeasure[]
  }>
  fieldIdCounter: number
  champs: Champ[]
  champIdCounter: number
  generationMethod: GenerationMethod
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
  agendaTasks: AgendaTask[]
  agendaIdCounter: number
  activities: Activity[]
  activityIdCounter: number
}): PersistedData {
  return {
    exploitPolygon: state.exploitPolygon,
    exploitArea: state.exploitArea,
    fields: state.fields.map((f) => ({
      id: f.id, name: f.name, color: f.color, latlngs: f.latlngs,
      area: f.area, perimeter: f.perimeter, points: f.points,
      culture: f.culture,
      assignedEmployees: f.assignedEmployees,
      assignedManager: f.assignedManager,
      relief: f.relief,
      notes: f.notes,
      archived: f.archived,
      archivedAt: f.archivedAt,
      archivedVisible: f.archivedVisible,
      champId: f.champId,
      batches: f.batches,
      plaques: f.plaques,
      climateMeasures: f.climateMeasures,
    })),
    fieldIdCounter: state.fieldIdCounter,
    champs: state.champs.map((c) => ({
      id: c.id, name: c.name, color: c.color,
      parcelleIds: c.parcelleIds,
      customOutline: c.customOutline,
      type: c.type,
      serreInfo: c.serreInfo,
    })),
    champIdCounter: state.champIdCounter,
    generationMethod: state.generationMethod,
    density: state.density,
    employees: state.employees,
    employeeIdCounter: state.employeeIdCounter,
    strains: state.strains,
    wateringLog: state.wateringLog,
    wateringIdCounter: state.wateringIdCounter,
    amendmentLog: state.amendmentLog,
    amendmentIdCounter: state.amendmentIdCounter,
    soilAnalyses: state.soilAnalyses,
    soilAnalysisIdCounter: state.soilAnalysisIdCounter,
    agendaTasks: state.agendaTasks,
    agendaIdCounter: state.agendaIdCounter,
    activities: state.activities,
    activityIdCounter: state.activityIdCounter,
  }
}

/**
 * Apply defaults to a loaded PersistedData so all required fields are present.
 * Handles forward/backward compat for older JSON files that predate newer features
 * (activities, agendaTasks, archived zones, etc.).
 */
export function normalizePersistedData(data: PersistedData): PersistedData {
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
  data.champs ??= []
  data.champs.forEach((c) => { c.type ??= 'champ' })
  data.champIdCounter ??= 0
  data.fieldIdCounter ??= data.fields?.length ?? 0
  if (!GENERATION_METHODS.includes(data.generationMethod)) data.generationMethod = 'grid'
  data.density ??= 1
  data.exploitArea ??= 0
  data.fields ??= []
  // Dedupe fields by id (StrictMode double-mount bug fallout). Keep first occurrence.
  const seen = new Set<number>()
  data.fields = data.fields.filter((f) => {
    if (seen.has(f.id)) return false
    seen.add(f.id)
    return true
  })
  data.fields.forEach((f) => {
    f.assignedEmployees ??= []
    f.assignedManager ??= null
    f.archived ??= false
    f.points ??= []
    f.batches ??= []
    f.plaques ??= []
    f.climateMeasures ??= []
  })
  // Keep counter aligned with the highest id present
  const maxId = data.fields.reduce((m, f) => Math.max(m, f.id), 0)
  if (data.fieldIdCounter < maxId) data.fieldIdCounter = maxId
  return data
}

export function loadFromStorage(): PersistedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PersistedData
    return normalizePersistedData(data)
  } catch {
    return null
  }
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
}
