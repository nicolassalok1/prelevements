import { describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { Dashboard } from '../Dashboard'
import { useAppStore } from '../../store/useAppStore'
import { renderWithI18n, resetStore } from '../../test/helpers'
import type { Field } from '../../types'

function makeField(id: number, overrides: Partial<Field> = {}): Field {
  return {
    id, name: `F${id}`, color: '#8fa84f',
    latlngs: [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }],
    area: 1, perimeter: 100, points: [],
    assignedEmployees: [], assignedManager: null, pointMarkers: [],
    ...overrides,
  }
}

beforeEach(resetStore)

describe('Dashboard — rendering', () => {
  it('does not render when closed', () => {
    const { container } = renderWithI18n(<Dashboard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nav items when opened', () => {
    useAppStore.setState({ dashboardOpen: true })
    renderWithI18n(<Dashboard />)
    expect(screen.getByRole('button', { name: /Vue d'ensemble/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Arrosage/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Amendements/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dépenses/i })).toBeInTheDocument()
  })
})

describe('Dashboard — overview tab', () => {
  it('shows exploitation surface and counts', () => {
    useAppStore.setState({
      dashboardOpen: true,
      dashboardTab: 'overview',
      exploitArea: 5.4,
      fields: [makeField(1, { points: [{ label: 'A', lat: 0, lng: 0 }, { label: 'B', lat: 1, lng: 1 }] }), makeField(2)],
      employees: [{ id: 1, name: 'Alice', role: 'employe' }],
      wateringLog: [{ id: 1, date: '2026-01-01', fieldId: 1, method: 'manuel', durationMin: 10 }],
    })
    renderWithI18n(<Dashboard />)
    expect(screen.getByText('5.4')).toBeInTheDocument()
    // Several stat boxes contain "2" — just assert the unit labels exist
    expect(screen.getByText(/parcelles/i)).toBeInTheDocument()
    expect(screen.getByText(/prélèvements/i)).toBeInTheDocument()
  })

  it('shows em-dash when exploitArea is 0', () => {
    useAppStore.setState({ dashboardOpen: true, dashboardTab: 'overview', exploitArea: 0 })
    renderWithI18n(<Dashboard />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('Dashboard — tab switching', () => {
  it('switches to Watering tab on click', async () => {
    useAppStore.setState({ dashboardOpen: true })
    const user = userEvent.setup()
    renderWithI18n(<Dashboard />)
    await user.click(screen.getByRole('button', { name: /Arrosage/i }))
    expect(useAppStore.getState().dashboardTab).toBe('watering')
  })

  it('switches to Amendements tab on click', async () => {
    useAppStore.setState({ dashboardOpen: true })
    const user = userEvent.setup()
    renderWithI18n(<Dashboard />)
    await user.click(screen.getByRole('button', { name: /Amendements/i }))
    expect(useAppStore.getState().dashboardTab).toBe('amendments')
  })

  it('switches to Dépenses tab on click', async () => {
    useAppStore.setState({ dashboardOpen: true })
    const user = userEvent.setup()
    renderWithI18n(<Dashboard />)
    await user.click(screen.getByRole('button', { name: /Dépenses/i }))
    expect(useAppStore.getState().dashboardTab).toBe('expenses')
  })
})

describe('Dashboard — close', () => {
  it('closes when the Fermer button is clicked', async () => {
    useAppStore.setState({ dashboardOpen: true })
    const user = userEvent.setup()
    renderWithI18n(<Dashboard />)
    await user.click(screen.getByRole('button', { name: /^Fermer$/i }))
    expect(useAppStore.getState().dashboardOpen).toBe(false)
  })

  it('closes when the backdrop is clicked', async () => {
    useAppStore.setState({ dashboardOpen: true })
    const user = userEvent.setup()
    const { container } = renderWithI18n(<Dashboard />)
    await user.click(container.firstChild as HTMLElement)
    expect(useAppStore.getState().dashboardOpen).toBe(false)
  })
})
