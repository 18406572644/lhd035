import { writable, derived } from 'svelte/store'
import type { MetroMapData, Station, MetroLine, ViewState, ToolMode, StationDetail } from '../types'
import { generateId } from '../utils/path'
import { getSampleData, saveMapData, loadMapData } from '../utils/storage'

function createMapStore() {
  const savedData = loadMapData()
  const initialData: MetroMapData = savedData || getSampleData()

  const { subscribe, set, update } = writable<MetroMapData>(initialData)

  return {
    subscribe,
    set,

    addLine(name: string, color: string) {
      update(data => {
        const newLine: MetroLine = {
          id: generateId(),
          name,
          color,
          stationIds: []
        }
        return { ...data, lines: [...data.lines, newLine] }
      })
    },

    removeLine(lineId: string) {
      update(data => {
        const line = data.lines.find(l => l.id === lineId)
        if (!line) return data

        const stationsToCheck = line.stationIds
        const updatedStations = data.stations.map(s => {
          if (stationsToCheck.includes(s.id)) {
            const transferLines = s.transferLines?.filter(id => id !== lineId) || []
            const otherLines = data.lines
              .filter(l => l.id !== lineId && l.stationIds.includes(s.id))
              .map(l => l.id)
            const allTransfer = [...new Set([...transferLines, ...otherLines])]
            return {
              ...s,
              isTransfer: allTransfer.length > 0,
              transferLines: allTransfer.length > 0 ? allTransfer : undefined
            }
          }
          return s
        })

        return {
          ...data,
          lines: data.lines.filter(l => l.id !== lineId),
          stations: updatedStations
        }
      })
    },

    updateLine(lineId: string, updates: Partial<MetroLine>) {
      update(data => ({
        ...data,
        lines: data.lines.map(l => (l.id === lineId ? { ...l, ...updates } : l))
      }))
    },

    addStation(name: string, x: number, y: number, lineId?: string) {
      const stationId = generateId()
      const newStation: Station = {
        id: stationId,
        name,
        x,
        y,
        isTransfer: false
      }

      update(data => {
        let updatedLines = data.lines
        if (lineId) {
          updatedLines = data.lines.map(l => {
            if (l.id === lineId) {
              return { ...l, stationIds: [...l.stationIds, stationId] }
            }
            return l
          })

          const line = data.lines.find(l => l.id === lineId)
          if (line && line.stationIds.length > 0) {
            newStation.transferLines = [lineId]
            newStation.isTransfer = false
          }
        }

        return {
          ...data,
          stations: [...data.stations, newStation],
          lines: updatedLines
        }
      })

      return stationId
    },

    removeStation(stationId: string) {
      update(data => ({
        ...data,
        stations: data.stations.filter(s => s.id !== stationId),
        lines: data.lines.map(l => ({
          ...l,
          stationIds: l.stationIds.filter(id => id !== stationId)
        }))
      }))
    },

    updateStation(stationId: string, updates: Partial<Station>) {
      update(data => ({
        ...data,
        stations: data.stations.map(s => (s.id === stationId ? { ...s, ...updates } : s))
      }))
    },

    addStationToLine(lineId: string, stationId: string, index?: number) {
      update(data => {
        const line = data.lines.find(l => l.id === lineId)
        if (!line) return data

        let newStationIds = [...line.stationIds]
        if (index !== undefined) {
          newStationIds.splice(index, 0, stationId)
        } else {
          newStationIds.push(stationId)
        }

        const updatedStations = data.stations.map(s => {
          if (s.id === stationId) {
            const transferLines = s.transferLines || []
            if (!transferLines.includes(lineId)) {
              const newTransferLines = [...transferLines, lineId]
              return {
                ...s,
                transferLines: newTransferLines,
                isTransfer: newTransferLines.length > 1
              }
            }
          }
          return s
        })

        return {
          ...data,
          lines: data.lines.map(l => (l.id === lineId ? { ...l, stationIds: newStationIds } : l)),
          stations: updatedStations
        }
      })
    },

    removeStationFromLine(lineId: string, stationId: string) {
      update(data => {
        const updatedStations = data.stations.map(s => {
          if (s.id === stationId) {
            const transferLines = (s.transferLines || []).filter(id => id !== lineId)
            return {
              ...s,
              transferLines: transferLines.length > 0 ? transferLines : undefined,
              isTransfer: transferLines.length > 1
            }
          }
          return s
        })

        return {
          ...data,
          lines: data.lines.map(l => ({
            ...l,
            stationIds: l.stationIds.filter(id => id !== stationId)
          })),
          stations: updatedStations
        }
      })
    },

    reorderStationsInLine(lineId: string, stationIds: string[]) {
      update(data => ({
        ...data,
        lines: data.lines.map(l => (l.id === lineId ? { ...l, stationIds } : l))
      }))
    },

    setMapName(name: string) {
      update(data => ({ ...data, mapName: name }))
    }
  }
}

export const mapStore = createMapStore()

mapStore.subscribe(value => {
  saveMapData(value)
})

export const viewStore = writable<ViewState>({
  scale: 1,
  offsetX: 0,
  offsetY: 0
})

export const toolModeStore = writable<ToolMode>('select')

export const selectedStationIdStore = writable<string | null>(null)

export const selectedLineIdStore = writable<string | null>(null)

export const isSimulatingStore = writable(false)

export const highlightStationIdStore = writable<string | null>(null)

export const selectedStationDetail = derived<
  [typeof mapStore, typeof selectedStationIdStore],
  StationDetail | null
>([mapStore, selectedStationIdStore], ([$map, $selectedId]) => {
  if (!$selectedId) return null
  const station = $map.stations.find(s => s.id === $selectedId)
  if (!station) return null
  const lines = $map.lines.filter(l => l.stationIds.includes($selectedId))
  return { station, lines }
})

export function resetView() {
  viewStore.set({ scale: 1, offsetX: 0, offsetY: 0 })
}

export function zoomIn() {
  viewStore.update(v => ({ ...v, scale: Math.min(v.scale * 1.2, 5) }))
}

export function zoomOut() {
  viewStore.update(v => ({ ...v, scale: Math.max(v.scale / 1.2, 0.2) }))
}
