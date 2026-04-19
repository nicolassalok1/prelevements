import { describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { ActivityForm } from '../ActivityForm'
import { useAppStore } from '../../store/useAppStore'
import { renderWithI18n, resetStore } from '../../test/helpers'
import type { Field, Activity } from '../../types'

function makeField(id: number, name = `F${id}`): Field {
  return {
    id, name, color: '#8fa84f',
    latlngs: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }],
    area: 1, perimeter: 100, points: [],
    assignedEmployees: [], assignedManager: null, pointMarkers: [],
  }
}

function openForm(overrides: Partial<Parameters<typeof useAppStore.setState>[0]> = {}) {
  useAppStore.setState({
    fields: [makeField(1, 'Parcelle A'), makeField(2, 'Parcelle B')],
    activityFormOpen: true,
    ...overrides,
  })
}

beforeEach(resetStore)

describe('ActivityForm — rendering', () => {
  it('does not render when closed', () => {
    const { container } = renderWithI18n(<ActivityForm />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the "New activity" title when opened with no editId', () => {
    openForm()
    renderWithI18n(<ActivityForm />)
    expect(screen.getByText(/Nouvelle activité/i)).toBeInTheDocument()
  })

  it('renders the "Edit" title when editId is set', () => {
    const activity: Activity = {
      id: 99, date: '2026-01-01', type: 'other', fieldIds: [1], workerCount: 2,
      other: { title: 'Désherbage' }, createdAt: '2026-01-01',
    }
    openForm({ activities: [activity], activityFormEditId: 99 })
    renderWithI18n(<ActivityForm />)
    expect(screen.getByText(/Modifier l'activité/i)).toBeInTheDocument()
  })
})

describe('ActivityForm — field selection', () => {
  it('renders active fields as toggle chips', () => {
    openForm()
    renderWithI18n(<ActivityForm />)
    expect(screen.getByRole('button', { name: /Parcelle A/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Parcelle B/i })).toBeInTheDocument()
  })

  it('does not show archived fields', () => {
    useAppStore.setState({
      fields: [makeField(1, 'Active'), { ...makeField(2, 'Archivée'), archived: true }],
      activityFormOpen: true,
    })
    renderWithI18n(<ActivityForm />)
    expect(screen.getByRole('button', { name: /Active/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Archivée/i })).toBeNull()
  })

  it('pre-selects presetFieldId when provided', () => {
    openForm({ activityFormPresetFieldId: 1 })
    renderWithI18n(<ActivityForm />)
    const btn = screen.getByRole('button', { name: /Parcelle A/i })
    expect(btn.className).toContain('bg-olive')
  })
})

describe('ActivityForm — type switching', () => {
  it('defaults to watering', () => {
    openForm()
    renderWithI18n(<ActivityForm />)
    const btn = screen.getByRole('button', { name: 'Arrosage' })
    expect(btn.className).toContain('bg-olive')
  })

  it('shows amendment-specific inputs when amendment type selected', async () => {
    openForm()
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: 'Engrais' }))
    expect(screen.getByPlaceholderText(/Nom du produit/i)).toBeInTheDocument()
  })

  it('shows expense inputs when expense type selected', async () => {
    openForm()
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: 'Dépense' }))
    expect(screen.getByPlaceholderText(/Montant/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Carburant' })).toBeInTheDocument()
  })

  it('hides zone selector for expense + salary', async () => {
    openForm()
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: 'Dépense' }))
    expect(screen.queryByText(/Zones concernées/i)).toBeNull()
  })
})

describe('ActivityForm — validation', () => {
  it('refuses to save watering with no zone', async () => {
    openForm()
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))
    expect(useAppStore.getState().toastMessage).toMatch(/au moins une zone/i)
    expect(useAppStore.getState().activities).toEqual([])
  })

  it('refuses to save amendment without product name', async () => {
    openForm({ activityFormPresetType: 'amendment', activityFormPresetFieldId: 1 })
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))
    expect(useAppStore.getState().toastMessage).toMatch(/produit requis/i)
  })

  it('refuses to save other without title', async () => {
    openForm({ activityFormPresetType: 'other', activityFormPresetFieldId: 1 })
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))
    expect(useAppStore.getState().toastMessage).toMatch(/Titre de l'activité requis/i)
  })

  it('refuses to save expense without amount', async () => {
    openForm({ activityFormPresetType: 'expense' })
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))
    expect(useAppStore.getState().toastMessage).toMatch(/Montant invalide/i)
  })

  it('refuses expense without notes (nature)', async () => {
    openForm({ activityFormPresetType: 'expense' })
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.type(screen.getByPlaceholderText(/Montant/i), '500')
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))
    expect(useAppStore.getState().toastMessage).toMatch(/nature de la dépense/i)
  })

  it('refuses salary with invalid rate', async () => {
    openForm({ activityFormPresetType: 'salary' })
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))
    expect(useAppStore.getState().toastMessage).toMatch(/Taux horaire invalide/i)
  })
})

describe('ActivityForm — save', () => {
  it('creates a watering activity with proper payload', async () => {
    openForm()
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: /Parcelle A/i }))
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))

    const activities = useAppStore.getState().activities
    expect(activities).toHaveLength(1)
    expect(activities[0].type).toBe('watering')
    expect(activities[0].fieldIds).toEqual([1])
    expect(activities[0].workerCount).toBe(0) // watering never has worker count
    expect(activities[0].watering?.method).toBe('goutte_a_goutte')
  })

  it('creates an expense activity with no fieldIds', async () => {
    openForm({ activityFormPresetType: 'expense' })
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.type(screen.getByPlaceholderText(/Montant/i), '250')
    await user.click(screen.getByRole('button', { name: 'Carburant' }))
    await user.type(screen.getByPlaceholderText(/Nature de la dépense/i), 'Gasoil tracteur')
    await user.click(screen.getByRole('button', { name: /Enregistrer/i }))

    const a = useAppStore.getState().activities[0]
    expect(a).toBeDefined()
    expect(a.type).toBe('expense')
    expect(a.fieldIds).toEqual([])
    expect(a.expense?.amount).toBe(250)
    expect(a.expense?.category).toBe('Carburant')
    expect(a.notes).toBe('Gasoil tracteur')
  })

  it('pre-fills when editing, then updates on save', async () => {
    const existing: Activity = {
      id: 42, date: '2026-01-01', type: 'other', fieldIds: [1], workerCount: 3,
      other: { title: 'Taille' }, notes: 'initial', createdAt: '2026-01-01',
    }
    openForm({ activities: [existing], activityFormEditId: 42 })
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)

    // The title should be pre-filled
    expect(screen.getByDisplayValue('Taille')).toBeInTheDocument()

    // Edit the notes field
    const notesTa = screen.getByPlaceholderText(/Notes/i) as HTMLTextAreaElement
    await user.clear(notesTa)
    await user.type(notesTa, 'mise à jour')
    await user.click(screen.getByRole('button', { name: /Mettre à jour/i }))

    const updated = useAppStore.getState().activities.find((x) => x.id === 42)!
    expect(updated.notes).toBe('mise à jour')
    expect(updated.other?.title).toBe('Taille')
  })
})

describe('ActivityForm — close', () => {
  it('closes on cancel click', async () => {
    openForm()
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(useAppStore.getState().activityFormOpen).toBe(false)
  })

  it('closes on X click', async () => {
    openForm()
    const user = userEvent.setup()
    renderWithI18n(<ActivityForm />)
    await user.click(screen.getByText('✕'))
    expect(useAppStore.getState().activityFormOpen).toBe(false)
  })
})
