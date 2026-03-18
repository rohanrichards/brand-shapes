import { describe, it, expect } from 'vitest'
import {
  resolveColour,
  resolveScheme,
  resolveTextPairing,
  type ColourFamily,
} from '../src/core/colours'

describe('resolveColour', () => {
  it('resolves all 5 mid-tone tokens', () => {
    expect(resolveColour('lime')).toBe('#BEF958')
    expect(resolveColour('pink')).toBe('#FF38C0')
    expect(resolveColour('blue')).toBe('#4B01E6')
    expect(resolveColour('vermillion')).toBe('#EE4811')
    expect(resolveColour('brown')).toBe('#81330C')
  })

  it('resolves dark variant tokens', () => {
    expect(resolveColour('lime-dark')).toBe('#263212')
    expect(resolveColour('pink-dark')).toBe('#400E30')
    expect(resolveColour('blue-dark')).toBe('#170045')
    expect(resolveColour('vermillion-dark')).toBe('#471605')
    expect(resolveColour('brown-dark')).toBe('#341405')
  })

  it('resolves light variant tokens', () => {
    expect(resolveColour('lime-light')).toBe('#EDFFCC')
    expect(resolveColour('pink-light')).toBe('#FFC3F6')
    expect(resolveColour('blue-light')).toBe('#DEDAFF')
    expect(resolveColour('vermillion-light')).toBe('#FFC6BF')
    expect(resolveColour('brown-light')).toBe('#EFD8C2')
  })

  it('resolves white', () => {
    expect(resolveColour('white')).toBe('#FFFFFF')
  })
})

describe('resolveScheme', () => {
  it('maps lime to dark/mid/light narrative gradient', () => {
    expect(resolveScheme('lime')).toEqual({
      current: '#263212',
      catalyst: '#BEF958',
      future: '#EDFFCC',
    })
  })

  it('maps all 5 families correctly', () => {
    const families: ColourFamily[] = ['lime', 'pink', 'blue', 'vermillion', 'brown']
    for (const family of families) {
      const result = resolveScheme(family)
      expect(result.current, `${family} current`).toBeTruthy()
      expect(result.catalyst, `${family} catalyst`).toBeTruthy()
      expect(result.future, `${family} future`).toBeTruthy()
      expect(result.current).not.toBe(result.catalyst)
      expect(result.catalyst).not.toBe(result.future)
    }
  })
})

describe('resolveTextPairing', () => {
  it('returns cross-family text colours for lime', () => {
    const pairing = resolveTextPairing('lime')
    expect(pairing.onLight).toBe('#400E30')
    expect(pairing.onDark).toBe('#FFC3F6')
  })

  it('all 5 families have text pairings', () => {
    const families: ColourFamily[] = ['lime', 'pink', 'blue', 'vermillion', 'brown']
    for (const family of families) {
      const pairing = resolveTextPairing(family)
      expect(pairing.onLight, `${family} onLight`).toMatch(/^#[0-9A-F]{6}$/i)
      expect(pairing.onDark, `${family} onDark`).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})
