/*
 * PORTABLE BRAND — Colour Token Resolution
 *
 * Resolves brand colour tokens to hex values.
 * Supports shorthand scheme mapping (family → dark/mid/light)
 * and arbitrary token resolution for cross-family gradients.
 */

export type ColourFamily = 'lime' | 'pink' | 'blue' | 'vermillion' | 'brown'

export type ColourToken =
  | ColourFamily
  | `${ColourFamily}-dark`
  | `${ColourFamily}-light`
  | 'white'

export interface GradientColours {
  current: string
  catalyst: string
  future: string
}

const colourMap: Record<ColourToken, string> = {
  'white': '#FFFFFF',

  'lime': '#BEF958',
  'lime-dark': '#263212',
  'lime-light': '#EDFFCC',

  'brown': '#81330C',
  'brown-dark': '#341405',
  'brown-light': '#EFD8C2',

  'pink': '#FF38C0',
  'pink-dark': '#400E30',
  'pink-light': '#FFC3F6',

  'vermillion': '#EE4811',
  'vermillion-dark': '#471605',
  'vermillion-light': '#FFC6BF',

  'blue': '#4B01E6',
  'blue-dark': '#170045',
  'blue-light': '#DEDAFF',
}

export function resolveColour(token: ColourToken): string {
  return colourMap[token]
}

/**
 * Maps a colour family to the narrative gradient:
 * current (dark) → catalyst (mid, minimal) → future (light)
 */
export function resolveScheme(family: ColourFamily): GradientColours {
  return {
    current: colourMap[`${family}-dark`],
    catalyst: colourMap[family],
    future: colourMap[`${family}-light`],
  }
}

/**
 * Approved text colour pairings from the brand guidelines.
 * Each colour-scheme background has a specific cross-family
 * text colour for maximum readability.
 */
const textPairings: Record<ColourFamily, { onLight: string; onDark: string }> = {
  lime:       { onLight: colourMap['pink-dark'],       onDark: colourMap['pink-light'] },
  pink:       { onLight: colourMap['lime-dark'],       onDark: colourMap['lime-light'] },
  blue:       { onLight: colourMap['vermillion-dark'], onDark: colourMap['vermillion-light'] },
  vermillion: { onLight: colourMap['lime-dark'],       onDark: colourMap['lime-light'] },
  brown:      { onLight: colourMap['lime-dark'],       onDark: colourMap['lime-light'] },
}

/**
 * Returns the approved text colours for a scheme's light and dark panels.
 */
export function resolveTextPairing(family: ColourFamily) {
  return textPairings[family]
}
