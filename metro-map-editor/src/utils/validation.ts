import type { MetroMapData, Station, MetroLine, ValidationIssue, ValidationResult, ValidationRuleConfig } from '../types'
import { DEFAULT_VALIDATION_RULES } from '../types'

const CANVAS_WIDTH = 2000
const CANVAS_HEIGHT = 2000
const COORDINATE_TOLERANCE = 50

function generateIssueId(ruleId: string, targetType: string, targetId?: string): string {
  return ruleId + '-' + targetType + '-' + (targetId || 'map')
}

function isValidCssColor(color: string): boolean {
  if (!color || typeof color !== 'string') return false
  const s = new Option().style
  s.color = color
  return s.color !== ''
}

function checkUniqueStationId(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const idMap = new Map<string, Station[]>()

  for (const station of data.stations) {
    if (!idMap.has(station.id)) {
      idMap.set(station.id, [station])
    } else {
      idMap.get(station.id)!.push(station)
    }
  }

  for (const [id, stations] of idMap) {
    if (stations.length > 1) {
      issues.push({
        id: generateIssueId('unique-station-id', 'station', id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'unique-station-id',
        message: '站点ID "' + id + '" 存在 ' + stations.length + ' 次重复',
        targetType: 'station',
        targetId: id,
        fixable: false
      })
    }
  }

  return issues
}

function checkOrphanStationRef(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const stationIdSet = new Set(data.stations.map(s => s.id))

  for (const line of data.lines) {
    const orphanIds = line.stationIds.filter(id => !stationIdSet.has(id))
    if (orphanIds.length > 0) {
      issues.push({
        id: generateIssueId('orphan-station-ref', 'line', line.id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'orphan-station-ref',
        message: '线路 "' + line.name + '" 包含 ' + orphanIds.length + ' 个不存在的站点引用: ' + orphanIds.join(', '),
        targetType: 'line',
        targetId: line.id,
        fixable: true
      })
    }
  }

  return issues
}

function checkDuplicateStationInLine(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const line of data.lines) {
    const seen = new Set<string>()
    const duplicates = new Set<string>()

    for (const stationId of line.stationIds) {
      if (seen.has(stationId)) {
        duplicates.add(stationId)
      } else {
        seen.add(stationId)
      }
    }

    if (duplicates.size > 0) {
      issues.push({
        id: generateIssueId('duplicate-station-in-line', 'line', line.id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'duplicate-station-in-line',
        message: '线路 "' + line.name + '" 内存在重复站点: ' + Array.from(duplicates).join(', '),
        targetType: 'line',
        targetId: line.id,
        fixable: true
      })
    }
  }

  return issues
}

function checkTransferLineConsistency(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const stationLinesMap = new Map<string, string[]>()

  for (const line of data.lines) {
    for (const stationId of line.stationIds) {
      if (!stationLinesMap.has(stationId)) {
        stationLinesMap.set(stationId, [])
      }
      stationLinesMap.get(stationId)!.push(line.id)
    }
  }

  for (const station of data.stations) {
    const actualLines = stationLinesMap.get(station.id) || []
    const transferLines = station.transferLines || []

    const actualSet = new Set(actualLines)
    const transferSet = new Set(transferLines)

    const hasMismatch =
      actualSet.size !== transferSet.size ||
      Array.from(actualSet).some(id => !transferSet.has(id))

    if (station.isTransfer && actualLines.length <= 1) {
      issues.push({
        id: generateIssueId('transfer-line-consistency', 'station', station.id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'transfer-line-consistency',
        message: '站点 "' + station.name + '" 标记为换乘站但实际只属于 ' + actualLines.length + ' 条线路',
        targetType: 'station',
        targetId: station.id,
        fixable: true
      })
    } else if (!station.isTransfer && actualLines.length > 1) {
      issues.push({
        id: generateIssueId('transfer-line-consistency', 'station', station.id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'transfer-line-consistency',
        message: '站点 "' + station.name + '" 属于 ' + actualLines.length + ' 条线路但未标记为换乘站',
        targetType: 'station',
        targetId: station.id,
        fixable: true
      })
    } else if (station.isTransfer && hasMismatch) {
      issues.push({
        id: generateIssueId('transfer-line-consistency', 'station', station.id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'transfer-line-consistency',
        message: '站点 "' + station.name + '" 的换乘线路数据与实际归属线路不一致',
        targetType: 'station',
        targetId: station.id,
        fixable: true
      })
    }
  }

  return issues
}

function checkStationCoordinateRange(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const station of data.stations) {
    const outOfBounds =
      station.x < -COORDINATE_TOLERANCE ||
      station.x > CANVAS_WIDTH + COORDINATE_TOLERANCE ||
      station.y < -COORDINATE_TOLERANCE ||
      station.y > CANVAS_HEIGHT + COORDINATE_TOLERANCE

    if (outOfBounds) {
      issues.push({
        id: generateIssueId('station-coordinate-range', 'station', station.id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'station-coordinate-range',
        message: '站点 "' + station.name + '" 坐标 (' + Math.round(station.x) + ', ' + Math.round(station.y) + ') 超出画布范围',
        targetType: 'station',
        targetId: station.id,
        fixable: false
      })
    }
  }

  return issues
}

function checkLineColorFormat(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const line of data.lines) {
    if (!isValidCssColor(line.color)) {
      issues.push({
        id: generateIssueId('line-color-format', 'line', line.id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'line-color-format',
        message: '线路 "' + line.name + '" 的颜色值 "' + line.color + '" 不是合法的CSS颜色',
        targetType: 'line',
        targetId: line.id,
        fixable: false
      })
    }
  }

  return issues
}

function checkStationNameEmpty(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const station of data.stations) {
    if (!station.name || !station.name.trim()) {
      issues.push({
        id: generateIssueId('station-name-empty', 'station', station.id),
        severity: severity as 'error' | 'warning' | 'info',
        ruleId: 'station-name-empty',
        message: '站点ID "' + station.id + '" 名称为空',
        targetType: 'station',
        targetId: station.id,
        fixable: false
      })
    }
  }

  return issues
}

function checkDuplicateStationNameInLine(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const stationMap = new Map(data.stations.map(s => [s.id, s]))

  for (const line of data.lines) {
    const nameMap = new Map<string, string[]>()

    for (const stationId of line.stationIds) {
      const station = stationMap.get(stationId)
      if (!station) continue

      const name = station.name
      if (!nameMap.has(name)) {
        nameMap.set(name, [])
      }
      nameMap.get(name)!.push(stationId)
    }

    for (const [name, ids] of nameMap) {
      if (ids.length > 1) {
        issues.push({
          id: generateIssueId('duplicate-station-name-in-line', 'line', line.id + '-' + name),
          severity: severity as 'error' | 'warning' | 'info',
          ruleId: 'duplicate-station-name-in-line',
          message: '线路 "' + line.name + '" 内有 ' + ids.length + ' 个站点名为 "' + name + '"',
          targetType: 'line',
          targetId: line.id,
          fixable: false
        })
      }
    }
  }

  return issues
}

function checkCircularLine(data: MetroMapData, severity: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const line of data.lines) {
    if (line.stationIds.length >= 2) {
      const firstId = line.stationIds[0]
      const lastId = line.stationIds[line.stationIds.length - 1]
      if (firstId === lastId) {
        issues.push({
          id: generateIssueId('circular-line', 'line', line.id),
          severity: severity as 'error' | 'warning' | 'info',
          ruleId: 'circular-line',
          message: '线路 "' + line.name + '" 起点站与终点站相同，为环形线路',
          targetType: 'line',
          targetId: line.id,
          fixable: false
        })
      }
    }
  }

  return issues
}

const RULE_CHECKERS: Record<string, (data: MetroMapData, severity: string) => ValidationIssue[]> = {
  'unique-station-id': checkUniqueStationId,
  'orphan-station-ref': checkOrphanStationRef,
  'duplicate-station-in-line': checkDuplicateStationInLine,
  'transfer-line-consistency': checkTransferLineConsistency,
  'station-coordinate-range': checkStationCoordinateRange,
  'line-color-format': checkLineColorFormat,
  'station-name-empty': checkStationNameEmpty,
  'duplicate-station-name-in-line': checkDuplicateStationNameInLine,
  'circular-line': checkCircularLine
}

export function validateMapData(
  data: MetroMapData,
  rules: ValidationRuleConfig[] = DEFAULT_VALIDATION_RULES
): ValidationResult {
  const issues: ValidationIssue[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    const checker = RULE_CHECKERS[rule.id]
    if (checker) {
      const ruleIssues = checker(data, rule.severity)
      issues.push(...ruleIssues)
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length
  const infoCount = issues.filter(i => i.severity === 'info').length

  return {
    issues,
    errorCount,
    warningCount,
    infoCount
  }
}

export function getValidationRules(): ValidationRuleConfig[] {
  return [...DEFAULT_VALIDATION_RULES]
}

export function fixOrphanStationRef(data: MetroMapData, lineId: string): MetroMapData {
  const stationIdSet = new Set(data.stations.map(s => s.id))
  return {
    ...data,
    lines: data.lines.map(line => {
      if (line.id !== lineId) return line
      return {
        ...line,
        stationIds: line.stationIds.filter(id => stationIdSet.has(id))
      }
    })
  }
}

export function fixDuplicateStationInLine(data: MetroMapData, lineId: string): MetroMapData {
  return {
    ...data,
    lines: data.lines.map(line => {
      if (line.id !== lineId) return line
      const seen = new Set<string>()
      const uniqueIds: string[] = []
      for (const id of line.stationIds) {
        if (!seen.has(id)) {
          seen.add(id)
          uniqueIds.push(id)
        }
      }
      return { ...line, stationIds: uniqueIds }
    })
  }
}

export function fixTransferLineConsistency(data: MetroMapData, stationId: string): MetroMapData {
  const stationLines: string[] = []
  for (const line of data.lines) {
    if (line.stationIds.includes(stationId)) {
      stationLines.push(line.id)
    }
  }

  return {
    ...data,
    stations: data.stations.map(station => {
      if (station.id !== stationId) return station
      const isTransfer = stationLines.length > 1
      return {
        ...station,
        isTransfer,
        transferLines: isTransfer ? stationLines : undefined
      }
    })
  }
}

export function fixIssue(data: MetroMapData, issue: ValidationIssue): MetroMapData | null {
  if (!issue.fixable) return null

  switch (issue.ruleId) {
    case 'orphan-station-ref':
      return issue.targetId ? fixOrphanStationRef(data, issue.targetId) : null
    case 'duplicate-station-in-line':
      return issue.targetId ? fixDuplicateStationInLine(data, issue.targetId) : null
    case 'transfer-line-consistency':
      return issue.targetId ? fixTransferLineConsistency(data, issue.targetId) : null
    default:
      return null
  }
}
