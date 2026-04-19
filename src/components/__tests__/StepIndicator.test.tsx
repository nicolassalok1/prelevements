import { describe, it, expect, beforeEach } from 'vitest'
import { StepIndicator } from '../StepIndicator'
import { useAppStore } from '../../store/useAppStore'
import { renderWithI18n, resetStore } from '../../test/helpers'

beforeEach(resetStore)

describe('StepIndicator', () => {
  it('renders all three step labels', () => {
    const { getByText } = renderWithI18n(<StepIndicator />)
    expect(getByText('EXPLOITATION')).toBeInTheDocument()
    expect(getByText('CHAMPS')).toBeInTheDocument()
    expect(getByText('PRÉLÈVEMENTS')).toBeInTheDocument()
  })

  it.each([1, 2, 3])('highlights step %i in amber (current)', (step) => {
    useAppStore.setState({ currentStep: step })
    const { getByText } = renderWithI18n(<StepIndicator />)
    const labels = ['EXPLOITATION', 'CHAMPS', 'PRÉLÈVEMENTS']
    // getByText returns the step box itself (text node is its direct child)
    const el = getByText(labels[step - 1])
    expect(el.className).toContain('border-amber')
  })

  it('marks earlier steps as done (olive-lit border)', () => {
    useAppStore.setState({ currentStep: 3 })
    const { getByText } = renderWithI18n(<StepIndicator />)
    expect(getByText('EXPLOITATION').className).toContain('border-olive-lit')
    expect(getByText('CHAMPS').className).toContain('border-olive-lit')
  })
})
