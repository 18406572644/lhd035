export interface Station {
  id: string
  name: string
  x: number
  y: number
  isTransfer: boolean
  transferLines?: string[]
  exits?: ExitInfo[]
  description?: string
}

export interface ExitInfo {
  name: string
  description?: string
}

export interface MetroLine {
  id: string
  name: string
  color: string
  stationIds: string[]
}

export interface MetroMapData {
  lines: MetroLine[]
  stations: Station[]
  mapName: string
  createdAt?: number
  updatedAt?: number
}

export interface ViewState {
  scale: number
  offsetX: number
  offsetY: number
}

export type ToolMode = 'select' | 'addStation' | 'edit' | 'delete'

export interface StationDetail {
  station: Station
  lines: MetroLine[]
}

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  ruleId: string
  message: string
  targetType: 'station' | 'line' | 'map'
  targetId?: string
  fixable?: boolean
}

export interface ValidationResult {
  issues: ValidationIssue[]
  errorCount: number
  warningCount: number
  infoCount: number
}

export interface ValidationRuleConfig {
  id: string
  name: string
  description: string
  severity: ValidationSeverity
  enabled: boolean
}

export const DEFAULT_VALIDATION_RULES: ValidationRuleConfig[] = [
  { id: 'unique-station-id', name: '站点ID唯一性', description: '检测全局范围内重复的站点ID', severity: 'error', enabled: true },
  { id: 'orphan-station-ref', name: '孤儿站点引用', description: '检测线路中引用了不存在的站点ID', severity: 'error', enabled: true },
  { id: 'duplicate-station-in-line', name: '线路内重复站点', description: '检测同一线路内重复的站点ID', severity: 'error', enabled: true },
  { id: 'transfer-line-consistency', name: '换乘站数据一致性', description: '检测换乘站的 transferLines 与实际归属线路是否一致', severity: 'warning', enabled: true },
  { id: 'station-coordinate-range', name: '站点坐标范围', description: '检测站点坐标是否超出画布边界', severity: 'warning', enabled: true },
  { id: 'line-color-format', name: '线路颜色格式', description: '检测线路颜色是否为合法的CSS颜色值', severity: 'error', enabled: true },
  { id: 'station-name-empty', name: '站点名称空值', description: '检测空的站点名称', severity: 'warning', enabled: true },
  { id: 'duplicate-station-name-in-line', name: '线路内站名重复', description: '检测同一线路内重复的站点名称', severity: 'warning', enabled: true },
  { id: 'circular-line', name: '环形线路检测', description: '检测起点站与终点站相同的环形线路', severity: 'info', enabled: true }
]
