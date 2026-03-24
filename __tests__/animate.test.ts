// __tests__/animate.test.ts
import { describe, it, expect } from 'vitest'
import { displacePointsAudio, type Point } from '../src/core/animate'

describe('displacePointsAudio', () => {
  // Simple square of points centered at (50, 50)
  const points: Point[] = [[25, 25], [75, 25], [75, 75], [25, 75]]

  it('returns same number of points', () => {
    const result = displacePointsAudio(points, 0, 0.5, 0.5, 0)
    expect(result).toHaveLength(4)
  })

  it('zero intensity returns points unchanged', () => {
    const result = displacePointsAudio(points, 0, 0, 0.5, 0)
    for (let i = 0; i < points.length; i++) {
      expect(result[i][0]).toBeCloseTo(points[i][0])
      expect(result[i][1]).toBeCloseTo(points[i][1])
    }
  })

  it('high intensity displaces points outward from centroid', () => {
    const result = displacePointsAudio(points, 0, 1.0, 0.5, 0)
    // Point [25,25] is top-left of centroid [50,50], should move further top-left
    expect(result[0][0]).toBeLessThan(25)
    expect(result[0][1]).toBeLessThan(25)
    // Point [75,75] is bottom-right, should move further bottom-right
    expect(result[2][0]).toBeGreaterThan(75)
    expect(result[2][1]).toBeGreaterThan(75)
  })

  it('higher intensity produces larger displacement', () => {
    const low = displacePointsAudio(points, 0, 0.3, 0.5, 0)
    const high = displacePointsAudio(points, 0, 0.9, 0.5, 0)
    const lowDist = Math.abs(low[0][0] - points[0][0])
    const highDist = Math.abs(high[0][0] - points[0][0])
    expect(highDist).toBeGreaterThan(lowDist)
  })

  it('high centroid produces more varied displacement across vertices', () => {
    // Use 24 points in a circle for statistically meaningful variance comparison
    const cx = 50, cy = 50, r = 30
    const circlePoints: Point[] = Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as Point
    })
    const smooth = displacePointsAudio(circlePoints, 1.0, 0.8, 0.1, 0)
    const spiky = displacePointsAudio(circlePoints, 1.0, 0.8, 0.9, 0)
    // Measure variance of displacement magnitudes
    function variance(displaced: Point[], base: Point[]): number {
      const mags = displaced.map((p, i) => {
        const dx = p[0] - base[i][0]
        const dy = p[1] - base[i][1]
        return Math.sqrt(dx * dx + dy * dy)
      })
      const mean = mags.reduce((a, b) => a + b) / mags.length
      return mags.reduce((a, m) => a + (m - mean) ** 2, 0) / mags.length
    }
    expect(variance(spiky, circlePoints)).toBeGreaterThan(variance(smooth, circlePoints))
  })
})
