import type L from 'leaflet'

export interface LatLng {
  lat: number
  lng: number
}

export interface SamplingPoint {
  label: string
  lat: number
  lng: number
  notes?: string
  altitude?: number          // mètres (WGS84) — optionnel, présent si point ajouté via GPS
  altitudeAccuracy?: number  // mètres (incertitude verticale)
  accuracy?: number          // mètres (incertitude horizontale)
}

// ── Géolocalisation utilisateur ──

export interface UserLocation {
  lat: number
  lng: number
  accuracy: number              // mètres (rayon d'incertitude horizontale)
  altitude: number | null       // mètres WGS84 (null si non disponible)
  altitudeAccuracy: number | null
  heading: number | null        // degrés (null si immobile)
  speed: number | null          // m/s (null si non disponible)
  timestamp: number             // ms epoch
}

// ── Cultures ──

export type SeedType = 'beldia' | 'cali'

export interface CultureInfo {
  seedType: SeedType
  strain: string
}

// ── Personnel ──

export interface Employee {
  id: number
  name: string
  role: 'employe' | 'responsable'
  phone?: string
}

// ── Arrosage ──

export type IrrigationMethod = 'goutte_a_goutte' | 'aspersion' | 'gravitaire' | 'manuel'

export interface WateringEntry {
  id: number
  date: string          // ISO date
  fieldId: number
  method: IrrigationMethod
  durationMin: number   // durée en minutes
  volumeL?: number      // volume en litres (optionnel)
  notes?: string
}

// ── Amendements / Engrais ──

export type AmendmentType = 'organique' | 'mineral' | 'foliaire' | 'correcteur'

export interface AmendmentEntry {
  id: number
  date: string
  fieldId: number
  type: AmendmentType
  product: string       // nom du produit
  quantityKg: number    // quantité en kg
  notes?: string
}

// ── Analyse des sols ──

export interface SoilAnalysis {
  id: number
  date: string
  fieldId: number
  ph: number
  ec?: number           // conductivité électrique en mS/cm (salinité)
  nitrogen: number      // N en mg/kg
  phosphorus: number    // P en mg/kg
  potassium: number     // K en mg/kg
  organicMatter: number // % matière organique
  texture?: string      // ex: "argilo-limoneux"
  notes?: string
}

// ── Activités (unifiées) ──

export type ActivityType = 'watering' | 'amendment' | 'other' | 'expense'

export interface Activity {
  id: number
  date: string                 // ISO YYYY-MM-DD
  type: ActivityType
  fieldIds: number[]           // zones concernées — peut être vide pour les dépenses générales
  workerCount: number          // nombre d'ouvriers (0 pour arrosage et dépense)
  notes?: string
  // données type-spécifiques
  watering?: {
    method: IrrigationMethod
    durationMin: number        // temps d'arrosage en minutes
    flowRatePerHour?: number   // débit en L/heure
    volumeL?: number           // legacy/optionnel
  }
  amendment?: {
    type: AmendmentType        // catégorie standard
    customType?: string        // type d'engrais saisi librement
    product: string
    quantityKg: number
  }
  other?: { title: string }
  expense?: {
    amount: number             // montant en dirhams (DH)
    category?: string          // catégorie libre (ex: "Carburant", "Matériel", "Main d'œuvre")
  }
  createdAt: string
}

// ── Agenda / Tâches ──

export type AgendaStatus = 'planifiee' | 'realisee' | 'annulee'

export interface AgendaTask {
  id: number
  date: string             // ISO date (YYYY-MM-DD) — jour de réalisation / planifié
  title: string
  notes?: string
  fieldIds: number[]       // champs concernés
  workerIds: number[]      // ouvriers (role='employe')
  managerIds: number[]     // responsables (role='responsable')
  status: AgendaStatus
  createdAt: string        // ISO datetime
}

// ── Relief / Exposition ──

export type Exposition = 'nord' | 'nord-est' | 'est' | 'sud-est' | 'sud' | 'sud-ouest' | 'ouest' | 'nord-ouest' | 'plat'

export interface ReliefInfo {
  altitudeMin?: number   // mètres
  altitudeMax?: number
  slope?: number         // pente en %
  exposition: Exposition
  sunlightHours?: number // heures d'ensoleillement moyen / jour
  /**
   * True when the values were populated by the background auto-compute pipeline
   * (Open-Meteo DEM + sunshine). Cleared to false as soon as the user edits
   * any field manually in the UI — this locks the relief against further
   * automatic overwrites (e.g. after a polygon edit).
   */
  autoComputed?: boolean
}

// ── Parcelles (Fields) ──

export interface Field {
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
  champId?: number            // ID du champ parent (undefined = parcelle libre)
  // Leaflet layers (runtime only)
  layer?: L.Polygon
  labelMarker?: L.Marker
  pointMarkers: L.Marker[]
  archivedVisible?: boolean   // runtime: show archived zone on map
}

// ── Champs (groupes de parcelles) ──

export interface Champ {
  id: number
  name: string
  color: string
  parcelleIds: number[]       // IDs des parcelles composant ce champ
  customOutline?: LatLng[]    // contour manuellement édité (sinon enveloppe convexe auto)
  // Leaflet layers (runtime only)
  layer?: L.Polygon
  labelMarker?: L.Marker
}

export type DrawTarget = 'exploit' | 'field' | null
export type EditTarget = { type: 'exploit' } | { type: 'field'; fieldId: number } | { type: 'champ'; champId: number } | null
export type GenerationMethod = 'grid' | 'zigzag' | 'random'

export type DashboardTab = 'overview' | 'cultures' | 'agenda' | 'watering' | 'amendments' | 'soil' | 'relief'
export type FieldDetailTab = 'info' | 'culture' | 'watering' | 'amendments' | 'other' | 'soil' | 'relief'

export interface AppState {
  // Exploitation
  exploitPolygon: LatLng[] | null
  exploitArea: number
  exploitLayer: L.Polygon | null
  exploitLabel: L.Marker | null

  // Fields (parcelles)
  fields: Field[]
  fieldIdCounter: number
  selectedFieldId: number | null

  // Champs (groupes de parcelles)
  champs: Champ[]
  champIdCounter: number
  selectedChampId: number | null

  // Drawing
  drawTarget: DrawTarget
  editTarget: EditTarget
  addPointFieldId: number | null  // when set, clicking map adds point to this field

  // Geolocation (runtime only — not persisted)
  userLocation: UserLocation | null
  geolocationActive: boolean
  geolocationError: string | null

  // Generation config
  generationMethod: GenerationMethod
  density: number

  // Personnel
  employees: Employee[]
  employeeIdCounter: number

  // Strains catalog
  strains: string[]

  // History logs
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

  // UI
  currentStep: number
  toastMessage: string | null
  toastError: boolean
  statusText: string
  helpOpen: boolean
  dashboardOpen: boolean
  dashboardTab: DashboardTab
  fieldDetailOpen: boolean
  fieldDetailTab: FieldDetailTab
  sidebarOpen: boolean
  calendarOpen: boolean
  activityFormOpen: boolean
  activityFormDate: string | null
  activityFormEditId: number | null
  activityFormPresetType: ActivityType | null
  activityFormPresetFieldId: number | null

  // ── Actions ──

  // Exploitation
  setExploitation: (polygon: LatLng[], area: number, layer: L.Polygon, label: L.Marker) => void
  clearExploitation: () => void

  // Champs
  addChamp: (champ: Champ) => void
  removeChamp: (id: number) => void
  updateChamp: (id: number, updates: Partial<Pick<Champ, 'name' | 'color'>>) => void
  selectChamp: (id: number | null) => void
  addParcelleToChamp: (champId: number, fieldId: number) => void
  removeParcelleFromChamp: (champId: number, fieldId: number) => void
  setChampCustomOutline: (champId: number, outline: LatLng[] | undefined) => void
  setChampLayer: (champId: number, layer: L.Polygon, label: L.Marker) => void

  // Fields (parcelles)
  addField: (field: Field) => void
  removeField: (id: number) => void
  selectField: (id: number | null) => void
  updateField: (id: number, updates: Partial<Pick<Field, 'name' | 'culture' | 'relief'>>) => void
  setFieldPoints: (fieldId: number, points: SamplingPoint[], markers: L.Marker[]) => void
  removePoint: (fieldId: number, pointIndex: number) => void
  archiveField: (id: number, reassignments?: { activityId: number; targetFieldIds: number[] }[]) => void
  unarchiveField: (id: number) => void
  setArchivedFieldVisible: (id: number, visible: boolean) => void

  // Drawing
  setDrawTarget: (target: DrawTarget) => void
  setEditTarget: (target: EditTarget) => void
  updateExploitPolygon: (polygon: LatLng[], area: number) => void
  updateFieldPolygon: (fieldId: number, latlngs: LatLng[], area: number, perimeter: number) => void
  setAddPointFieldId: (fieldId: number | null) => void
  addManualPoint: (fieldId: number, point: SamplingPoint, marker: L.Marker) => void
  setUserLocation: (loc: UserLocation | null) => void
  setGeolocationActive: (active: boolean) => void
  setGeolocationError: (err: string | null) => void
  renamePoint: (fieldId: number, pointIndex: number, newLabel: string) => void
  setGenerationMethod: (method: GenerationMethod) => void
  setDensity: (density: number) => void

  // Personnel
  addEmployee: (emp: Omit<Employee, 'id'>) => void
  updateEmployee: (id: number, updates: Partial<Omit<Employee, 'id'>>) => void
  removeEmployee: (id: number) => void

  // Strains
  addStrain: (strain: string) => void
  removeStrain: (strain: string) => void

  // Watering
  addWatering: (entry: Omit<WateringEntry, 'id'>) => void
  removeWatering: (id: number) => void

  // Amendments
  addAmendment: (entry: Omit<AmendmentEntry, 'id'>) => void
  removeAmendment: (id: number) => void

  // Soil
  addSoilAnalysis: (entry: Omit<SoilAnalysis, 'id'>) => void
  removeSoilAnalysis: (id: number) => void

  // Agenda
  addAgendaTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void
  updateAgendaTask: (id: number, updates: Partial<Omit<AgendaTask, 'id' | 'createdAt'>>) => void
  removeAgendaTask: (id: number) => void

  // Activities
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => number
  updateActivity: (id: number, updates: Partial<Omit<Activity, 'id' | 'createdAt'>>) => void
  removeActivity: (id: number) => void

  // UI
  toast: (message: string, error?: boolean) => void
  clearToast: () => void
  setStatus: (text: string) => void
  setHelpOpen: (open: boolean) => void
  setDashboardOpen: (open: boolean) => void
  setDashboardTab: (tab: DashboardTab) => void
  openFieldDetail: (fieldId: number, tab?: FieldDetailTab) => void
  closeFieldDetail: () => void
  setFieldDetailTab: (tab: FieldDetailTab) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setCalendarOpen: (open: boolean) => void
  openActivityForm: (opts?: { date?: string | null; editId?: number | null; presetType?: ActivityType; presetFieldId?: number }) => void
  closeActivityForm: () => void
  clearAll: () => void
}
