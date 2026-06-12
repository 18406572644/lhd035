import * as THREE from 'three'
import type { Station, MetroLine, MetroMapData } from '../types'

const SCALE_2D_TO_3D = 0.1
const DEFAULT_DEPTH = 20
const DEPTH_INCREMENT = 12

export function getLineDepth(line: MetroLine, allLines: MetroLine[]): number {
  const index = allLines.indexOf(line)
  return line.tunnelDepth ?? (DEFAULT_DEPTH + index * DEPTH_INCREMENT)
}

export function stationTo3D(station: Station, lines: MetroLine[]): THREE.Vector3 {
  const stationLines = lines.filter(l => l.stationIds.includes(station.id))
  let depth = station.depth ?? station.z ?? 0
  if (stationLines.length > 0 && depth === 0) {
    depth = getLineDepth(stationLines[0], lines)
  }
  return new THREE.Vector3(
    station.x * SCALE_2D_TO_3D,
    -depth * SCALE_2D_TO_3D,
    -station.y * SCALE_2D_TO_3D
  )
}

export function getLinePoints3D(line: MetroLine, mapData: MetroMapData): THREE.Vector3[] {
  return line.stationIds
    .map(id => mapData.stations.find(s => s.id === id))
    .filter(Boolean)
    .map(s => stationTo3D(s!, mapData.lines))
}

export function createSmoothCurve3D(points: THREE.Vector3[]): THREE.CatmullRomCurve3 {
  if (points.length < 2) {
    return new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3()])
  }
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
}

export function getPointOnCurve3D(
  curve: THREE.CatmullRomCurve3,
  progress: number
): { position: THREE.Vector3; tangent: THREE.Vector3 } {
  const t = Math.max(0, Math.min(1, progress))
  const position = curve.getPointAt(t)
  const tangent = curve.getTangentAt(t)
  return { position, tangent }
}

export function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex)
}

export function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (r > w / 2) r = w / 2
  if (r > h / 2) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
