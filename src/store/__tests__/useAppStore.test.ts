import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../useAppStore'
import type { Field, Champ } from '../../types'

// ── Test helpers ──────────────────────────────────────────────

const INITIAL_DATA = {
  exploitPolygon: null, exploitArea: 0, exploitLayer: null, exploitLabel: null, exploitContourHidden: true,
  fields: [], fieldIdCounter: 0, selectedFieldId: null,
  champs: [], champIdCounter: 0, selectedChampId: null,
  drawTarget: null, editTarget: null, addPointFieldId: null, drawForChampId: null,
  generationMethod: 'grid' as const, density: 1,
  userLocation: null, geolocationActive: false, geolocationError: null,
  employees: [], employeeIdCounter: 0, strains: [],
  wateringLog: [], wateringIdCounter: 0,
  amendmentLog: [], amendmentIdCounter: 0,
  soilAnalyses: [], soilAnalysisIdCounter: 0,
  agendaTasks: [], agendaIdCounter: 0,
  activities: [], activityIdCounter: 0,
  currentStep: 1, toastMessage: null, toastError: false,
  statusText: 'EN ATTENTE', helpOpen: false, dashboardOpen: false, dashboardTab: 'overview' as const,
  fieldDetailOpen: false, fieldDetailTab: 'info' as const,
  sidebarOpen: false, mobileRightOpen: false,
  calendarOpen: false, activityFormOpen: false, activityFormDate: null, activityFormEditId: null,
  activityFormPresetType: null, activityFormPresetFieldId: null,
}

function resetStore() {
  useAppStore.setState(INITIAL_DATA)
}

function makeField(id: number, overrides: Partial<Field> = {}): Field {
  return {
    id,
    name: `Parcelle ${id}`,
    color: '#8fa84f',
    latlngs: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }],
    area: 1,
    perimeter: 400,
    points: [],
    assignedEmployees: [],
    assignedManager: null,
    pointMarkers: [],
    ...overrides,
  }
}

function makeChamp(id: number, overrides: Partial<Champ> = {}): Champ {
  return {
    id,
    name: `Champ ${id}`,
    color: '#4f6aa8',
    type: 'champ',
    parcelleIds: [],
    ...overrides,
  }
}

beforeEach(resetStore)

// ── Exploitation ──────────────────────────────────────────────

describe('Exploitation actions', () => {
  it('setExploitation stores polygon and advances step to 2', () => {
    const polygon = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }]
    // layer/label are Leaflet runtime objects — not safe to construct here, pass nulls via cast
    useAppStore.getState().setExploitation(polygon, 5.5, null as never, null as never)
    const s = useAppStore.getState()
    expect(s.exploitPolygon).toEqual(polygon)
    expect(s.exploitArea).toBe(5.5)
    expect(s.currentStep).toBe(2)
  })

  it('clearExploitation resets exploitation + fields + champs and rewinds to step 1', () => {
    useAppStore.setState({
      exploitPolygon: [{ lat: 0, lng: 0 }],
      fields: [makeField(1)],
      champs: [makeChamp(1)],
      currentStep: 3,
    })
    useAppStore.getState().clearExploitation()
    const s = useAppStore.getState()
    expect(s.exploitPolygon).toBeNull()
    expect(s.fields).toEqual([])
    expect(s.champs).toEqual([])
    expect(s.currentStep).toBe(1)
  })

  it('setExploitContourHidden toggles the UI flag', () => {
    useAppStore.getState().setExploitContourHidden(false)
    expect(useAppStore.getState().exploitContourHidden).toBe(false)
  })

  it('updateExploitPolygon updates polygon + area but not other fields', () => {
    const polygon = [{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }, { lat: 2, lng: 2 }]
    useAppStore.getState().updateExploitPolygon(polygon, 42)
    const s = useAppStore.getState()
    expect(s.exploitPolygon).toEqual(polygon)
    expect(s.exploitArea).toBe(42)
    expect(s.currentStep).toBe(1) // not touched
  })
})

// ── Fields (parcelles) ────────────────────────────────────────

describe('Field actions', () => {
  it('addField appends, selects, and advances to step 3', () => {
    useAppStore.getState().addField(makeField(1))
    const s = useAppStore.getState()
    expect(s.fields).toHaveLength(1)
    expect(s.selectedFieldId).toBe(1)
    expect(s.fieldIdCounter).toBe(1)
    expect(s.currentStep).toBe(3)
  })

  it('removeField: removing the selected field reassigns selection to first remaining', () => {
    useAppStore.setState({ fields: [makeField(1), makeField(2), makeField(3)], selectedFieldId: 2, currentStep: 3 })
    useAppStore.getState().removeField(2)
    const s = useAppStore.getState()
    expect(s.fields.map((f) => f.id)).toEqual([1, 3])
    expect(s.selectedFieldId).toBe(1)
  })

  it('removeField: clearing last field rewinds to step 2', () => {
    useAppStore.setState({ fields: [makeField(1)], selectedFieldId: 1, currentStep: 3 })
    useAppStore.getState().removeField(1)
    const s = useAppStore.getState()
    expect(s.fields).toEqual([])
    expect(s.currentStep).toBe(2)
  })

  it('updateField patches a single field', () => {
    useAppStore.setState({ fields: [makeField(1), makeField(2)] })
    useAppStore.getState().updateField(1, { name: 'Renommée', notes: 'OK' })
    const f = useAppStore.getState().fields.find((x) => x.id === 1)!
    expect(f.name).toBe('Renommée')
    expect(f.notes).toBe('OK')
    // other field untouched
    expect(useAppStore.getState().fields[1].name).toBe('Parcelle 2')
  })

  it('setFieldPoints replaces points + pointMarkers for one field', () => {
    useAppStore.setState({ fields: [makeField(1)] })
    const pts = [{ label: 'A', lat: 0.5, lng: 0.5 }]
    useAppStore.getState().setFieldPoints(1, pts, [])
    expect(useAppStore.getState().fields[0].points).toEqual(pts)
  })

  it('removePoint removes the point at index', () => {
    const pts = [{ label: 'A', lat: 0, lng: 0 }, { label: 'B', lat: 1, lng: 1 }, { label: 'C', lat: 2, lng: 2 }]
    useAppStore.setState({ fields: [makeField(1, { points: pts })] })
    useAppStore.getState().removePoint(1, 1) // remove B
    const out = useAppStore.getState().fields[0].points
    expect(out.map((p) => p.label)).toEqual(['A', 'C'])
  })

  it('addManualPoint appends a point', () => {
    useAppStore.setState({ fields: [makeField(1)] })
    useAppStore.getState().addManualPoint(1, { label: 'Z', lat: 0.5, lng: 0.5 }, null as never)
    expect(useAppStore.getState().fields[0].points).toHaveLength(1)
  })

  it('renamePoint changes the label of one point', () => {
    const pts = [{ label: 'A', lat: 0, lng: 0 }, { label: 'B', lat: 1, lng: 1 }]
    useAppStore.setState({ fields: [makeField(1, { points: pts })] })
    useAppStore.getState().renamePoint(1, 1, 'X')
    expect(useAppStore.getState().fields[0].points[1].label).toBe('X')
  })

  it('updateFieldPolygon updates geometry stats', () => {
    useAppStore.setState({ fields: [makeField(1)] })
    const latlngs = [{ lat: 5, lng: 5 }, { lat: 5, lng: 6 }, { lat: 6, lng: 6 }]
    useAppStore.getState().updateFieldPolygon(1, latlngs, 3.3, 500)
    const f = useAppStore.getState().fields[0]
    expect(f.latlngs).toEqual(latlngs)
    expect(f.area).toBe(3.3)
    expect(f.perimeter).toBe(500)
  })

  it('archiveField flags the field and clears selection if matching', () => {
    useAppStore.setState({ fields: [makeField(1)], selectedFieldId: 1 })
    useAppStore.getState().archiveField(1)
    const s = useAppStore.getState()
    expect(s.fields[0].archived).toBe(true)
    expect(s.fields[0].archivedAt).toBeTruthy()
    expect(s.selectedFieldId).toBeNull()
  })

  it('archiveField reassigns activities to target fields (merge, dedup)', () => {
    useAppStore.setState({
      fields: [makeField(1), makeField(2), makeField(3)],
      activities: [
        { id: 1, date: '2026-01-01', type: 'other', fieldIds: [1], workerCount: 0, other: { title: 'T' }, createdAt: '2026-01-01' },
        { id: 2, date: '2026-01-02', type: 'other', fieldIds: [1, 3], workerCount: 0, other: { title: 'T2' }, createdAt: '2026-01-02' },
      ],
    })
    useAppStore.getState().archiveField(1, [
      { activityId: 1, targetFieldIds: [2] },
      { activityId: 2, targetFieldIds: [2, 3] }, // 3 already present → dedup
    ])
    const acts = useAppStore.getState().activities
    expect(acts[0].fieldIds).toEqual([1, 2])
    expect(acts[1].fieldIds).toEqual([1, 3, 2]) // dedup kept both 1 and 3
  })

  it('unarchiveField clears archived + archivedAt', () => {
    useAppStore.setState({ fields: [makeField(1, { archived: true, archivedAt: '2026-01-01' })] })
    useAppStore.getState().unarchiveField(1)
    const f = useAppStore.getState().fields[0]
    expect(f.archived).toBe(false)
    expect(f.archivedAt).toBeUndefined()
  })

  it('setArchivedFieldVisible flips the runtime flag', () => {
    useAppStore.setState({ fields: [makeField(1, { archived: true })] })
    useAppStore.getState().setArchivedFieldVisible(1, true)
    expect(useAppStore.getState().fields[0].archivedVisible).toBe(true)
  })
})

// ── Champs ────────────────────────────────────────────────────

describe('Champ actions', () => {
  it('addChamp registers the champ and selects it', () => {
    useAppStore.getState().addChamp(makeChamp(1))
    const s = useAppStore.getState()
    expect(s.champs).toHaveLength(1)
    expect(s.selectedChampId).toBe(1)
    expect(s.champIdCounter).toBe(1)
  })

  it('removeChamp: removing clears champId on orphaned parcelles', () => {
    useAppStore.setState({
      champs: [makeChamp(10, { parcelleIds: [1, 2] })],
      fields: [makeField(1, { champId: 10 }), makeField(2, { champId: 10 })],
      selectedChampId: 10,
    })
    useAppStore.getState().removeChamp(10)
    const s = useAppStore.getState()
    expect(s.champs).toEqual([])
    expect(s.fields.every((f) => f.champId === undefined)).toBe(true)
    expect(s.selectedChampId).toBeNull()
  })

  it('updateChamp patches name/color', () => {
    useAppStore.setState({ champs: [makeChamp(1)] })
    useAppStore.getState().updateChamp(1, { name: 'Nouveau', color: '#000' })
    const c = useAppStore.getState().champs[0]
    expect(c.name).toBe('Nouveau')
    expect(c.color).toBe('#000')
  })

  it('addParcelleToChamp adds once (idempotent) and sets champId on the field', () => {
    useAppStore.setState({ champs: [makeChamp(1)], fields: [makeField(10)] })
    useAppStore.getState().addParcelleToChamp(1, 10)
    useAppStore.getState().addParcelleToChamp(1, 10) // idempotent
    const s = useAppStore.getState()
    expect(s.champs[0].parcelleIds).toEqual([10])
    expect(s.fields[0].champId).toBe(1)
  })

  it('removeParcelleFromChamp removes from the champ and clears field.champId', () => {
    useAppStore.setState({
      champs: [makeChamp(1, { parcelleIds: [10, 20] })],
      fields: [makeField(10, { champId: 1 }), makeField(20, { champId: 1 })],
    })
    useAppStore.getState().removeParcelleFromChamp(1, 10)
    const s = useAppStore.getState()
    expect(s.champs[0].parcelleIds).toEqual([20])
    expect(s.fields.find((f) => f.id === 10)!.champId).toBeUndefined()
    expect(s.fields.find((f) => f.id === 20)!.champId).toBe(1) // untouched
  })

  it('setChampCustomOutline stores a custom outline', () => {
    useAppStore.setState({ champs: [makeChamp(1)] })
    const outline = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }]
    useAppStore.getState().setChampCustomOutline(1, outline)
    expect(useAppStore.getState().champs[0].customOutline).toEqual(outline)
  })

  it('updateSerreInfo merges info (keeps existing keys)', () => {
    useAppStore.setState({
      champs: [makeChamp(1, { type: 'serre', serreInfo: { status: 'semis', nodeCount: 1 } })],
    })
    useAppStore.getState().updateSerreInfo(1, { nodeCount: 3 })
    const info = useAppStore.getState().champs[0].serreInfo
    expect(info?.status).toBe('semis') // preserved
    expect(info?.nodeCount).toBe(3)
  })

  it('transferSerre moves parcelles to target champ and marks source as transferred', () => {
    useAppStore.setState({
      champs: [
        makeChamp(1, { type: 'serre', parcelleIds: [10, 11], serreInfo: { status: 'pret_transfert' } }),
        makeChamp(2, { parcelleIds: [] }),
      ],
      fields: [makeField(10, { champId: 1 }), makeField(11, { champId: 1 })],
    })
    useAppStore.getState().transferSerre(1, 2)
    const s = useAppStore.getState()
    const source = s.champs.find((c) => c.id === 1)!
    const target = s.champs.find((c) => c.id === 2)!
    expect(source.parcelleIds).toEqual([])
    expect(source.serreInfo?.status).toBe('transfere')
    expect(source.serreInfo?.transferDate).toBeTruthy()
    expect(target.parcelleIds).toEqual([10, 11])
    expect(s.fields.every((f) => f.champId === 2)).toBe(true)
  })
})

// ── Drawing / UI flags ────────────────────────────────────────

describe('Drawing + UI flag actions', () => {
  it('setDrawTarget / setEditTarget / setAddPointFieldId / setDrawForChampId', () => {
    const a = useAppStore.getState()
    a.setDrawTarget('field')
    a.setEditTarget({ type: 'field', fieldId: 3 })
    a.setAddPointFieldId(3)
    a.setDrawForChampId(7)
    const s = useAppStore.getState()
    expect(s.drawTarget).toBe('field')
    expect(s.editTarget).toEqual({ type: 'field', fieldId: 3 })
    expect(s.addPointFieldId).toBe(3)
    expect(s.drawForChampId).toBe(7)
  })

  it('setGenerationMethod / setDensity', () => {
    useAppStore.getState().setGenerationMethod('zigzag')
    useAppStore.getState().setDensity(2.5)
    const s = useAppStore.getState()
    expect(s.generationMethod).toBe('zigzag')
    expect(s.density).toBe(2.5)
  })
})

// ── Personnel ─────────────────────────────────────────────────

describe('Employee actions', () => {
  it('addEmployee assigns a sequential id', () => {
    const a = useAppStore.getState()
    a.addEmployee({ name: 'Alice', role: 'employe' })
    a.addEmployee({ name: 'Bob', role: 'responsable', phone: '06' })
    const s = useAppStore.getState()
    expect(s.employees).toHaveLength(2)
    expect(s.employees.map((e) => e.id)).toEqual([1, 2])
    expect(s.employeeIdCounter).toBe(2)
  })

  it('updateEmployee patches a single employee', () => {
    useAppStore.setState({ employees: [{ id: 1, name: 'A', role: 'employe' }, { id: 2, name: 'B', role: 'employe' }] })
    useAppStore.getState().updateEmployee(1, { name: 'A2' })
    expect(useAppStore.getState().employees[0].name).toBe('A2')
    expect(useAppStore.getState().employees[1].name).toBe('B')
  })

  it('removeEmployee strips them from field assignments too', () => {
    useAppStore.setState({
      employees: [{ id: 1, name: 'A', role: 'employe' }, { id: 2, name: 'B', role: 'responsable' }],
      fields: [
        makeField(10, { assignedEmployees: [1, 2], assignedManager: 2 }),
        makeField(11, { assignedEmployees: [1], assignedManager: 1 }),
      ],
    })
    useAppStore.getState().removeEmployee(2)
    const s = useAppStore.getState()
    expect(s.employees.map((e) => e.id)).toEqual([1])
    expect(s.fields[0].assignedEmployees).toEqual([1])
    expect(s.fields[0].assignedManager).toBeNull()
    expect(s.fields[1].assignedManager).toBe(1)
  })
})

// ── Strains ───────────────────────────────────────────────────

describe('Strain actions', () => {
  it('addStrain is dedupe-aware', () => {
    const a = useAppStore.getState()
    a.addStrain('Cali Water')
    a.addStrain('Cali Water')
    a.addStrain('Mochi Coco')
    expect(useAppStore.getState().strains).toEqual(['Cali Water', 'Mochi Coco'])
  })

  it('removeStrain removes the matching string', () => {
    useAppStore.setState({ strains: ['A', 'B', 'C'] })
    useAppStore.getState().removeStrain('B')
    expect(useAppStore.getState().strains).toEqual(['A', 'C'])
  })
})

// ── Logs: watering / amendments / soil ────────────────────────

describe('Log actions', () => {
  it('addWatering + removeWatering', () => {
    useAppStore.getState().addWatering({ date: '2026-01-01', fieldId: 1, method: 'goutte_a_goutte', durationMin: 30 })
    const w = useAppStore.getState().wateringLog[0]
    expect(w.id).toBe(1)
    useAppStore.getState().removeWatering(1)
    expect(useAppStore.getState().wateringLog).toEqual([])
  })

  it('addAmendment + removeAmendment', () => {
    useAppStore.getState().addAmendment({ date: '2026-01-01', fieldId: 1, type: 'organique', product: 'Compost', quantityKg: 50 })
    const a = useAppStore.getState().amendmentLog[0]
    expect(a.id).toBe(1)
    useAppStore.getState().removeAmendment(1)
    expect(useAppStore.getState().amendmentLog).toEqual([])
  })

  it('addSoilAnalysis + removeSoilAnalysis', () => {
    useAppStore.getState().addSoilAnalysis({ date: '2026-01-01', fieldId: 1, ph: 7, nitrogen: 1, phosphorus: 1, potassium: 1, organicMatter: 1 })
    expect(useAppStore.getState().soilAnalyses).toHaveLength(1)
    useAppStore.getState().removeSoilAnalysis(1)
    expect(useAppStore.getState().soilAnalyses).toEqual([])
  })
})

// ── Agenda ────────────────────────────────────────────────────

describe('Agenda actions', () => {
  it('addAgendaTask sets id + createdAt', () => {
    useAppStore.getState().addAgendaTask({
      date: '2026-01-01', title: 'T', fieldIds: [1], workerIds: [], managerIds: [], status: 'planifiee',
    })
    const t = useAppStore.getState().agendaTasks[0]
    expect(t.id).toBe(1)
    expect(t.createdAt).toBeTruthy()
  })

  it('updateAgendaTask merges fields', () => {
    useAppStore.getState().addAgendaTask({ date: '2026-01-01', title: 'T', fieldIds: [1], workerIds: [], managerIds: [], status: 'planifiee' })
    useAppStore.getState().updateAgendaTask(1, { status: 'realisee', notes: 'done' })
    const t = useAppStore.getState().agendaTasks[0]
    expect(t.status).toBe('realisee')
    expect(t.notes).toBe('done')
    expect(t.title).toBe('T') // preserved
  })

  it('removeAgendaTask removes by id', () => {
    useAppStore.getState().addAgendaTask({ date: '2026-01-01', title: 'T', fieldIds: [1], workerIds: [], managerIds: [], status: 'planifiee' })
    useAppStore.getState().removeAgendaTask(1)
    expect(useAppStore.getState().agendaTasks).toEqual([])
  })
})

// ── Activities ────────────────────────────────────────────────

describe('Activity actions', () => {
  it('addActivity assigns sequential id + createdAt and returns the new id', () => {
    const id1 = useAppStore.getState().addActivity({
      date: '2026-01-01', type: 'other', fieldIds: [1], workerCount: 0, other: { title: 'Test' },
    })
    const id2 = useAppStore.getState().addActivity({
      date: '2026-01-02', type: 'watering', fieldIds: [1], workerCount: 0,
      watering: { method: 'goutte_a_goutte', durationMin: 10 },
    })
    expect(id1).toBe(1)
    expect(id2).toBe(2)
    expect(useAppStore.getState().activities[0].createdAt).toBeTruthy()
  })

  it('updateActivity patches fields', () => {
    const id = useAppStore.getState().addActivity({ date: '2026-01-01', type: 'other', fieldIds: [1], workerCount: 0, other: { title: 'T' } })
    useAppStore.getState().updateActivity(id, { notes: 'updated' })
    expect(useAppStore.getState().activities[0].notes).toBe('updated')
  })

  it('removeActivity removes by id', () => {
    const id = useAppStore.getState().addActivity({ date: '2026-01-01', type: 'other', fieldIds: [1], workerCount: 0, other: { title: 'T' } })
    useAppStore.getState().removeActivity(id)
    expect(useAppStore.getState().activities).toEqual([])
  })
})

// ── UI: toast + panels ────────────────────────────────────────

describe('UI actions', () => {
  it('toast + clearToast', () => {
    useAppStore.getState().toast('Erreur', true)
    expect(useAppStore.getState().toastMessage).toBe('Erreur')
    expect(useAppStore.getState().toastError).toBe(true)
    useAppStore.getState().clearToast()
    expect(useAppStore.getState().toastMessage).toBeNull()
    expect(useAppStore.getState().toastError).toBe(false)
  })

  it('toast defaults error to false', () => {
    useAppStore.getState().toast('OK')
    expect(useAppStore.getState().toastError).toBe(false)
  })

  it('openFieldDetail sets selectedFieldId + tab + open flag', () => {
    useAppStore.getState().openFieldDetail(5, 'soil')
    const s = useAppStore.getState()
    expect(s.selectedFieldId).toBe(5)
    expect(s.fieldDetailTab).toBe('soil')
    expect(s.fieldDetailOpen).toBe(true)
  })

  it('openFieldDetail defaults tab to info', () => {
    useAppStore.getState().openFieldDetail(5)
    expect(useAppStore.getState().fieldDetailTab).toBe('info')
  })

  it('closeFieldDetail only toggles open flag (selection preserved)', () => {
    useAppStore.getState().openFieldDetail(5, 'soil')
    useAppStore.getState().closeFieldDetail()
    const s = useAppStore.getState()
    expect(s.fieldDetailOpen).toBe(false)
    expect(s.selectedFieldId).toBe(5)
  })

  it('toggleSidebar flips the flag', () => {
    expect(useAppStore.getState().sidebarOpen).toBe(false)
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(true)
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(false)
  })

  it('openActivityForm carries preset options', () => {
    useAppStore.getState().openActivityForm({ date: '2026-01-01', presetType: 'watering', presetFieldId: 3 })
    const s = useAppStore.getState()
    expect(s.activityFormOpen).toBe(true)
    expect(s.activityFormDate).toBe('2026-01-01')
    expect(s.activityFormPresetType).toBe('watering')
    expect(s.activityFormPresetFieldId).toBe(3)
  })

  it('closeActivityForm resets all form flags', () => {
    useAppStore.getState().openActivityForm({ date: '2026-01-01', presetType: 'watering', presetFieldId: 3 })
    useAppStore.getState().closeActivityForm()
    const s = useAppStore.getState()
    expect(s.activityFormOpen).toBe(false)
    expect(s.activityFormDate).toBeNull()
    expect(s.activityFormEditId).toBeNull()
    expect(s.activityFormPresetType).toBeNull()
    expect(s.activityFormPresetFieldId).toBeNull()
  })
})

// ── Geolocation ───────────────────────────────────────────────

describe('Geolocation actions', () => {
  it('setUserLocation / setGeolocationActive / setGeolocationError', () => {
    const a = useAppStore.getState()
    a.setUserLocation({ lat: 0, lng: 0, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null, timestamp: Date.now() })
    a.setGeolocationActive(true)
    a.setGeolocationError('boom')
    const s = useAppStore.getState()
    expect(s.userLocation?.accuracy).toBe(5)
    expect(s.geolocationActive).toBe(true)
    expect(s.geolocationError).toBe('boom')
  })
})

// ── clearAll ──────────────────────────────────────────────────

describe('clearAll', () => {
  it('resets exploit/fields/champs/logs but preserves employees + strains', () => {
    useAppStore.setState({
      exploitPolygon: [{ lat: 0, lng: 0 }],
      fields: [makeField(1)],
      champs: [makeChamp(1)],
      employees: [{ id: 1, name: 'A', role: 'employe' }],
      employeeIdCounter: 1,
      strains: ['Cali'],
      wateringLog: [{ id: 1, date: '2026-01-01', fieldId: 1, method: 'manuel', durationMin: 10 }],
    })
    useAppStore.getState().clearAll()
    const s = useAppStore.getState()
    expect(s.exploitPolygon).toBeNull()
    expect(s.fields).toEqual([])
    expect(s.champs).toEqual([])
    expect(s.wateringLog).toEqual([])
    expect(s.employees).toHaveLength(1)
    expect(s.strains).toEqual(['Cali'])
  })
})

// ── Persistence side-effect ───────────────────────────────────

describe('Persist side-effect', () => {
  it('writes to localStorage after a mutating action', () => {
    useAppStore.getState().addStrain('NewStrain')
    const raw = localStorage.getItem('anrac-prelevements-v2')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.strains).toContain('NewStrain')
  })
})
