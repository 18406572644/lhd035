export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  return path
}

export function getPointOnPath(
  points: { x: number; y: number }[],
  progress: number
): { x: number; y: number; angle: number } {
  if (points.length < 2) return { x: points[0]?.x || 0, y: points[0]?.y || 0, angle: 0 }

  const totalSegments = points.length - 1
  const segmentProgress = progress * totalSegments
  const segmentIndex = Math.floor(Math.min(segmentProgress, totalSegments - 1))
  const t = segmentProgress - segmentIndex

  const p0 = points[segmentIndex - 1] || points[segmentIndex]
  const p1 = points[segmentIndex]
  const p2 = points[segmentIndex + 1]
  const p3 = points[segmentIndex + 2] || p2

  const cp1x = p1.x + (p2.x - p0.x) / 6
  const cp1y = p1.y + (p2.y - p0.y) / 6
  const cp2x = p2.x - (p3.x - p1.x) / 6
  const cp2y = p2.y - (p3.y - p1.y) / 6

  const x = cubicBezier(t, p1.x, cp1x, cp2x, p2.x)
  const y = cubicBezier(t, p1.y, cp1y, cp2y, p2.y)

  const dx = cubicBezierDerivative(t, p1.x, cp1x, cp2x, p2.x)
  const dy = cubicBezierDerivative(t, p1.y, cp1y, cp2y, p2.y)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)

  return { x, y, angle }
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

function cubicBezierDerivative(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2)
}
