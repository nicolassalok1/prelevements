import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildPersistedData,
  normalizePersistedData,
  saveToStorage,
  loadFromStorage,
  clearStorage,
  type PersistedData,
} from '../persistence'
import type { Field, Champ, Activity, AgendaTask, Employee, WateringEntry, AmendmentEntry, SoilAnalysis } from '../../types'

function makeField(id: number, overrides: Partial<Field> = {}): Field {
  return {
    id,
    name: `Parcelle ${id}`,
    color: '#8fa84f',
    latlngs: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }],
    area: 1.2,
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

function baseState() {
  return {
    exploitPolygon: null as null,
    exploitArea: 0,
    fields: [] as Field[],
    fieldIdCounter: 0,
    champs: [] as Champ[],
    champIdCounter: 0,
    generationMethod: 'grid' as const,
    density: 1,
    employees: [] as Employee[],
    employeeIdCounter: 0,
    strains: [] as string[],
    wateringLog: [] as WateringEntry[],
    wateringIdCounter: 0,
    amendmentLog: [] as AmendmentEntry[],
    amendmentIdCounter: 0,
    soilAnalyses: [] as SoilAnalysis[],
    soilAnalysisIdCounter: 0,
    agendaTasks: [] as AgendaTask[],
    agendaIdCounter: 0,
    activities: [] as Activity[],
    activityIdCounter: 0,
  }
}

describe('buildPersistedData', () => {
  it('serializes an empty state', () => {
    const data = buildPersistedData(baseState())
    expect(data.fields).toEqual([])
    expect(data.champs).toEqual([])
    expect(data.generationMethod).toBe('grid')
  })

  it('strips runtime-only field properties (layer, pointMarkers, labelMarker)', () => {
    const state = baseState()
    state.fields = [makeField(1)]
    state.fieldIdCounter = 1

    const data = buildPersistedData(state)
    const persistedField = data.fields[0]
    expect(persistedField).not.toHaveProperty('layer')
    expect(persistedField).not.toHaveProperty('pointMarkers')
    expect(persistedField).not.toHaveProperty('labelMarker')
    expect(persistedField.id).toBe(1)
    expect(persistedField.latlngs).toHaveLength(3)
  })

  it('strips runtime-only champ properties', () => {
    const state = baseState()
    state.champs = [makeChamp(1)]
    state.champIdCounter = 1
    const data = buildPersistedData(state)
    expect(data.champs![0]).not.toHaveProperty('layer')
    expect(data.champs![0]).not.toHaveProperty('labelMarker')
  })

  it('preserves serre-specific fields (batches, plaques, climateMeasures, serreInfo)', () => {
    const state = baseState()
    state.fields = [
      makeField(1, {
        batches: [{ id: 1, name: 'B1', strain: 'Cali', plantingDate: '2026-01-01', seedCount: 20, stage: 'semis', weeksToTransplant: 3 }],
        plaques: [{ id: 1, name: 'P1', rows: 6, cols: 12, filledCount: 50, batchId: 1 }],
        climateMeasures: [{ id: 1, date: '2026-01-02', temperature: 22 }],
      }),
    ]
    state.fieldIdCounter = 1
    state.champs = [makeChamp(2, { type: 'serre', serreInfo: { status: 'germination' } })]
    state.champIdCounter = 2

    const data = buildPersistedData(state)
    expect(data.fields[0].batches).toHaveLength(1)
    expect(data.fields[0].plaques).toHaveLength(1)
    expect(data.fields[0].climateMeasures).toHaveLength(1)
    expect(data.champs![0].serreInfo?.status).toBe('germination')
  })
})

describe('normalizePersistedData', () => {
  it('fills defaults on a minimally-populated payload', () => {
    const minimal = { exploitPolygon: null, exploitArea: 0, fields: [], fieldIdCounter: 0 } as unknown as PersistedData
    const out = normalizePersistedData(minimal)
    expect(out.employees).toEqual([])
    expect(out.strains).toEqual([])
    expect(out.wateringLog).toEqual([])
    expect(out.amendmentLog).toEqual([])
    expect(out.soilAnalyses).toEqual([])
    expect(out.agendaTasks).toEqual([])
    expect(out.activities).toEqual([])
    expect(out.champs).toEqual([])
    expect(out.generationMethod).toBe('grid')
    expect(out.density).toBe(1)
  })

  it('snaps an unknown generationMethod back to grid', () => {
    const data = { ...baseState(), generationMethod: 'bogus' as unknown as 'grid' } as unknown as PersistedData
    const out = normalizePersistedData(data)
    expect(out.generationMethod).toBe('grid')
  })

  it('preserves valid generation methods', () => {
    for (const m of ['grid', 'zigzag', 'random'] as const) {
      const data = { ...baseState(), generationMethod: m } as unknown as PersistedData
      expect(normalizePersistedData(data).generationMethod).toBe(m)
    }
  })

  it('dedupes fields by id and keeps first occurrence', () => {
    const data = {
      ...baseState(),
      fields: [
        { ...makeField(1), name: 'first' },
        { ...makeField(1), name: 'dup' },
        { ...makeField(2), name: 'other' },
      ],
      fieldIdCounter: 2,
    } as unknown as PersistedData
    const out = normalizePersistedData(data)
    expect(out.fields).toHaveLength(2)
    expect(out.fields.find((f) => f.id === 1)!.name).toBe('first')
  })

  it('aligns fieldIdCounter with the max existing id', () => {
    const data = {
      ...baseState(),
      fields: [makeField(5), makeField(10)],
      fieldIdCounter: 0,
    } as unknown as PersistedData
    const out = normalizePersistedData(data)
    expect(out.fieldIdCounter).toBe(10)
  })

  it('defaults champ.type to "champ" for legacy data', () => {
    const data = {
      ...baseState(),
      champs: [{ id: 1, name: 'X', color: '#000', parcelleIds: [] }],
    } as unknown as PersistedData
    const out = normalizePersistedData(data)
    expect(out.champs![0].type).toBe('champ')
  })

  it('fills defaults for batches/plaques/climateMeasures on each field', () => {
    const data = {
      ...baseState(),
      fields: [makeField(1)],
    } as unknown as PersistedData
    const out = normalizePersistedData(data)
    expect(out.fields[0].batches).toEqual([])
    expect(out.fields[0].plaques).toEqual([])
    expect(out.fields[0].climateMeasures).toEqual([])
  })

  it('is idempotent (normalize(normalize(x)) ≡ normalize(x))', () => {
    const data = {
      ...baseState(),
      fields: [makeField(1), makeField(2)],
      fieldIdCounter: 2,
    } as unknown as PersistedData
    const once = normalizePersistedData({ ...data })
    const twice = normalizePersistedData({ ...once })
    expect(twice).toEqual(once)
  })
})

describe('saveToStorage / loadFromStorage round-trip', () => {
  beforeEach(() => clearStorage())

  it('persists and reloads an empty payload', () => {
    const data = buildPersistedData(baseState())
    saveToStorage(data)
    const loaded = loadFromStorage()
    expect(loaded).not.toBeNull()
    expect(loaded!.fields).toEqual([])
  })

  it('preserves a complex payload through a round-trip', () => {
    const state = baseState()
    state.fields = [makeField(1, { notes: 'irrigation difficile' }), makeField(2)]
    state.fieldIdCounter = 2
    state.champs = [makeChamp(3, { parcelleIds: [1, 2] })]
    state.champIdCounter = 3
    state.strains = ['Cali Water', 'Mochi Coco']

    const data = buildPersistedData(state)
    saveToStorage(data)
    const loaded = loadFromStorage()

    expect(loaded!.fields).toHaveLength(2)
    expect(loaded!.fields[0].notes).toBe('irrigation difficile')
    expect(loaded!.champs![0].parcelleIds).toEqual([1, 2])
    expect(loaded!.strains).toEqual(['Cali Water', 'Mochi Coco'])
  })

  it('returns null when no payload is stored', () => {
    expect(loadFromStorage()).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('beldifarmer-v1', '{ not json')
    expect(loadFromStorage()).toBeNull()
  })
})
