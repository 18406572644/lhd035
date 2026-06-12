import { writable, derived, get } from 'svelte/store'
import type { MetroMapData, Station, MetroLine, ViewState, ToolMode, StationDetail, ValidationResult, ValidationRuleConfig, ValidationIssue, EditorConfig, DraggingState, AlignmentGuides } from '../types'
import { DEFAULT_VALIDATION_RULES, DEFAULT_EDITOR_CONFIG } from '../types'
import { generateId } from '../utils/path'
import { getSampleData, saveMapData, loadMapData } from '../utils/storage'
import { validateMapData, fixIssue } from '../utils/validation'

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

const VALIDATION_RULES_KEY = 'metro_validation_rules'

function loadValidationRules(): ValidationRuleConfig[] {
  try {
    const saved = localStorage.getItem(VALIDATION_RULES_KEY)
    if (saved) {
      const savedRules = JSON.parse(saved) as ValidationRuleConfig[]
      const defaultRules = [...DEFAULT_VALIDATION_RULES]
      return defaultRules.map(rule => {
        const saved = savedRules.find(r => r.id === rule.id)
        return saved ? { ...rule, enabled: saved.enabled, severity: saved.severity } : rule
      })
    }
  } catch (e) {
    console.error('Failed to load validation rules:', e)
  }
  return [...DEFAULT_VALIDATION_RULES]
}

export const validationRulesStore = writable<ValidationRuleConfig[]>(loadValidationRules())

validationRulesStore.subscribe(rules => {
  try {
    localStorage.setItem(VALIDATION_RULES_KEY, JSON.stringify(rules))
  } catch (e) {
    console.error('Failed to save validation rules:', e)
  }
})

export const validationResultStore = derived<
  [typeof mapStore, typeof validationRulesStore],
  ValidationResult
>([mapStore, validationRulesStore], ([$map, $rules]) => {
  return validateMapData($map, $rules)
})

export function toggleValidationRule(ruleId: string) {
  validationRulesStore.update(rules =>
    rules.map(r => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
  )
}

export function setValidationRuleSeverity(ruleId: string, severity: 'error' | 'warning' | 'info') {
  validationRulesStore.update(rules =>
    rules.map(r => (r.id === ruleId ? { ...r, severity } : r))
  )
}

export function resetValidationRules() {
  validationRulesStore.set([...DEFAULT_VALIDATION_RULES])
}

export function fixValidationIssue(issue: ValidationIssue) {
  const currentData = get(mapStore)
  const fixedData = fixIssue(currentData, issue)
  if (fixedData) {
    mapStore.set(fixedData)
  }
}

export function fixAllValidationIssues() {
  const result = get(validationResultStore)
  const fixableIssues = result.issues.filter(i => i.fixable)
  if (fixableIssues.length === 0) return

  let currentData = get(mapStore)
  for (const issue of fixableIssues) {
    const fixed = fixIssue(currentData, issue)
    if (fixed) {
      currentData = fixed
    }
  }
  mapStore.set(currentData)
}

const EDITOR_CONFIG_KEY = 'metro_editor_config'

function loadEditorConfig(): EditorConfig {
  try {
    const saved = localStorage.getItem(EDITOR_CONFIG_KEY)
    if (saved) {
      return { ...DEFAULT_EDITOR_CONFIG, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.error('Failed to load editor config:', e)
  }
  return { ...DEFAULT_EDITOR_CONFIG }
}

export const editorConfigStore = writable<EditorConfig>(loadEditorConfig())

editorConfigStore.subscribe(config => {
  try {
    localStorage.setItem(EDITOR_CONFIG_KEY, JSON.stringify(config))
  } catch (e) {
    console.error('Failed to save editor config:', e)
  }
})

export function toggleSnapToGrid() {
  editorConfigStore.update(c => ({ ...c, snapToGrid: !c.snapToGrid }))
}

export function setGridSize(size: number) {
  editorConfigStore.update(c => ({ ...c, gridSize: Math.max(10, Math.min(200, size)) }))
}

export function toggleAlignmentGuides() {
  editorConfigStore.update(c => ({ ...c, showAlignmentGuides: !c.showAlignmentGuides }))
}

export const draggingStateStore = writable<DraggingState>({
  isDragging: false,
  stationId: null,
  startX: 0,
  startY: 0,
  startStationX: 0,
  startStationY: 0,
  currentX: 0,
  currentY: 0,
  shiftPressed: false
})

export const alignmentGuidesStore = writable<AlignmentGuides>({
  vertical: [],
  horizontal: [],
  snapVertical: null,
  snapHorizontal: null
})
