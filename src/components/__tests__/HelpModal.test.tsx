import { describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { HelpModal } from '../HelpModal'
import { useAppStore } from '../../store/useAppStore'
import { renderWithI18n, resetStore } from '../../test/helpers'

beforeEach(resetStore)

describe('HelpModal', () => {
  it('does not render when helpOpen is false', () => {
    useAppStore.setState({ helpOpen: false })
    const { container } = renderWithI18n(<HelpModal />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the title when helpOpen is true', () => {
    useAppStore.setState({ helpOpen: true })
    const { getByRole } = renderWithI18n(<HelpModal />)
    expect(getByRole('heading', { level: 2 })).toHaveTextContent(/ANRAC/)
  })

  it('closes when the X button is clicked', async () => {
    useAppStore.setState({ helpOpen: true })
    const user = userEvent.setup()
    const { getByText } = renderWithI18n(<HelpModal />)
    await user.click(getByText('✕'))
    expect(useAppStore.getState().helpOpen).toBe(false)
  })

  it('closes when backdrop is clicked', async () => {
    useAppStore.setState({ helpOpen: true })
    const user = userEvent.setup()
    const { container } = renderWithI18n(<HelpModal />)
    const backdrop = container.firstChild as HTMLElement
    await user.click(backdrop)
    expect(useAppStore.getState().helpOpen).toBe(false)
  })

  it('does NOT close when clicking the panel itself', async () => {
    useAppStore.setState({ helpOpen: true })
    const user = userEvent.setup()
    const { getByRole } = renderWithI18n(<HelpModal />)
    await user.click(getByRole('heading', { level: 2 }))
    expect(useAppStore.getState().helpOpen).toBe(true)
  })
})
