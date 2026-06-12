import type {
  MetroMapData,
  Station,
  MetroLine,
  Version,
  Branch,
  MergeConflict,
  MergeResult
} from '../types'
import { isEqual } from './diff'
import { findCommonAncestor } from './versionManager'
import { generateId } from './path'

const STATION_MERGE_PROPS: (keyof Station)[] = [
  'name', 'x', 'y', 'z', 'isTransfer', 'transferLines',
  'exits', 'description', 'depth', 'stationFloors'
]

const LINE_MERGE_PROPS: (keyof MetroLine)[] = [
  'name', 'color', 'tunnelRadius', 'tunnelDepth'
]

export { isEqual } from './diff'

export function mergeBranches(
  versions: Version[],
  baseBranch: Branch,
  targetBranch: Branch,
  sourceBranch: Branch
): MergeResult {
  const targetVersion = versions.find(v => v.id === targetBranch.currentVersionId)
  const sourceVersion = versions.find(v => v.id === sourceBranch.currentVersionId)

  if (!targetVersion || !sourceVersion) {
    return {
      success: false,
      conflicts: [],
      autoMergedCount: 0,
      conflictCount: 0
    }
  }

  const ancestorVersion = findCommonAncestor(
    versions,
    targetVersion.id,
    sourceVersion.id
  )

  const baseData = ancestorVersion?.data || targetVersion.data
  const targetData = targetVersion.data
  const sourceData = sourceVersion.data

  return mergeMapDatas(baseData, targetData, sourceData)
}

export function mergeMapDatas(
  baseData: MetroMapData,
  ourData: MetroMapData,
  theirData: MetroMapData
): MergeResult {
  const mergedStationsResult = mergeStations(baseData, ourData, theirData)
  const mergedLinesResult = mergeLines(baseData, ourData, theirData, mergedStationsResult.stations)

  const mergedMapName = mergeMapName(baseData, ourData, theirData)

  const allConflicts = [...mergedStationsResult.conflicts, ...mergedLinesResult.conflicts]
  const mergedData: MetroMapData = {
    mapName: mergedMapName.value || ourData.mapName,
    stations: mergedStationsResult.stations,
    lines: mergedLinesResult.lines,
    createdAt: ourData.createdAt,
    updatedAt: Date.now()
  }

  return {
    success: allConflicts.length === 0,
    conflicts: allConflicts,
    mergedData,
    autoMergedCount: mergedStationsResult.autoMerged + mergedLinesResult.autoMerged,
    conflictCount: allConflicts.length
  }
}

function mergeMapName(
  baseData: MetroMapData,
  ourData: MetroMapData,
  theirData: MetroMapData
): { value: string | null; conflict?: MergeConflict } {
  const base = baseData.mapName
  const ours = ourData.mapName
  const theirs = theirData.mapName

  if (ours === theirs) {
    return { value: ours }
  }

  if (base === ours) {
    return { value: theirs }
  }

  if (base === theirs) {
    return { value: ours }
  }

  const conflict: MergeConflict = {
    id: 'conflict_' + generateId(),
    type: 'map-property',
    targetId: 'map',
    targetName: '地图名称',
    property: 'mapName',
    baseValue: base,
    ourValue: ours,
    theirValue: theirs,
    description: '地图名称存在冲突',
    resolution: null
  }

  return { value: null, conflict }
}

interface MergeStationsResult {
  stations: Station[]
  conflicts: MergeConflict[]
  autoMerged: number
}

function mergeStations(
  baseData: MetroMapData,
  ourData: MetroMapData,
  theirData: MetroMapData
): MergeStationsResult {
  const conflicts: MergeConflict[] = []
  let autoMerged = 0

  const baseStations = new Map(baseData.stations.map(s => [s.id, s]))
  const ourStations = new Map(ourData.stations.map(s => [s.id, s]))
  const theirStations = new Map(theirData.stations.map(s => [s.id, s]))
  const allStationIds = new Set([
    ...baseStations.keys(),
    ...ourStations.keys(),
    ...theirStations.keys()
  ])

  const mergedStations: Station[] = []

  for (const id of allStationIds) {
    const base = baseStations.get(id)
    const ours = ourStations.get(id)
    const theirs = theirStations.get(id)

    const result = mergeSingleStation(id, base || null, ours || null, theirs || null)

    if (result.conflict) {
      conflicts.push(result.conflict)
    }

    if (result.station) {
      mergedStations.push(result.station)
      autoMerged++
    }
  }

  return { stations: mergedStations, conflicts, autoMerged }
}

interface MergeSingleStationResult {
  station: Station | null
  conflict?: MergeConflict
}

function mergeSingleStation(
  stationId: string,
  base: Station | null,
  ours: Station | null,
  theirs: Station | null
): MergeSingleStationResult {
  if (ours && theirs) {
    return mergeModifiedStation(stationId, base, ours, theirs)
  }

  if (!ours && !theirs) {
    return { station: null }
  }

  if (base && !ours && !theirs) {
    return { station: null }
  }

  if (base && ours && !theirs) {
    if (JSON.stringify(base) === JSON.stringify(ours)) {
      return { station: null }
    }
    return { station: { ...ours } }
  }

  if (base && !ours && theirs) {
    if (JSON.stringify(base) === JSON.stringify(theirs)) {
      return { station: null }
    }
    return { station: { ...theirs } }
  }

  const kept = ours || theirs
  if (kept) {
    return { station: { ...kept } }
  }

  return { station: null }
}

function mergeModifiedStation(
  stationId: string,
  base: Station | null,
  ours: Station,
  theirs: Station
): MergeSingleStationResult {
  const merged: Partial<Station> = { ...ours }
  let hasConflict = false
  const conflictDetails: string[] = []

  for (const prop of STATION_MERGE_PROPS) {
    const baseVal = base?.[prop]
    const ourVal = ours[prop]
    const theirVal = theirs[prop]

    const mergeResult = mergeProperty(ourVal, theirVal, baseVal)

    if (mergeResult.conflict) {
      hasConflict = true
      conflictDetails.push(prop)
    } else if (mergeResult.value !== undefined) {
      ;(merged as Record<string, unknown>)[prop] = mergeResult.value
    }
  }

  if (hasConflict) {
    const conflict: MergeConflict = {
      id: 'conflict_' + generateId(),
      type: 'station',
      targetId: stationId,
      targetName: ours.name || theirs.name || stationId,
      description: `站点属性冲突：${conflictDetails.join('、')}`,
      baseValue: base,
      ourValue: ours,
      theirValue: theirs,
      resolution: null
    }
    return { station: merged as Station, conflict }
  }

  return { station: merged as Station }
}

interface MergeLinesResult {
  lines: MetroLine[]
  conflicts: MergeConflict[]
  autoMerged: number
}

function mergeLines(
  baseData: MetroMapData,
  ourData: MetroMapData,
  theirData: MetroMapData,
  mergedStations: Station[]
): MergeLinesResult {
  const conflicts: MergeConflict[] = []
  let autoMerged = 0

  const baseLines = new Map(baseData.lines.map(l => [l.id, l]))
  const ourLines = new Map(ourData.lines.map(l => [l.id, l]))
  const theirLines = new Map(theirData.lines.map(l => [l.id, l]))
  const allLineIds = new Set([
    ...baseLines.keys(),
    ...ourLines.keys(),
    ...theirLines.keys()
  ])

  const mergedLines: MetroLine[] = []
  const validStationIds = new Set(mergedStations.map(s => s.id))

  for (const id of allLineIds) {
    const base = baseLines.get(id)
    const ours = ourLines.get(id)
    const theirs = theirLines.get(id)

    const result = mergeSingleLine(id, base || null, ours || null, theirs || null, validStationIds)

    if (result.conflict) {
      conflicts.push(result.conflict)
    }

    if (result.line) {
      mergedLines.push(result.line)
      autoMerged++
    }
  }

  return { lines: mergedLines, conflicts, autoMerged }
}

interface MergeSingleLineResult {
  line: MetroLine | null
  conflict?: MergeConflict
}

function mergeSingleLine(
  lineId: string,
  base: MetroLine | null,
  ours: MetroLine | null,
  theirs: MetroLine | null,
  validStationIds: Set<string>
): MergeSingleLineResult {
  if (ours && theirs) {
    return mergeModifiedLine(lineId, base, ours, theirs, validStationIds)
  }

  if (!ours && !theirs) {
    return { line: null }
  }

  if (base && !ours && !theirs) {
    return { line: null }
  }

  if (base && ours && !theirs) {
    if (JSON.stringify(base) === JSON.stringify(ours)) {
      return { line: null }
    }
    return { line: filterLineStations({ ...ours }, validStationIds) }
  }

  if (base && !ours && theirs) {
    if (JSON.stringify(base) === JSON.stringify(theirs)) {
      return { line: null }
    }
    return { line: filterLineStations({ ...theirs }, validStationIds) }
  }

  const kept = ours || theirs
  if (kept) {
    return { line: filterLineStations({ ...kept }, validStationIds) }
  }

  return { line: null }
}

function mergeModifiedLine(
  lineId: string,
  base: MetroLine | null,
  ours: MetroLine,
  theirs: MetroLine,
  validStationIds: Set<string>
): MergeSingleLineResult {
  const merged: Partial<MetroLine> = { ...ours }
  let hasConflict = false
  const conflictDetails: string[] = []

  for (const prop of LINE_MERGE_PROPS) {
    const baseVal = base?.[prop]
    const ourVal = ours[prop]
    const theirVal = theirs[prop]

    const mergeResult = mergeProperty(ourVal, theirVal, baseVal)

    if (mergeResult.conflict) {
      hasConflict = true
      conflictDetails.push(prop)
    } else if (mergeResult.value !== undefined) {
      ;(merged as Record<string, unknown>)[prop] = mergeResult.value
    }
  }

  const stationMergeResult = mergeStationIds(
    base?.stationIds || [],
    ours.stationIds,
    theirs.stationIds
  )

  if (stationMergeResult.conflict) {
    hasConflict = true
    conflictDetails.push('站点顺序')
  }

  merged.stationIds = stationMergeResult.value

  const finalLine = filterLineStations(merged as MetroLine, validStationIds)

  if (hasConflict) {
    const conflict: MergeConflict = {
      id: 'conflict_' + generateId(),
      type: 'line',
      targetId: lineId,
      targetName: ours.name || theirs.name || lineId,
      description: `线路属性冲突：${conflictDetails.join('、')}`,
      baseValue: base,
      ourValue: ours,
      theirValue: theirs,
      resolution: null
    }
    return { line: finalLine, conflict }
  }

  return { line: finalLine }
}

interface MergePropertyResult {
  value?: unknown
  conflict: boolean
}

function mergeProperty(
  ours: unknown,
  theirs: unknown,
  base: unknown
): MergePropertyResult {
  if (isEqual(ours, theirs)) {
    return { value: ours, conflict: false }
  }

  if (isEqual(base, ours)) {
    return { value: theirs, conflict: false }
  }

  if (isEqual(base, theirs)) {
    return { value: ours, conflict: false }
  }

  return { conflict: true }
}

interface MergeStationIdsResult {
  value: string[]
  conflict: boolean
}

function mergeStationIds(
  base: string[],
  ours: string[],
  theirs: string[]
): MergeStationIdsResult {
  if (JSON.stringify(ours) === JSON.stringify(theirs)) {
    return { value: ours, conflict: false }
  }

  if (JSON.stringify(base) === JSON.stringify(ours)) {
    return { value: theirs, conflict: false }
  }

  if (JSON.stringify(base) === JSON.stringify(theirs)) {
    return { value: ours, conflict: false }
  }

  const merged: string[] = []
  const ourSet = new Set(ours)
  const theirSet = new Set(theirs)
  const baseSet = new Set(base)

  for (const id of ours) {
    if (theirSet.has(id)) {
      merged.push(id)
    }
  }

  for (const id of theirs) {
    if (!merged.includes(id)) {
      merged.push(id)
    }
  }

  for (const id of ours) {
    if (!merged.includes(id)) {
      merged.push(id)
    }
  }

  return { value: merged, conflict: true }
}

function filterLineStations(line: MetroLine, validStationIds: Set<string>): MetroLine {
  return {
    ...line,
    stationIds: line.stationIds.filter(id => validStationIds.has(id))
  }
}

export function resolveConflict(
  mergedData: MetroMapData,
  conflict: MergeConflict,
  resolution: 'base' | 'ours' | 'theirs'
): MetroMapData {
  const data = { ...mergedData }
  const value = resolution === 'base' ? conflict.baseValue
    : resolution === 'ours' ? conflict.ourValue
    : conflict.theirValue

  if (conflict.type === 'map-property' && conflict.property === 'mapName') {
    data.mapName = value as string
  }

  if (conflict.type === 'station') {
    const station = value as Station
    data.stations = data.stations.map(s =>
      s.id === conflict.targetId ? { ...station } : s
    )
  }

  if (conflict.type === 'line') {
    const line = value as MetroLine
    const validStationIds = new Set(data.stations.map(s => s.id))
    data.lines = data.lines.map(l =>
      l.id === conflict.targetId
        ? filterLineStations({ ...line }, validStationIds)
        : l
    )
  }

  return data
}

export function applyAllResolutions(
  mergedData: MetroMapData,
  conflicts: MergeConflict[]
): MetroMapData {
  let data = { ...mergedData }

  for (const conflict of conflicts) {
    if (conflict.resolution) {
      data = resolveConflict(data, conflict, conflict.resolution)
    }
  }

  return data
}

export function canAutoResolveConflicts(
  conflicts: MergeConflict[],
  strategy: 'prefer-ours' | 'prefer-theirs' | 'prefer-base'
): MergeConflict[] {
  const resolutionMap = strategy === 'prefer-ours' ? 'ours'
    : strategy === 'prefer-theirs' ? 'theirs'
    : 'base'

  return conflicts.map(c => ({ ...c, resolution: resolutionMap as 'base' | 'ours' | 'theirs' }))
}
