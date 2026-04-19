import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('has a working DOM (jsdom)', () => {
    const div = document.createElement('div')
    div.textContent = 'hello'
    document.body.appendChild(div)
    expect(document.body.textContent).toContain('hello')
  })
})
