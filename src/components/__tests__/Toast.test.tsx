import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { Toast } from '../Toast'
import { useAppStore } from '../../store/useAppStore'
import { renderWithI18n, resetStore } from '../../test/helpers'

beforeEach(() => {
  resetStore()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('shows the toast message when set', () => {
    useAppStore.setState({ toastMessage: 'Sauvegardé', toastError: false })
    const { getByText } = renderWithI18n(<Toast />)
    expect(getByText('Sauvegardé')).toBeInTheDocument()
  })

  it('applies the error style when toastError is true', () => {
    useAppStore.setState({ toastMessage: 'Erreur', toastError: true })
    const { getByText } = renderWithI18n(<Toast />)
    const node = getByText('Erreur')
    expect(node.className).toContain('text-red')
  })

  it('applies the success style when toastError is false', () => {
    useAppStore.setState({ toastMessage: 'OK', toastError: false })
    const { getByText } = renderWithI18n(<Toast />)
    const node = getByText('OK')
    expect(node.className).toContain('text-olive-lit')
  })

  it('auto-clears after 2500ms', () => {
    useAppStore.setState({ toastMessage: 'Disparaît' })
    renderWithI18n(<Toast />)
    expect(useAppStore.getState().toastMessage).toBe('Disparaît')
    act(() => { vi.advanceTimersByTime(2500) })
    expect(useAppStore.getState().toastMessage).toBeNull()
  })

  it('renders without message (hidden but mounted)', () => {
    useAppStore.setState({ toastMessage: null })
    const { container } = renderWithI18n(<Toast />)
    // element exists but is empty
    expect(container.firstChild).toBeTruthy()
    expect(container.textContent).toBe('')
  })
})
