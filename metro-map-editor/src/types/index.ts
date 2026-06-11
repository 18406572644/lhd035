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
