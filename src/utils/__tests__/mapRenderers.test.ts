import { describe, it, expect } from 'vitest'
import { createPointIcon, getMap, setMap, clearMap } from '../mapRenderers'
import L from 'leaflet'

describe('createPointIcon', () => {
  it('returns a L.DivIcon', () => {
    const icon = createPointIcon('#ff0000', 'A')
    expect(icon).toBeInstanceOf(L.DivIcon)
  })

  it('embeds the color in the SVG', () => {
    const icon = createPointIcon('#123456', 'X')
    // getHtml() is not a public API, so read via options.html
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = (icon.options as any).html as string
    expect(html).toContain('#123456')
  })

  it('embeds the label', () => {
    const icon = createPointIcon('#fff', 'POINT-42')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = (icon.options as any).html as string
    expect(html).toContain('POINT-42')
  })

  it('uses a 32×40 icon size with the pin anchored at the bottom centre', () => {
    const icon = createPointIcon('#000', 'A')
    expect(icon.options.iconSize).toEqual([32, 40])
    expect(icon.options.iconAnchor).toEqual([16, 40])
  })
})

describe('map singleton (getMap/setMap/clearMap)', () => {
  it('starts as null', () => {
    clearMap()
    expect(getMap()).toBeNull()
  })

  it('setMap + getMap round-trip', () => {
    // happy-dom doesn't render Leaflet maps; create a minimal stub
    const fakeMap = {} as L.Map
    setMap(fakeMap)
    expect(getMap()).toBe(fakeMap)
    clearMap()
  })

  it('clearMap resets to null', () => {
    const fakeMap = {} as L.Map
    setMap(fakeMap)
    clearMap()
    expect(getMap()).toBeNull()
  })
})
