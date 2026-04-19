import { describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { FieldDetailPanel } from '../FieldDetailPanel'
import { useAppStore } from '../../store/useAppStore'
import { renderWithI18n, resetStore } from '../../test/helpers'
import type { Field, Champ } from '../../types'

function makeField(id: number, overrides: Partial<Field> = {}): Field {
  return {
    id, name: `Parcelle ${id}`, color: '#8fa84f',
    latlngs: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }],
    area: 1.25, perimeter: 410, points: [],
    assignedEmployees: [], assignedManager: null, pointMarkers: [],
    ...overrides,
  }
}

function makeSerre(id: number, overrides: Partial<Champ> = {}): Champ {
  return { id, name: `Serre ${id}`, color: '#0ff', type: 'serre', parcelleIds: [], ...overrides }
}

function open(field: Field, tab: 'info' | 'culture' | 'watering' | 'amendments' | 'other' | 'soil' | 'relief' | 'batches' = 'info') {
  useAppStore.setState({
    fields: [field],
    selectedFieldId: field.id,
    fieldDetailOpen: true,
    fieldDetailTab: tab,
  })
}

beforeEach(resetStore)

describe('FieldDetailPanel — rendering', () => {
  it('does not render when closed', () => {
    const { container } = renderWithI18n(<FieldDetailPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('does not render when selected field is missing', () => {
    useAppStore.setState({ fieldDetailOpen: true, selectedFieldId: 999, fields: [] })
    const { container } = renderWithI18n(<FieldDetailPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the field name + area + surface', () => {
    open(makeField(1, { name: 'Les Fraisiers' }))
    renderWithI18n(<FieldDetailPanel />)
    // name appears in both header (h2) and info tab (span) — just assert header
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Les Fraisiers')
    // 1.25 ha appears twice (header + stat card) — assert at least one present
    expect(screen.getAllByText(/1\.25 ha/).length).toBeGreaterThan(0)
  })

  it('shows the "Archivée" badge for archived fields', () => {
    open(makeField(1, { archived: true }))
    renderWithI18n(<FieldDetailPanel />)
    expect(screen.getByText(/Archivée/i)).toBeInTheDocument()
  })

  it('hides soil + relief tabs for a serre field', () => {
    const serre = makeSerre(10, { parcelleIds: [1] })
    useAppStore.setState({
      fields: [makeField(1, { champId: 10 })],
      champs: [serre],
      selectedFieldId: 1,
      fieldDetailOpen: true,
      fieldDetailTab: 'info',
    })
    renderWithI18n(<FieldDetailPanel />)
    expect(screen.queryByRole('button', { name: /^Sol$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Relief$/i })).toBeNull()
    // serre-only "Germination" tab is visible
    expect(screen.getByRole('button', { name: /Germination/i })).toBeInTheDocument()
  })
})

describe('FieldDetailPanel — Info tab: rename', () => {
  it('shows Renommer button, toggles to edit mode, saves new name', async () => {
    open(makeField(1, { name: 'Avant' }))
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)

    await user.click(screen.getByRole('button', { name: /Renommer/i }))
    const input = screen.getByDisplayValue('Avant') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'Après')
    await user.click(screen.getByRole('button', { name: '✓' }))

    expect(useAppStore.getState().fields[0].name).toBe('Après')
  })

  it('cancels rename on Escape', async () => {
    open(makeField(1, { name: 'Avant' }))
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)
    await user.click(screen.getByRole('button', { name: /Renommer/i }))
    const input = screen.getByDisplayValue('Avant')
    await user.clear(input)
    await user.type(input, 'Changé{Escape}')

    expect(useAppStore.getState().fields[0].name).toBe('Avant')
  })
})

describe('FieldDetailPanel — Info tab: notes', () => {
  it('saves notes when the user clicks Enregistrer', async () => {
    open(makeField(1))
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)

    const ta = screen.getByPlaceholderText(/Observations/i)
    await user.type(ta, 'Terrain compacté')
    await user.click(screen.getByRole('button', { name: /Enregistrer les notes/i }))

    expect(useAppStore.getState().fields[0].notes).toBe('Terrain compacté')
  })

  it('notes textarea is disabled when field is archived', () => {
    open(makeField(1, { archived: true }))
    renderWithI18n(<FieldDetailPanel />)
    const ta = screen.getByPlaceholderText(/Observations/i) as HTMLTextAreaElement
    expect(ta.disabled).toBe(true)
  })
})

describe('FieldDetailPanel — Info tab: quick activity', () => {
  it('quick activity button opens ActivityForm with preset field', async () => {
    open(makeField(42))
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)
    await user.click(screen.getByRole('button', { name: /Créer une activité/i }))
    const s = useAppStore.getState()
    expect(s.activityFormOpen).toBe(true)
    expect(s.activityFormPresetFieldId).toBe(42)
    expect(s.fieldDetailOpen).toBe(false) // detail closes
  })
})

describe('FieldDetailPanel — close', () => {
  it('closes when the ✕ button is clicked', async () => {
    open(makeField(1))
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)
    await user.click(screen.getByText('✕'))
    expect(useAppStore.getState().fieldDetailOpen).toBe(false)
  })
})

describe('FieldDetailPanel — tab switching', () => {
  it('switches to Culture tab', async () => {
    open(makeField(1))
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)
    await user.click(screen.getByRole('button', { name: 'Culture' }))
    expect(useAppStore.getState().fieldDetailTab).toBe('culture')
  })

  it('switches to Sol tab for a champ', async () => {
    open(makeField(1))
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)
    await user.click(screen.getByRole('button', { name: /^Sol$/i }))
    expect(useAppStore.getState().fieldDetailTab).toBe('soil')
  })
})

describe('FieldDetailPanel — serre climate measures', () => {
  function openSerreField() {
    useAppStore.setState({
      fields: [makeField(1, { champId: 10 })],
      champs: [makeSerre(10, { parcelleIds: [1] })],
      selectedFieldId: 1,
      fieldDetailOpen: true,
      fieldDetailTab: 'info',
    })
  }

  it('adds a temperature measurement', async () => {
    openSerreField()
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)

    await user.click(screen.getByRole('button', { name: /\+ Mesure/i }))
    await user.type(screen.getByPlaceholderText(/ex: 24.5/i), '22')
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))

    const field = useAppStore.getState().fields[0]
    expect(field.climateMeasures).toHaveLength(1)
    expect(field.climateMeasures![0].temperature).toBe(22)
  })

  it('rejects measure with no values', async () => {
    openSerreField()
    const user = userEvent.setup()
    renderWithI18n(<FieldDetailPanel />)

    await user.click(screen.getByRole('button', { name: /\+ Mesure/i }))
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))

    expect(useAppStore.getState().toastMessage).toMatch(/au moins une valeur/i)
    expect(useAppStore.getState().fields[0].climateMeasures ?? []).toEqual([])
  })

  it('shows "Aucune mesure" empty state initially', () => {
    openSerreField()
    renderWithI18n(<FieldDetailPanel />)
    expect(screen.getByText(/Aucune mesure enregistrée/i)).toBeInTheDocument()
  })
})
