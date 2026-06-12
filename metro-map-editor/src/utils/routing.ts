import type { MetroMapData, Station, MetroLine, RouteResult, PathSegment } from '../types'
import { distance as calcDistance } from './path'

interface GraphNode {
  stationId: string
  lineId: string
}

interface GraphEdge {
  from: GraphNode
  to: GraphNode
  weight: number
  type: 'line' | 'transfer'
}

function buildGraph(mapData: MetroMapData): Map<string, GraphNode[]> {
  const adjacencyList = new Map<string, GraphNode[]>()

  for (const line of mapData.lines) {
    for (let i = 0; i < line.stationIds.length; i++) {
      const stationId = line.stationIds[i]
      const key = `${stationId}_${line.id}`
      const node: GraphNode = { stationId, lineId: line.id }

      if (!adjacencyList.has(key)) {
        adjacencyList.set(key, [])
      }

      if (i > 0) {
        const prevStationId = line.stationIds[i - 1]
        const prevKey = `${prevStationId}_${line.id}`
        adjacencyList.get(key)?.push({ stationId: prevStationId, lineId: line.id })
        adjacencyList.get(prevKey)?.push(node)
      }

      const station = mapData.stations.find(s => s.id === stationId)
      if (station?.isTransfer && station.transferLines) {
        for (const transferLineId of station.transferLines) {
          if (transferLineId !== line.id) {
            const transferKey = `${stationId}_${transferLineId}`
            const transferNode = adjacencyList.get(transferKey)
            if (transferNode && !transferNode.some(n => n.lineId === line.id && n.stationId === stationId)) {
              adjacencyList.get(key)?.push({ stationId, lineId: transferLineId })
            }
          }
        }
      }
    }
  }

  return adjacencyList
}

function getNodeKey(stationId: string, lineId: string): string {
  return `${stationId}_${lineId}`
}

function getStationLines(mapData: MetroMapData, stationId: string): string[] {
  return mapData.lines
    .filter(line => line.stationIds.includes(stationId))
    .map(line => line.id)
}

interface DijkstraResult {
  distance: number
  prevNode: string | null
  prevEdgeType: 'line' | 'transfer' | null
}

function dijkstra(
  adjacencyList: Map<string, GraphNode[]>,
  startKeys: string[],
  mapData: MetroMapData
): Map<string, DijkstraResult> {
  const distances = new Map<string, DijkstraResult>()
  const visited = new Set<string>()
  const priorityQueue: { key: string; distance: number }[] = []

  for (const startKey of startKeys) {
    distances.set(startKey, { distance: 0, prevNode: null, prevEdgeType: null })
    priorityQueue.push({ key: startKey, distance: 0 })
  }

  while (priorityQueue.length > 0) {
    priorityQueue.sort((a, b) => a.distance - b.distance)
    const current = priorityQueue.shift()!

    if (visited.has(current.key)) continue
    visited.add(current.key)

    const neighbors = adjacencyList.get(current.key) || []
    for (const neighbor of neighbors) {
      const neighborKey = getNodeKey(neighbor.stationId, neighbor.lineId)
      if (visited.has(neighborKey)) continue

      const currentStationId = current.key.split('_')[0]
      const currentLineId = current.key.split('_').slice(1).join('_')

      let weight: number
      let edgeType: 'line' | 'transfer'

      if (currentStationId === neighbor.stationId) {
        weight = 0.1
        edgeType = 'transfer'
      } else {
        const stationA = mapData.stations.find(s => s.id === currentStationId)
        const stationB = mapData.stations.find(s => s.id === neighbor.stationId)
        if (stationA && stationB) {
          weight = calcDistance(stationA.x, stationA.y, stationB.x, stationB.y)
        } else {
          weight = 1
        }
        edgeType = 'line'
      }

      const newDistance = current.distance + weight

      if (!distances.has(neighborKey) || newDistance < distances.get(neighborKey)!.distance) {
        distances.set(neighborKey, {
          distance: newDistance,
          prevNode: current.key,
          prevEdgeType: edgeType
        })
        priorityQueue.push({ key: neighborKey, distance: newDistance })
      }
    }
  }

  return distances
}

function reconstructPath(
  distances: Map<string, DijkstraResult>,
  endStationId: string,
  mapData: MetroMapData
): { path: GraphNode[]; transferCount: number } | null {
  const endLines = getStationLines(mapData, endStationId)
  let bestEndKey: string | null = null
  let bestDistance = Infinity

  for (const lineId of endLines) {
    const key = getNodeKey(endStationId, lineId)
    const result = distances.get(key)
    if (result && result.distance < bestDistance) {
      bestDistance = result.distance
      bestEndKey = key
    }
  }

  if (!bestEndKey) return null

  const path: GraphNode[] = []
  let currentKey: string | null = bestEndKey
  let transferCount = 0

  while (currentKey) {
    const [stationId, ...lineIdParts] = currentKey.split('_')
    const lineId = lineIdParts.join('_')
    path.unshift({ stationId, lineId })

    const result = distances.get(currentKey)
    if (result?.prevEdgeType === 'transfer') {
      transferCount++
    }
    currentKey = result?.prevNode || null
  }

  return { path, transferCount: Math.floor(transferCount / 2) }
}

export function findRoute(
  mapData: MetroMapData,
  fromStationId: string,
  toStationId: string
): RouteResult | null {
  if (fromStationId === toStationId) {
    return {
      totalDistance: 0,
      totalStations: 0,
      transferCount: 0,
      segments: [],
      stationIds: [fromStationId],
      lineIds: []
    }
  }

  const adjacencyList = buildGraph(mapData)
  const fromLines = getStationLines(mapData, fromStationId)
  const startKeys = fromLines.map(lineId => getNodeKey(fromStationId, lineId))

  if (startKeys.length === 0) return null

  const distances = dijkstra(adjacencyList, startKeys, mapData)
  const pathResult = reconstructPath(distances, toStationId, mapData)

  if (!pathResult) return null

  const { path, transferCount } = pathResult
  const segments: PathSegment[] = []
  const stationIds: string[] = []
  const lineIds: string[] = []

  let currentLineId = path[0].lineId
  let segmentStartStationId = path[0].stationId
  let segmentStations: string[] = [segmentStartStationId]

  stationIds.push(path[0].stationId)
  lineIds.push(path[0].lineId)

  for (let i = 1; i < path.length; i++) {
    const node = path[i]

    if (node.stationId === path[i - 1].stationId) {
      continue
    }

    if (node.lineId !== currentLineId) {
      const line = mapData.lines.find(l => l.id === currentLineId)
      const segmentDistance = calculateSegmentDistance(mapData, segmentStations)
      segments.push({
        lineId: currentLineId,
        lineName: line?.name || currentLineId,
        fromStationId: segmentStartStationId,
        toStationId: path[i - 1].stationId,
        stationCount: segmentStations.length - 1,
        distance: segmentDistance
      })

      currentLineId = node.lineId
      segmentStartStationId = path[i - 1].stationId
      segmentStations = [segmentStartStationId]

      if (!lineIds.includes(node.lineId)) {
        lineIds.push(node.lineId)
      }
    }

    segmentStations.push(node.stationId)
    if (!stationIds.includes(node.stationId)) {
      stationIds.push(node.stationId)
    }
  }

  if (segmentStations.length > 0) {
    const line = mapData.lines.find(l => l.id === currentLineId)
    const segmentDistance = calculateSegmentDistance(mapData, segmentStations)
    segments.push({
      lineId: currentLineId,
      lineName: line?.name || currentLineId,
      fromStationId: segmentStartStationId,
      toStationId: path[path.length - 1].stationId,
      stationCount: segmentStations.length - 1,
      distance: segmentDistance
    })
  }

  const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0)
  const totalStations = stationIds.length - 1

  return {
    totalDistance,
    totalStations,
    transferCount,
    segments,
    stationIds,
    lineIds
  }
}

function calculateSegmentDistance(mapData: MetroMapData, stationIds: string[]): number {
  let distance = 0
  for (let i = 1; i < stationIds.length; i++) {
    const prev = mapData.stations.find(s => s.id === stationIds[i - 1])
    const curr = mapData.stations.find(s => s.id === stationIds[i])
    if (prev && curr) {
      distance += calcDistance(prev.x, prev.y, curr.x, curr.y)
    }
  }
  return distance
}

export function calculateStationDistance(
  mapData: MetroMapData,
  fromStationId: string,
  toStationId: string
): number {
  const route = findRoute(mapData, fromStationId, toStationId)
  return route?.totalDistance || 0
}

export function getAllStationPairs(mapData: MetroMapData): { from: Station; to: Station }[] {
  const pairs: { from: Station; to: Station }[] = []
  for (let i = 0; i < mapData.stations.length; i++) {
    for (let j = i + 1; j < mapData.stations.length; j++) {
      pairs.push({ from: mapData.stations[i], to: mapData.stations[j] })
    }
  }
  return pairs
}

export function getStationById(mapData: MetroMapData, stationId: string): Station | undefined {
  return mapData.stations.find(s => s.id === stationId)
}

export function getLineById(mapData: MetroMapData, lineId: string): MetroLine | undefined {
  return mapData.lines.find(l => l.id === lineId)
}
