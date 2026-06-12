import type {
  MetroMapData,
  Station,
  MetroLine,
  MapDiff,
  StationDiff,
  LineDiff,
  PropertyDiff,
  LineStationOrderChange,
  ChangeType
} from '../types'

const STATION_COMPARE_PROPS: (keyof Station)[] = [
  'name', 'x', 'y', 'z', 'isTransfer', 'transferLines',
  'exits', 'description', 'depth', 'stationFloors'
]

const LINE_COMPARE_PROPS: (keyof MetroLine)[] = [
  'name', 'color', 'tunnelRadius', 'tunnelDepth'
]

export function compareMaps(
  oldData: MetroMapData,
  newData: MetroMapData
): MapDiff {
  const stationDiffs = compareStations(oldData.stations, newData.stations)
  const lineDiffs = compareLines(oldData.lines, newData.lines)

  let mapNameDiff: PropertyDiff<string> | undefined
  if (oldData.mapName !== newData.mapName) {
    mapNameDiff = {
      property: 'mapName',
      oldValue: oldData.mapName,
      newValue: newData.mapName,
      changeType: 'modified'
    }
  }

  const summary = {
    addedStations: stationDiffs.filter(s => s.changeType === 'added').length,
    removedStations: stationDiffs.filter(s => s.changeType === 'removed').length,
    modifiedStations: stationDiffs.filter(s => s.changeType === 'modified').length,
    addedLines: lineDiffs.filter(l => l.changeType === 'added').length,
    removedLines: lineDiffs.filter(l => l.changeType === 'removed').length,
    modifiedLines: lineDiffs.filter(l => l.changeType === 'modified').length
  }

  return {
    mapName: mapNameDiff,
    stationDiffs,
    lineDiffs,
    summary
  }
}

function compareStations(oldStations: Station[], newStations: Station[]): StationDiff[] {
  const diffs: StationDiff[] = []
  const oldMap = new Map(oldStations.map(s => [s.id, s]))
  const newMap = new Map(newStations.map(s => [s.id, s]))
  const allIds = new Set([...oldMap.keys(), ...newMap.keys()])

  for (const id of allIds) {
    const oldStation = oldMap.get(id)
    const newStation = newMap.get(id)
    const stationName = newStation?.name || oldStation?.name || id

    if (!oldStation && newStation) {
      diffs.push({
        stationId: id,
        stationName,
        changeType: 'added',
        newStation,
        propertyDiffs: generateAllPropertyDiffs(null, newStation)
      })
    } else if (oldStation && !newStation) {
      diffs.push({
        stationId: id,
        stationName,
        changeType: 'removed',
        oldStation,
        propertyDiffs: generateAllPropertyDiffs(oldStation, null)
      })
    } else if (oldStation && newStation) {
      const propertyDiffs = compareStationProperties(oldStation, newStation)
      if (propertyDiffs.length > 0) {
        diffs.push({
          stationId: id,
          stationName,
          changeType: 'modified',
          oldStation,
          newStation,
          propertyDiffs
        })
      }
    }
  }

  return diffs.sort((a, b) => {
    const order: Record<ChangeType, number> = { added: 0, modified: 1, removed: 2, unchanged: 3 }
    return order[a.changeType] - order[b.changeType]
  })
}

function compareLines(oldLines: MetroLine[], newLines: MetroLine[]): LineDiff[] {
  const diffs: LineDiff[] = []
  const oldMap = new Map(oldLines.map(l => [l.id, l]))
  const newMap = new Map(newLines.map(l => [l.id, l]))
  const allIds = new Set([...oldMap.keys(), ...newMap.keys()])

  for (const id of allIds) {
    const oldLine = oldMap.get(id)
    const newLine = newMap.get(id)
    const lineName = newLine?.name || oldLine?.name || id

    if (!oldLine && newLine) {
      diffs.push({
        lineId: id,
        lineName,
        changeType: 'added',
        newLine,
        propertyDiffs: generateAllLinePropertyDiffs(null, newLine),
        stationOrderChanges: compareStationOrder([], newLine.stationIds)
      })
    } else if (oldLine && !newLine) {
      diffs.push({
        lineId: id,
        lineName,
        changeType: 'removed',
        oldLine,
        propertyDiffs: generateAllLinePropertyDiffs(oldLine, null),
        stationOrderChanges: compareStationOrder(oldLine.stationIds, [])
      })
    } else if (oldLine && newLine) {
      const propertyDiffs = compareLineProperties(oldLine, newLine)
      const stationOrderChanges = compareStationOrder(oldLine.stationIds, newLine.stationIds)

      if (propertyDiffs.length > 0 || stationOrderChanges.length > 0) {
        diffs.push({
          lineId: id,
          lineName,
          changeType: 'modified',
          oldLine,
          newLine,
          propertyDiffs,
          stationOrderChanges
        })
      }
    }
  }

  return diffs.sort((a, b) => {
    const order: Record<ChangeType, number> = { added: 0, modified: 1, removed: 2, unchanged: 3 }
    return order[a.changeType] - order[b.changeType]
  })
}

function compareStationProperties(oldStation: Station, newStation: Station): PropertyDiff[] {
  const diffs: PropertyDiff[] = []

  for (const prop of STATION_COMPARE_PROPS) {
    const oldVal = oldStation[prop]
    const newVal = newStation[prop]
    if (!isEqual(oldVal, newVal)) {
      diffs.push({
        property: prop as string,
        oldValue: oldVal as unknown,
        newValue: newVal as unknown,
        changeType: 'modified'
      })
    }
  }

  return diffs
}

function compareLineProperties(oldLine: MetroLine, newLine: MetroLine): PropertyDiff[] {
  const diffs: PropertyDiff[] = []

  for (const prop of LINE_COMPARE_PROPS) {
    const oldVal = oldLine[prop]
    const newVal = newLine[prop]
    if (!isEqual(oldVal, newVal)) {
      diffs.push({
        property: prop as string,
        oldValue: oldVal as unknown,
        newValue: newVal as unknown,
        changeType: 'modified'
      })
    }
  }

  return diffs
}

function generateAllPropertyDiffs(
  oldStation: Station | null,
  newStation: Station | null
): PropertyDiff[] {
  const diffs: PropertyDiff[] = []
  const station = newStation || oldStation
  if (!station) return diffs

  for (const prop of STATION_COMPARE_PROPS) {
    const oldVal = oldStation?.[prop]
    const newVal = newStation?.[prop]
    diffs.push({
      property: prop as string,
      oldValue: oldVal as unknown,
      newValue: newVal as unknown,
      changeType: oldStation ? 'removed' : 'added'
    })
  }

  return diffs
}

function generateAllLinePropertyDiffs(
  oldLine: MetroLine | null,
  newLine: MetroLine | null
): PropertyDiff[] {
  const diffs: PropertyDiff[] = []
  const line = newLine || oldLine
  if (!line) return diffs

  for (const prop of LINE_COMPARE_PROPS) {
    const oldVal = oldLine?.[prop]
    const newVal = newLine?.[prop]
    diffs.push({
      property: prop as string,
      oldValue: oldVal as unknown,
      newValue: newVal as unknown,
      changeType: oldLine ? 'removed' : 'added'
    })
  }

  return diffs
}

function compareStationOrder(
  oldStationIds: string[],
  newStationIds: string[]
): LineStationOrderChange[] {
  const changes: LineStationOrderChange[] = []
  const oldPositions = new Map(oldStationIds.map((id, idx) => [id, idx]))
  const newPositions = new Map(newStationIds.map((id, idx) => [id, idx]))
  const allIds = new Set([...oldStationIds, ...newStationIds])

  for (const id of allIds) {
    const oldIndex = oldPositions.get(id)
    const newIndex = newPositions.get(id)

    if (oldIndex === undefined && newIndex !== undefined) {
      changes.push({
        stationId: id,
        oldIndex: -1,
        newIndex,
        action: 'added'
      })
    } else if (oldIndex !== undefined && newIndex === undefined) {
      changes.push({
        stationId: id,
        oldIndex,
        newIndex: -1,
        action: 'removed'
      })
    } else if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
      changes.push({
        stationId: id,
        oldIndex,
        newIndex,
        action: 'moved'
      })
    }
  }

  return changes.sort((a, b) => {
    if (a.action !== b.action) {
      const order: Record<string, number> = { removed: 0, moved: 1, added: 2 }
      return order[a.action] - order[b.action]
    }
    return (a.newIndex !== -1 ? a.newIndex : a.oldIndex) - (b.newIndex !== -1 ? b.newIndex : b.oldIndex)
  })
}

export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (typeof a !== 'object') return false
  return JSON.stringify(a) === JSON.stringify(b)
}

export function formatPropertyValue(value: unknown, prop: string): string {
  if (value === undefined || value === null) return '—'

  if (prop === 'transferLines' && Array.isArray(value)) {
    return value.length > 0 ? `[${value.join(', ')}]` : '无'
  }

  if (prop === 'exits' && Array.isArray(value)) {
    return value.length > 0 ? `${value.length} 个出口` : '无出口'
  }

  if (prop === 'x' || prop === 'y' || prop === 'z') {
    return typeof value === 'number' ? value.toFixed(0) : String(value)
  }

  if (prop === 'isTransfer') {
    return value ? '是' : '否'
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

export function getPropertyDisplayName(prop: string): string {
  const names: Record<string, string> = {
    name: '名称',
    x: 'X 坐标',
    y: 'Y 坐标',
    z: 'Z 坐标',
    isTransfer: '换乘站',
    transferLines: '换乘线路',
    exits: '出口信息',
    description: '描述',
    depth: '深度',
    stationFloors: '站层数',
    color: '颜色',
    tunnelRadius: '隧道半径',
    tunnelDepth: '隧道深度',
    mapName: '地图名称'
  }
  return names[prop] || prop
}

export function getDiffTotalCount(diff: MapDiff): number {
  return (
    diff.summary.addedStations +
    diff.summary.removedStations +
    diff.summary.modifiedStations +
    diff.summary.addedLines +
    diff.summary.removedLines +
    diff.summary.modifiedLines +
    (diff.mapName ? 1 : 0)
  )
}

export function getStationIdFromDiff(diff: MapDiff, targetId: string): StationDiff | undefined {
  return diff.stationDiffs.find(s => s.stationId === targetId)
}

export function getLineDiff(diff: MapDiff, targetId: string): LineDiff | undefined {
  return diff.lineDiffs.find(l => l.lineId === targetId)
}
