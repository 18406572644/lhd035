export interface Station {
  id: string
  name: string
  x: number
  y: number
  z?: number
  isTransfer: boolean
  transferLines?: string[]
  exits?: ExitInfo[]
  description?: string
  depth?: number
  stationFloors?: number
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
  tunnelRadius?: number
  tunnelDepth?: number
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

export type ViewMode3D = 'topdown' | 'side' | 'panorama' | 'firstperson'

export interface CameraPreset {
  name: string
  mode: ViewMode3D
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov?: number
}

export interface Scene3DConfig {
  showGround: boolean
  showBuildings: boolean
  showTunnels: boolean
  showTrains: boolean
  trainSpeed: number
  tunnelOpacity: number
  ambientLightIntensity: number
  directionalLightIntensity: number
  firstPersonLineId: string | null
  firstPersonFollowTrain: boolean
}

export const DEFAULT_SCENE_3D_CONFIG: Scene3DConfig = {
  showGround: true,
  showBuildings: true,
  showTunnels: true,
  showTrains: true,
  trainSpeed: 1,
  tunnelOpacity: 0.7,
  ambientLightIntensity: 0.6,
  directionalLightIntensity: 0.8,
  firstPersonLineId: null,
  firstPersonFollowTrain: true
}

export interface EditorConfig {
  snapToGrid: boolean
  gridSize: number
  showAlignmentGuides: boolean
  alignmentThreshold: number
}

export const DEFAULT_EDITOR_CONFIG: EditorConfig = {
  snapToGrid: true,
  gridSize: 40,
  showAlignmentGuides: true,
  alignmentThreshold: 8
}

export interface DraggingState {
  isDragging: boolean
  stationId: string | null
  startX: number
  startY: number
  startStationX: number
  startStationY: number
  currentX: number
  currentY: number
  shiftPressed: boolean
}

export interface AlignmentGuides {
  vertical: number[]
  horizontal: number[]
  snapVertical: number | null
  snapHorizontal: number | null
}

export type TrainDirection = 'up' | 'down'

export type DispatchMode = 'fixed_interval' | 'peak_offpeak' | 'express_local' | 'custom_timetable'

export interface TrainConfig {
  id: string
  trainNumber: string
  lineId: string
  direction: TrainDirection
  startTime: number
  totalDuration: number
  averageSpeed: number
  isExpress: boolean
  skipStationIds: string[]
  capacity: number
  loadFactor: number
}

export interface PeakConfig {
  peakStart: number
  peakEnd: number
  peakInterval: number
  offpeakInterval: number
}

export interface TimetableEntry {
  trainNumber: string
  lineId: string
  direction: TrainDirection
  startTime: number
  stationTimes: { stationId: string; arrivalTime: number; departureTime: number }[]
}

export interface SimulationConfig {
  dispatchMode: DispatchMode
  fixedInterval: number
  peakConfig: PeakConfig
  defaultStopDuration: number
  transferStopDuration: number
  safetyDistance: number
  startTime: number
  endTime: number
  timetables: TimetableEntry[]
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  dispatchMode: 'fixed_interval',
  fixedInterval: 300,
  peakConfig: {
    peakStart: 7 * 3600,
    peakEnd: 9 * 3600,
    peakInterval: 180,
    offpeakInterval: 420
  },
  defaultStopDuration: 30,
  transferStopDuration: 45,
  safetyDistance: 0.02,
  startTime: 6 * 3600,
  endTime: 23 * 3600,
  timetables: []
}

export type TrainStatus = 'waiting' | 'running' | 'stopped' | 'finished' | 'delayed' | 'broken'

export interface LiveTrain {
  id: string
  config: TrainConfig
  status: TrainStatus
  progress: number
  currentStationIndex: number
  speed: number
  delaySeconds: number
  stopTimeRemaining: number
  passengers: number
  doorAnimPhase: number
  previousStationId: string | null
  nextStationId: string | null
}

export interface LiveStation {
  id: string
  waitingPassengers: number
  totalPassengersServed: number
  avgWaitTime: number
  doorOpen: boolean
  doorAnimPhase: number
}

export interface SimulationStats {
  onlineTrainCount: number
  onTimeRate: number
  totalPassengers: number
  lineIntervals: Record<string, number>
  stationWaitTimes: Record<string, number[]>
  lineCongestion: Record<string, number[]>
  totalDelays: number
  trainsPerHour: number
}

export interface SimulationState {
  isRunning: boolean
  currentTime: number
  speed: number
  trains: LiveTrain[]
  stations: Record<string, LiveStation>
  config: SimulationConfig
  stats: SimulationStats
  selectedTrainId: string | null
  brokenTrainIds: string[]
}
