// Pure logo data and placement math. Zero DOM dependencies.
//
// Path strings are copied verbatim from src/demo/assets/logo-source-*.svg.
// body uses fill-rule="evenodd" (the P has a hole); slash is a parallelogram.

export type LogoColor = 'black' | 'white'

export const LOGO_VIEWBOX = { width: 240, height: 213 } as const
export const LOGO_BASE = { width: 100, height: 88, padding: 48 } as const
export const LOGO_REFERENCE = { width: 1920, height: 1080 } as const

export const LOGO_PATHS = {
  body: 'M0 0.996613V212.997H47.8309V154.305H86.4413C97.8708 154.305 108.196 152.235 117.416 148.096C126.733 143.956 134.656 138.387 141.187 131.39C147.815 124.392 152.905 116.261 156.459 106.997C160.013 97.7321 161.789 87.9747 161.789 77.7245C161.789 67.376 160.013 57.5695 156.459 48.3048C152.905 39.0405 147.815 30.9091 141.187 23.9114C134.656 16.9138 126.733 11.3455 117.416 7.20585C108.196 3.06624 97.8708 0.996613 86.4413 0.996613H0ZM80.5345 114.241H47.8309V41.0609H80.5345C85.5289 41.0609 90.0911 42.0956 94.2211 44.1656C98.351 46.1365 101.809 48.7975 104.594 52.1487C107.475 55.4012 109.684 59.2942 111.221 63.8279C112.854 68.2632 113.67 72.8952 113.67 77.7245C113.67 82.5539 112.854 87.1862 111.221 91.6216C109.684 96.0565 107.475 99.9496 104.594 103.301C101.809 106.553 98.303 109.214 94.077 111.284C89.947 113.255 85.4328 114.241 80.5345 114.241Z',
  slash: 'M240 4.20461L94.7983 212.997H74.0907L219.876 4.20461H240Z',
} as const

export const LOGO_FILL = { black: '#181818', white: '#FCFCFC' } as const

export interface LogoPlacement {
  x: number
  y: number
  width: number
  height: number
  padding: number
  scale: number
}

/**
 * Place the logo at bottom-left, scaled proportionally to the export canvas.
 * scale = min(W/1920, H/1080). min() prevents disproportionate growth on
 * extreme aspects (wide banners, tall posters).
 */
export function computeLogoPlacement(
  canvasWidth: number,
  canvasHeight: number,
): LogoPlacement {
  const scale = Math.min(
    canvasWidth / LOGO_REFERENCE.width,
    canvasHeight / LOGO_REFERENCE.height,
  )
  const width = LOGO_BASE.width * scale
  const height = LOGO_BASE.height * scale
  const padding = LOGO_BASE.padding * scale
  return {
    x: padding,
    y: canvasHeight - padding - height,
    width,
    height,
    padding,
    scale,
  }
}
