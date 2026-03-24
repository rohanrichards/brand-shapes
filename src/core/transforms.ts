export type Alignment = 'left' | 'right' | 'top' | 'bottom' | 'center'

/** Fast centroid from SVG path string — averages all coordinate pairs. */
export function pathCentroid(pathStr: string): [number, number] {
  const nums = pathStr.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)
  if (!nums || nums.length < 2) return [0, 0]
  let sx = 0, sy = 0, count = 0
  for (let i = 0; i < nums.length - 1; i += 2) {
    sx += parseFloat(nums[i])
    sy += parseFloat(nums[i + 1])
    count++
  }
  return [sx / count, sy / count]
}

/**
 * Per-step transform for filled/gradient variants.
 * Back steps scale larger with offset; front steps scale smaller.
 */
export function computeStepTransform(
  stepIndex: number,
  totalSteps: number,
  align: Alignment,
  spread: number,
  scaleFrom: number,
  scaleTo: number,
): { scale: number; offsetX: number; offsetY: number } {
  const t = totalSteps === 1 ? 0 : stepIndex / (totalSteps - 1)
  const scale = scaleFrom + (scaleTo - scaleFrom) * t
  const maxOffset = 15 * spread
  const offset = (1 - t) * maxOffset

  let offsetX = 0
  let offsetY = 0
  switch (align) {
    case 'left': offsetX = -offset; break
    case 'right': offsetX = offset; break
    case 'top': offsetY = -offset; break
    case 'bottom': offsetY = offset; break
    case 'center': break
  }

  return { scale, offsetX, offsetY }
}
