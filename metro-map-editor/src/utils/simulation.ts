import type {
  MetroMapData,
  Station,
  MetroLine,
  TrainConfig,
  LiveTrain,
  LiveStation,
  SimulationConfig,
  SimulationStats,
  TrainStatus,
  TrainDirection,
  TimetableEntry
} from '../types'
import { DEFAULT_SIMULATION_CONFIG } from '../types'
import { generateId, distance } from './path'

export function createTrainScheduler(
  mapData: MetroMapData,
  config: SimulationConfig
): TrainConfig[] {
  const trains: TrainConfig[] = []

  for (const line of mapData.lines) {
    const stationCount = line.stationIds.length
    if (stationCount < 2) continue

    const lineTrainsUp = generateLineTrains(line, 'up', mapData, config)
    const lineTrainsDown = generateLineTrains(line, 'down', mapData, config)
    trains.push(...lineTrainsUp, ...lineTrainsDown)
  }

  return trains
}

function generateLineTrains(
  line: MetroLine,
  direction: TrainDirection,
  mapData: MetroMapData,
  config: SimulationConfig
): TrainConfig[] {
  const trains: TrainConfig[] = []
  const stationCount = line.stationIds.length
  const stations = line.stationIds
    .map(id => mapData.stations.find(s => s.id === id))
    .filter(Boolean) as Station[]

  if (stations.length < 2) return trains

  const totalDistance = calculateLineDistance(stations)
  const avgSpeed = 30
  const totalDuration = (totalDistance / avgSpeed) * 60 + stationCount * config.defaultStopDuration

  let currentTime = config.startTime
  let trainIndex = 1

  const dirPrefix = direction === 'up' ? 'U' : 'D'
  const lineNum = line.name.replace(/\D/g, '') || line.id.slice(-2)

  while (currentTime < config.endTime) {
    const interval = getDispatchInterval(currentTime, config)
    const isExpress = config.dispatchMode === 'express_local' && trainIndex % 3 === 0

    const skipStationIds = isExpress ? getExpressSkipStations(line, mapData) : []

    const train: TrainConfig = {
      id: generateId(),
      trainNumber: `${lineNum}${dirPrefix}${String(trainIndex).padStart(3, '0')}`,
      lineId: line.id,
      direction,
      startTime: currentTime,
      totalDuration: isExpress ? totalDuration * 0.7 : totalDuration,
      averageSpeed: isExpress ? avgSpeed * 1.3 : avgSpeed,
      isExpress,
      skipStationIds,
      capacity: 1500,
      loadFactor: 0.6 + Math.random() * 0.3
    }

    trains.push(train)
    currentTime += interval
    trainIndex++
  }

  return trains
}

function calculateLineDistance(stations: Station[]): number {
  let total = 0
  for (let i = 0; i < stations.length - 1; i++) {
    total += distance(stations[i].x, stations[i].y, stations[i + 1].x, stations[i + 1].y)
  }
  return total / 100
}

function getDispatchInterval(currentTime: number, config: SimulationConfig): number {
  switch (config.dispatchMode) {
    case 'fixed_interval':
      return config.fixedInterval
    case 'peak_offpeak': {
      const { peakStart, peakEnd, peakInterval, offpeakInterval } = config.peakConfig
      return currentTime >= peakStart && currentTime <= peakEnd ? peakInterval : offpeakInterval
    }
    case 'express_local':
      return config.fixedInterval
    case 'custom_timetable':
      return config.fixedInterval
    default:
      return config.fixedInterval
  }
}

function getExpressSkipStations(line: MetroLine, mapData: MetroMapData): string[] {
  const skip: string[] = []
  for (let i = 1; i < line.stationIds.length - 1; i++) {
    if (i % 2 === 0) {
      const station = mapData.stations.find(s => s.id === line.stationIds[i])
      if (station && !station.isTransfer) {
        skip.push(station.id)
      }
    }
  }
  return skip
}

export function initializeLiveStations(mapData: MetroMapData): Record<string, LiveStation> {
  const stations: Record<string, LiveStation> = {}
  for (const station of mapData.stations) {
    stations[station.id] = {
      id: station.id,
      waitingPassengers: Math.floor(Math.random() * 50 + 10),
      totalPassengersServed: 0,
      avgWaitTime: 120 + Math.random() * 180,
      doorOpen: false,
      doorAnimPhase: 0
    }
  }
  return stations
}

export function initializeLiveTrains(trainConfigs: TrainConfig[]): LiveTrain[] {
  return trainConfigs.map(config => ({
    id: config.id,
    config,
    status: 'waiting' as TrainStatus,
    progress: 0,
    currentStationIndex: 0,
    speed: 0,
    delaySeconds: 0,
    stopTimeRemaining: 0,
    passengers: 0,
    doorAnimPhase: 0,
    previousStationId: null,
    nextStationId: null
  }))
}

export interface SimulationStepResult {
  trains: LiveTrain[]
  stations: Record<string, LiveStation>
  stats: SimulationStats
}

export function simulationStep(
  currentTime: number,
  deltaSeconds: number,
  trains: LiveTrain[],
  stations: Record<string, LiveStation>,
  config: SimulationConfig,
  mapData: MetroMapData,
  brokenTrainIds: string[] = []
): SimulationStepResult {
  const updatedTrains = trains.map(t => ({ ...t }))
  const updatedStations = { ...stations }

  for (const train of updatedTrains) {
    if (brokenTrainIds.includes(train.id)) {
      train.status = 'broken'
      train.speed = 0
      continue
    }

    const line = mapData.lines.find(l => l.id === train.config.lineId)
    if (!line) continue

    const stationIds = train.config.direction === 'up'
      ? line.stationIds
      : [...line.stationIds].reverse()

    if (currentTime < train.config.startTime + train.delaySeconds) {
      train.status = 'waiting'
      train.speed = 0
      continue
    }

    if (train.status === 'waiting' && currentTime >= train.config.startTime + train.delaySeconds) {
      train.status = 'running'
      train.currentStationIndex = 0
      train.nextStationId = stationIds.length > 1 ? stationIds[1] : stationIds[0]
      train.previousStationId = stationIds[0]
      train.speed = train.config.averageSpeed
      train.progress = 0
    }

    if (train.status === 'running' || train.status === 'delayed') {
      updateRunningTrain(train, stationIds, mapData, config, deltaSeconds, updatedStations, updatedTrains)
    }

    if (train.status === 'stopped') {
      updateStoppedTrain(train, stationIds, mapData, config, deltaSeconds, updatedStations)
    }
  }

  updateStationPassengers(updatedStations, deltaSeconds, mapData)

  const stats = computeStats(updatedTrains, updatedStations, config, mapData, currentTime)

  return {
    trains: updatedTrains,
    stations: updatedStations,
    stats
  }
}

function updateRunningTrain(
  train: LiveTrain,
  stationIds: string[],
  mapData: MetroMapData,
  config: SimulationConfig,
  deltaSeconds: number,
  stations: Record<string, LiveStation>,
  allTrains: LiveTrain[]
): void {
  const line = mapData.lines.find(l => l.id === train.config.lineId)
  if (!line) return

  const effectiveSpeed = calculateEffectiveSpeed(train, allTrains, stationIds, config)
  train.speed = effectiveSpeed

  const progressIncrement = calculateProgressIncrement(train, stationIds, mapData, deltaSeconds)
  train.progress += progressIncrement

  const nextIdx = train.currentStationIndex
  if (nextIdx < stationIds.length) {
    const nextStationProgress = getStationProgress(nextIdx, stationIds, mapData, train.config.direction)
    if (train.progress >= nextStationProgress) {
      const stationId = stationIds[nextIdx]
      const station = mapData.stations.find(s => s.id === stationId)

      const shouldStop = !train.config.skipStationIds.includes(stationId)
      if (shouldStop) {
        train.status = 'stopped'
        train.stopTimeRemaining = station?.isTransfer
          ? config.transferStopDuration
          : config.defaultStopDuration
        train.previousStationId = stationId
        train.currentStationIndex++
        train.doorAnimPhase = 0

        if (stations[stationId]) {
          stations[stationId].doorOpen = true
          stations[stationId].doorAnimPhase = 0
        }

        handlePassengerExchange(train, stations, stationId)
      } else {
        train.previousStationId = stationId
        train.currentStationIndex++
      }
    }
  }

  if (train.currentStationIndex >= stationIds.length) {
    train.status = 'finished'
    train.speed = 0
  }
}

function calculateEffectiveSpeed(
  train: LiveTrain,
  allTrains: LiveTrain[],
  stationIds: string[],
  config: SimulationConfig
): number {
  const sameLineTrains = allTrains.filter(
    t => t.id !== train.id &&
      t.config.lineId === train.config.lineId &&
      t.config.direction === train.config.direction &&
      (t.status === 'running' || t.status === 'stopped' || t.status === 'delayed')
  )

  let minDistance = Infinity
  for (const other of sameLineTrains) {
    const dist = other.progress - train.progress
    if (dist > 0 && dist < minDistance) {
      minDistance = dist
    }
  }

  const baseSpeed = train.config.averageSpeed
  if (minDistance < config.safetyDistance) {
    return 0
  } else if (minDistance < config.safetyDistance * 3) {
    return baseSpeed * 0.5
  }

  return baseSpeed
}

function calculateProgressIncrement(
  train: LiveTrain,
  stationIds: string[],
  mapData: MetroMapData,
  deltaSeconds: number
): number {
  const totalProgress = 1
  const totalDuration = train.config.totalDuration
  const deltaProgress = (deltaSeconds / totalDuration) * totalProgress
  return deltaProgress
}

function getStationProgress(
  stationIndex: number,
  stationIds: string[],
  mapData: MetroMapData,
  direction: TrainDirection
): number {
  if (stationIds.length <= 1) return 0
  if (stationIndex >= stationIds.length) return 1

  const stations = stationIds
    .map(id => mapData.stations.find(s => s.id === id))
    .filter(Boolean) as Station[]

  if (stations.length < 2) return 0

  let totalDist = 0
  for (let i = 0; i < stations.length - 1; i++) {
    totalDist += distance(stations[i].x, stations[i].y, stations[i + 1].x, stations[i + 1].y)
  }

  let distToStation = 0
  for (let i = 0; i < stationIndex && i < stations.length - 1; i++) {
    distToStation += distance(stations[i].x, stations[i].y, stations[i + 1].x, stations[i + 1].y)
  }

  return totalDist > 0 ? distToStation / totalDist : stationIndex / (stationIds.length - 1)
}

function updateStoppedTrain(
  train: LiveTrain,
  stationIds: string[],
  mapData: MetroMapData,
  config: SimulationConfig,
  deltaSeconds: number,
  stations: Record<string, LiveStation>
): void {
  train.stopTimeRemaining -= deltaSeconds

  const stopDuration = config.defaultStopDuration
  const doorPhase = 1 - Math.max(0, train.stopTimeRemaining) / stopDuration

  if (doorPhase < 0.2) {
    train.doorAnimPhase = doorPhase / 0.2
  } else if (doorPhase > 0.8) {
    train.doorAnimPhase = (1 - doorPhase) / 0.2
  } else {
    train.doorAnimPhase = 1
  }

  if (train.previousStationId && stations[train.previousStationId]) {
    stations[train.previousStationId].doorAnimPhase = train.doorAnimPhase
  }

  if (train.stopTimeRemaining <= 0) {
    train.status = 'running'
    train.stopTimeRemaining = 0
    train.doorAnimPhase = 0

    if (train.previousStationId && stations[train.previousStationId]) {
      stations[train.previousStationId].doorOpen = false
      stations[train.previousStationId].doorAnimPhase = 0
    }

    if (train.currentStationIndex < stationIds.length) {
      train.nextStationId = stationIds[train.currentStationIndex]
    }
  }
}

function handlePassengerExchange(
  train: LiveTrain,
  stations: Record<string, LiveStation>,
  stationId: string
): void {
  const station = stations[stationId]
  if (!station) return

  const alightingPassengers = Math.floor(train.passengers * (0.1 + Math.random() * 0.3))
  train.passengers = Math.max(0, train.passengers - alightingPassengers)

  const availableSpace = train.config.capacity - train.passengers
  const boardingPassengers = Math.min(station.waitingPassengers, availableSpace)
  train.passengers += boardingPassengers
  station.waitingPassengers -= boardingPassengers
  station.totalPassengersServed += boardingPassengers
}

function updateStationPassengers(
  stations: Record<string, LiveStation>,
  deltaSeconds: number,
  mapData: MetroMapData
): void {
  const arrivalRate = 0.05

  for (const station of mapData.stations) {
    const liveStation = stations[station.id]
    if (!liveStation) continue

    const baseArrival = station.isTransfer ? arrivalRate * 2 : arrivalRate
    const newPassengers = baseArrival * deltaSeconds * (0.5 + Math.random())
    liveStation.waitingPassengers += Math.floor(newPassengers)

    if (liveStation.waitingPassengers > 200) {
      liveStation.waitingPassengers = 200
    }
  }
}

function computeStats(
  trains: LiveTrain[],
  stations: Record<string, LiveStation>,
  config: SimulationConfig,
  mapData: MetroMapData,
  currentTime: number
): SimulationStats {
  const onlineTrains = trains.filter(t => t.status === 'running' || t.status === 'stopped' || t.status === 'delayed')
  const finishedTrains = trains.filter(t => t.status === 'finished')
  const allActiveTrains = [...onlineTrains, ...finishedTrains]

  const onTimeCount = allActiveTrains.filter(t => t.delaySeconds < 60).length
  const onTimeRate = allActiveTrains.length > 0 ? onTimeCount / allActiveTrains.length : 1

  const totalPassengers = Object.values(stations).reduce((sum, s) => sum + s.totalPassengersServed, 0)

  const lineIntervals: Record<string, number> = {}
  const lineCongestion: Record<string, number[]> = {}

  for (const line of mapData.lines) {
    const lineTrains = onlineTrains.filter(t => t.config.lineId === line.id && t.status === 'running')
    if (lineTrains.length >= 2) {
      const sortedTrains = [...lineTrains].sort((a, b) => a.progress - b.progress)
      let minInterval = Infinity
      for (let i = 1; i < sortedTrains.length; i++) {
        const interval = (sortedTrains[i].progress - sortedTrains[i - 1].progress) * config.fixedInterval
        if (interval < minInterval) minInterval = interval
      }
      lineIntervals[line.id] = minInterval
    } else {
      lineIntervals[line.id] = config.fixedInterval
    }

    const congestion: number[] = []
    const segmentCount = line.stationIds.length - 1
    for (let i = 0; i < segmentCount; i++) {
      const segStart = i / segmentCount
      const segEnd = (i + 1) / segmentCount
      const trainsInSegment = lineTrains.filter(t => t.progress >= segStart && t.progress < segEnd)
      congestion.push(trainsInSegment.length)
    }
    lineCongestion[line.id] = congestion
  }

  const stationWaitTimes: Record<string, number[]> = {}
  for (const station of mapData.stations) {
    stationWaitTimes[station.id] = [stations[station.id]?.avgWaitTime || 120]
  }

  const totalDelays = trains.reduce((sum, t) => sum + Math.max(0, t.delaySeconds), 0)

  const elapsedHours = (currentTime - config.startTime) / 3600
  const trainsPerHour = elapsedHours > 0 ? finishedTrains.length / elapsedHours : 0

  return {
    onlineTrainCount: onlineTrains.length,
    onTimeRate,
    totalPassengers,
    lineIntervals,
    stationWaitTimes,
    lineCongestion,
    totalDelays,
    trainsPerHour
  }
}

export function getTrainPosition(
  train: LiveTrain,
  line: MetroLine,
  mapData: MetroMapData
): { x: number; y: number; angle: number } {
  const stationIds = train.config.direction === 'up'
    ? line.stationIds
    : [...line.stationIds].reverse()

  const stations = stationIds
    .map(id => mapData.stations.find(s => s.id === id))
    .filter(Boolean) as Station[]

  if (stations.length < 2) {
    return { x: stations[0]?.x || 0, y: stations[0]?.y || 0, angle: 0 }
  }

  const totalSegments = stations.length - 1
  const progress = Math.min(Math.max(train.progress, 0), 1)
  const segmentProgress = progress * totalSegments
  const segmentIndex = Math.floor(Math.min(segmentProgress, totalSegments - 1))
  const t = segmentProgress - segmentIndex

  const p0 = stations[segmentIndex - 1] || stations[segmentIndex]
  const p1 = stations[segmentIndex]
  const p2 = stations[segmentIndex + 1]
  const p3 = stations[segmentIndex + 2] || p2

  const cp1x = p1.x + (p2.x - p0.x) / 6
  const cp1y = p1.y + (p2.y - p0.y) / 6
  const cp2x = p2.x - (p3.x - p1.x) / 6
  const cp2y = p2.y - (p3.y - p1.y) / 6

  const mt = 1 - t
  const x = mt * mt * mt * p1.x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * p2.x
  const y = mt * mt * mt * p1.y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * p2.y

  const dx = 3 * mt * mt * (cp1x - p1.x) + 6 * mt * t * (cp2x - cp1x) + 3 * t * t * (p2.x - cp2x)
  const dy = 3 * mt * mt * (cp1y - p1.y) + 6 * mt * t * (cp2y - cp1y) + 3 * t * t * (p2.y - cp2y)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)

  return { x, y, angle }
}

export function simulateBreakdown(
  trainId: string,
  trains: LiveTrain[],
  delaySeconds: number
): LiveTrain[] {
  return trains.map(t => {
    if (t.id === trainId) {
      return { ...t, delaySeconds: t.delaySeconds + delaySeconds, status: 'delayed' }
    }
    return t
  })
}

export function parseTimetableCSV(csvContent: string): TimetableEntry[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const entries: TimetableEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length < 5) continue

    const entry: TimetableEntry = {
      trainNumber: values[0],
      lineId: values[1],
      direction: values[2] as TrainDirection,
      startTime: parseTimeString(values[3]),
      stationTimes: []
    }

    for (let j = 4; j < values.length; j += 3) {
      if (j + 2 < values.length) {
        entry.stationTimes.push({
          stationId: values[j],
          arrivalTime: parseTimeString(values[j + 1]),
          departureTime: parseTimeString(values[j + 2])
        })
      }
    }

    entries.push(entry)
  }

  return entries
}

function parseTimeString(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length === 2) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60
  } else if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
  }
  return 0
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export { DEFAULT_SIMULATION_CONFIG }
