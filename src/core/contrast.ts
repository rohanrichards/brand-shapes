/**
 * WCAG 2.x contrast math. Pure functions, no DOM dependencies.
 *
 * Used by the demo to surface the contrast ratio between the logo color and
 * the average color of the canvas region beneath the logo, so designers can
 * tune logo color against any background or shape overlay.
 */

export type RGB = [number, number, number]

/**
 * Parse a 6-digit hex color string (with or without leading #) to an RGB
 * triple of integers 0-255. Returns [0, 0, 0] for any unparseable input.
 */
export function parseHexColor(hex: string): RGB {
  const cleaned = hex.replace(/^#/, '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return [0, 0, 0]
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return [r, g, b]
}

/**
 * WCAG 2.x relative luminance for an sRGB triple (each channel 0-255).
 * Returns a value in [0, 1].
 *
 * See https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(rgb: RGB): number {
  const linearize = (c: number): number => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = rgb
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

/**
 * WCAG 2.x contrast ratio between two sRGB triples. Returns a value in
 * [1, 21]. Argument order does not matter.
 *
 * See https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [light, dark] = la > lb ? [la, lb] : [lb, la]
  return (light + 0.05) / (dark + 0.05)
}

export type WcagTier = 'fail' | 'AA-large' | 'AA' | 'AAA'

/**
 * Map a contrast ratio to its WCAG tier label:
 * - fail: < 3:1
 * - AA-large: 3:1 to 4.5:1 (large text / UI components)
 * - AA: 4.5:1 to 7:1 (normal text)
 * - AAA: >= 7:1 (enhanced contrast)
 */
export function wcagTier(ratio: number): WcagTier {
  if (ratio < 3) return 'fail'
  if (ratio < 4.5) return 'AA-large'
  if (ratio < 7) return 'AA'
  return 'AAA'
}
