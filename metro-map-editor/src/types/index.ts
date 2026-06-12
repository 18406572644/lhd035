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

export type FareRuleType = 'distance' | 'station_count' | 'by_line'

export interface DistanceFareConfig {
  basePrice: number
  baseDistance: number
  unitPrice: number
  unitDistance: number
}

export interface StationCountFareConfig {
  tiers: { maxStations: number; price: number }[]
  defaultPrice: number
}

export interface LineFareConfig {
  linePrices: Record<string, number>
  defaultLinePrice: number
  basePrice: number
}

export interface TransferFareConfig {
  enabled: boolean
  feePerTransfer: number
  maxTransferFee?: number
  freeTransferCount?: number
}

export interface DiscountPeriod {
  id: string
  name: string
  startTime: number
  endTime: number
  discountRate: number
}

export interface FareConfig {
  ruleType: FareRuleType
  distanceConfig: DistanceFareConfig
  stationCountConfig: StationCountFareConfig
  lineConfig: LineFareConfig
  transferConfig: TransferFareConfig
  discountPeriods: DiscountPeriod[]
}

export const DEFAULT_FARE_CONFIG: FareConfig = {
  ruleType: 'station_count',
  distanceConfig: {
    basePrice: 3,
    baseDistance: 6000,
    unitPrice: 1,
    unitDistance: 2000
  },
  stationCountConfig: {
    tiers: [
      { maxStations: 3, price: 2 },
      { maxStations: 6, price: 3 },
      { maxStations: 10, price: 4 },
      { maxStations: 15, price: 5 }
    ],
    defaultPrice: 6
  },
  lineConfig: {
    linePrices: {},
    defaultLinePrice: 3,
    basePrice: 2
  },
  transferConfig: {
    enabled: false,
    feePerTransfer: 1,
    freeTransferCount: 0
  },
  discountPeriods: []
}

export interface PathSegment {
  lineId: string
  lineName: string
  fromStationId: string
  toStationId: string
  stationCount: number
  distance: number
}

export interface RouteResult {
  totalDistance: number
  totalStations: number
  transferCount: number
  segments: PathSegment[]
  stationIds: string[]
  lineIds: string[]
}

export interface FareCalculationResult {
  basePrice: number
  transferFee: number
  discount: number
  finalPrice: number
  route: RouteResult
  discountApplied?: DiscountPeriod
  breakdown: {
    description: string
    amount: number
  }[]
}

export interface StationFareRange {
  stationId: string
  stationName: string
  minPrice: number
  maxPrice: number
  avgPrice: number
}

export interface FareTableEntry {
  fromStationId: string
  fromStationName: string
  toStationId: string
  toStationName: string
  price: number
  distance: number
  stationCount: number
  transferCount: number
}

export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged'

export interface PropertyDiff<T = unknown> {
  property: string
  oldValue: T
  newValue: T
  changeType: ChangeType
}

export interface StationDiff {
  stationId: string
  stationName: string
  changeType: ChangeType
  oldStation?: Station
  newStation?: Station
  propertyDiffs: PropertyDiff[]
}

export interface LineStationOrderChange {
  stationId: string
  oldIndex: number
  newIndex: number
  action: 'added' | 'removed' | 'moved'
}

export interface LineDiff {
  lineId: string
  lineName: string
  changeType: ChangeType
  oldLine?: MetroLine
  newLine?: MetroLine
  propertyDiffs: PropertyDiff[]
  stationOrderChanges: LineStationOrderChange[]
}

export interface MapDiff {
  mapName?: PropertyDiff<string>
  stationDiffs: StationDiff[]
  lineDiffs: LineDiff[]
  summary: {
    addedStations: number
    removedStations: number
    modifiedStations: number
    addedLines: number
    removedLines: number
    modifiedLines: number
  }
}

export interface VersionTag {
  id: string
  name: string
  description?: string
  color?: string
  createdAt: number
}

export interface Version {
  id: string
  versionNumber: number
  branchId: string
  timestamp: number
  author: string
  summary: string
  userDescription?: string
  data: MetroMapData
  parentVersionId: string | null
  tags: VersionTag[]
  isMilestone: boolean
  snapshotType: 'auto' | 'manual'
}

export interface Branch {
  id: string
  name: string
  description?: string
  color: string
  createdAt: number
  updatedAt: number
  baseVersionId: string | null
  baseBranchId: string | null
  currentVersionId: string | null
  isActive: boolean
  isMain: boolean
}

export interface MergeConflict {
  id: string
  type: 'station' | 'line' | 'map-property'
  targetId: string
  targetName: string
  property?: string
  baseValue: unknown
  theirValue: unknown
  ourValue: unknown
  description: string
  resolution: 'base' | 'theirs' | 'ours' | null
}

export interface MergeResult {
  success: boolean
  conflicts: MergeConflict[]
  mergedData?: MetroMapData
  autoMergedCount: number
  conflictCount: number
}

export interface VersionControlState {
  branches: Branch[]
  versions: Version[]
  activeBranchId: string
  selectedVersionIds: string[]
  isDiffMode: boolean
  diffFromVersionId: string | null
  diffToVersionId: string | null
  mergeSourceBranchId: string | null
  mergeTargetBranchId: string | null
  pendingConflicts: MergeConflict[]
  showVersionPanel: boolean
  currentDiff: MapDiff | null
  lastAutoSnapshotTime: number
}

export const VERSION_STORAGE_KEYS = {
  BRANCHES: 'metro_vc_branches',
  VERSIONS: 'metro_vc_versions',
  STATE: 'metro_vc_state'
} as const

export const MAX_LOCAL_VERSIONS = 20
export const AUTO_SNAPSHOT_DEBOUNCE_MS = 3000
export const BRANCH_COLORS = [
  '#0065B3', '#E4002B', '#009944', '#F5A623', '#9013FE',
  '#50E3C2', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'
]
