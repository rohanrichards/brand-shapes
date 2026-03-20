export interface BrandColour {
  name: string
  hex: string
}

export interface GradientColours {
  current: string
  catalyst: string
  future: string
}

export const BRAND_PALETTE: BrandColour[] = [
  { name: 'lime-dark', hex: '#263212' },
  { name: 'lime', hex: '#BEF958' },
  { name: 'lime-light', hex: '#EDFFCC' },
  { name: 'brown-dark', hex: '#341405' },
  { name: 'brown', hex: '#81330C' },
  { name: 'brown-light', hex: '#EFD8C2' },
  { name: 'pink-dark', hex: '#400E30' },
  { name: 'pink', hex: '#FF38C0' },
  { name: 'pink-light', hex: '#FFC3F6' },
  { name: 'vermillion-dark', hex: '#471605' },
  { name: 'vermillion', hex: '#EE4811' },
  { name: 'vermillion-light', hex: '#FFC6BF' },
  { name: 'blue-dark', hex: '#170045' },
  { name: 'blue', hex: '#4B01E6' },
  { name: 'blue-light', hex: '#DEDAFF' },
  { name: 'white', hex: '#FFFFFF' },
]

const hexMap = new Map(BRAND_PALETTE.map(c => [c.name, c.hex]))

export function getColourHex(name: string): string | undefined {
  return hexMap.get(name)
}

export const brandColourNames = BRAND_PALETTE.map(c => c.name)

export const brandColourHexes = BRAND_PALETTE.map(c => c.hex)

/**
 * Off-palette colours used by Figma presets.
 * NOT part of the core brand palette, but needed as dropdown options
 * so preset colours display correctly in lil-gui.
 */
export const PRESET_EXTRAS: BrandColour[] = [
  { name: 'rose-accent', hex: '#FEA6E1' },
  { name: 'alt-lime', hex: '#C2F462' },
]

export const allColourHexes = [...brandColourHexes, ...PRESET_EXTRAS.map(c => c.hex)]
