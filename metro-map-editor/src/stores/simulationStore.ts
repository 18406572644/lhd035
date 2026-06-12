import { writable, derived, get } from 'svelte/store'
import type {
  SimulationState,
  SimulationConfig,
  LiveTrain,
  LiveStation,
  SimulationStats
} from '../types'
import { DEFAULT_SIMULATION_CONFIG } from '../types'
import {
  createTrainScheduler,
  initializeLiveStations,
  initializeLiveTrains,
  simulationStep,
  simulateBreakdown
} from '../utils/simulation'
import { mapStore } from './mapStore'

function createSimulationStore() {
  const { subscribe, set, update } = writable<SimulationState>({
    isRunning: false,
    currentTime: DEFAULT_SIMULATION_CONFIG.startTime,
    speed: 1,
    trains: [],
    stations: {},
    config: { ...DEFAULT_SIMULATION_CONFIG },
    stats: {
      onlineTrainCount: 0,
      onTimeRate: 0,
      totalPassengers: 0,
      lineIntervals: {},
      stationWaitTimes: {},
      lineCongestion: {},
      totalDelays: 0,
      trainsPerHour: 0
    },
    selectedTrainId: null,
    brokenTrainIds: []
  })

  let animationId: number | null = null
  let lastTimestamp: number = 0

  function initSimulation() {
    const mapData = get(mapStore)

    update(state => {
      const config = state.config
      const trainConfigs = createTrainScheduler(mapData, config)
      const liveTrains = initializeLiveTrains(trainConfigs)
      const liveStations = initializeLiveStations(mapData)

      const initialStats: SimulationStats = {
        onlineTrainCount: 0,
        onTimeRate: 1,
        totalPassengers: 0,
        lineIntervals: {},
        stationWaitTimes: {},
        lineCongestion: {},
        totalDelays: 0,
        trainsPerHour: 0
      }

      return {
        ...state,
        trains: liveTrains,
        stations: liveStations,
        currentTime: config.startTime,
        stats: initialStats,
        brokenTrainIds: []
      }
    })
  }

  function step(timestamp: number) {
    if (!lastTimestamp) lastTimestamp = timestamp
    const deltaRealTime = (timestamp - lastTimestamp) / 1000
    lastTimestamp = timestamp

    update(state => {
      if (!state.isRunning) return state

      const mapData = get(mapStore)
      const deltaSimTime = deltaRealTime * state.speed

      const result = simulationStep(
        state.currentTime,
        deltaSimTime,
        state.trains,
        state.stations,
        state.config,
        mapData,
        state.brokenTrainIds
      )

      let newTime = state.currentTime + deltaSimTime
      if (newTime >= state.config.endTime) {
        newTime = state.config.endTime
      }

      return {
        ...state,
        currentTime: newTime,
        trains: result.trains,
        stations: result.stations,
        stats: result.stats
      }
    })

    animationId = requestAnimationFrame(step)
  }

  function start() {
    const state = get(simulationStore)
    if (state.trains.length === 0) {
      initSimulation()
    }

    update(s => ({ ...s, isRunning: true }))
    lastTimestamp = 0
    animationId = requestAnimationFrame(step)
  }

  function pause() {
    update(s => ({ ...s, isRunning: false }))
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }

  function toggle() {
    const state = get(simulationStore)
    if (state.isRunning) {
      pause()
    } else {
      start()
    }
  }

  function setSpeed(speed: number) {
    update(s => ({ ...s, speed: Math.max(0.1, Math.min(100, speed)) }))
  }

  function jumpToTime(time: number) {
    pause()
    const mapData = get(mapStore)

    update(state => {
      const config = state.config
      const trainConfigs = createTrainScheduler(mapData, config)
      let liveTrains = initializeLiveTrains(trainConfigs)
      let liveStations = initializeLiveStations(mapData)

      const stepSize = 1
      let currentTime = config.startTime

      while (currentTime < time) {
        const delta = Math.min(stepSize, time - currentTime)
        const result = simulationStep(currentTime, delta, liveTrains, liveStations, config, mapData, state.brokenTrainIds)
        liveTrains = result.trains
        liveStations = result.stations
        currentTime += delta
      }

      const finalResult = simulationStep(time, 0, liveTrains, liveStations, config, mapData, state.brokenTrainIds)

      return {
        ...state,
        currentTime: time,
        trains: finalResult.trains,
        stations: finalResult.stations,
        stats: finalResult.stats
      }
    })
  }

  function reset() {
    pause()
    initSimulation()
  }

  function updateConfig(updates: Partial<SimulationConfig>) {
    update(state => ({
      ...state,
      config: { ...state.config, ...updates }
    }))
    initSimulation()
  }

  function selectTrain(trainId: string | null) {
    update(state => ({ ...state, selectedTrainId: trainId }))
  }

  function breakTrain(trainId: string, delaySeconds: number) {
    update(state => {
      const newTrains = simulateBreakdown(trainId, state.trains, delaySeconds)
      const newBrokenIds = state.brokenTrainIds.includes(trainId)
        ? state.brokenTrainIds
        : [...state.brokenTrainIds, trainId]
      return {
        ...state,
        trains: newTrains,
        brokenTrainIds: newBrokenIds
      }
    })
  }

  function fixTrain(trainId: string) {
    update(state => ({
      ...state,
      brokenTrainIds: state.brokenTrainIds.filter(id => id !== trainId),
      trains: state.trains.map(t =>
        t.id === trainId ? { ...t, status: t.delaySeconds > 0 ? 'delayed' : 'running' } : t
      )
    }))
  }

  const simulationStore = {
    subscribe,
    set,
    init: initSimulation,
    start,
    pause,
    toggle,
    setSpeed,
    jumpToTime,
    reset,
    updateConfig,
    selectTrain,
    breakTrain,
    fixTrain
  }

  return simulationStore
}

export const simulationStore = createSimulationStore()
