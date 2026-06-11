import type { MetroMapData } from '../types'

const STORAGE_KEY = 'metro_map_data'

export function saveMapData(data: MetroMapData): void {
  try {
    data.updatedAt = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save map data:', e)
  }
}

export function loadMapData(): MetroMapData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      return JSON.parse(data) as MetroMapData
    }
  } catch (e) {
    console.error('Failed to load map data:', e)
  }
  return null
}

export function clearMapData(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export async function mockFetchMapData(): Promise<MetroMapData> {
  await new Promise(resolve => setTimeout(resolve, 500))
  return getSampleData()
}

export function getSampleData(): MetroMapData {
  return {
    mapName: '示例地铁线路图',
    lines: [
      {
        id: 'line1',
        name: '1号线',
        color: '#E4002B',
        stationIds: ['s1', 's2', 's3', 's4', 's5', 's6', 's7']
      },
      {
        id: 'line2',
        name: '2号线',
        color: '#009944',
        stationIds: ['s8', 's9', 's3', 's10', 's11', 's12']
      },
      {
        id: 'line3',
        name: '3号线',
        color: '#0065B3',
        stationIds: ['s13', 's14', 's5', 's15', 's16']
      }
    ],
    stations: [
      { id: 's1', name: '苹果园', x: 80, y: 200, isTransfer: false },
      { id: 's2', name: '古城', x: 180, y: 200, isTransfer: false },
      { id: 's3', name: '复兴门', x: 300, y: 200, isTransfer: true, transferLines: ['line1', 'line2'] },
      { id: 's4', name: '西单', x: 420, y: 200, isTransfer: false },
      { id: 's5', name: '天安门东', x: 540, y: 200, isTransfer: true, transferLines: ['line1', 'line3'] },
      { id: 's6', name: '王府井', x: 660, y: 200, isTransfer: false },
      { id: 's7', name: '四惠', x: 780, y: 200, isTransfer: false },
      { id: 's8', name: '西直门', x: 300, y: 60, isTransfer: false },
      { id: 's9', name: '阜成门', x: 300, y: 130, isTransfer: false },
      { id: 's10', name: '前门', x: 300, y: 300, isTransfer: false },
      { id: 's11', name: '崇文门', x: 300, y: 400, isTransfer: false },
      { id: 's12', name: '北京站', x: 300, y: 500, isTransfer: false },
      { id: 's13', name: '颐和园', x: 540, y: 60, isTransfer: false },
      { id: 's14', name: '中关村', x: 540, y: 130, isTransfer: false },
      { id: 's15', name: '国贸', x: 540, y: 320, isTransfer: false },
      { id: 's16', name: '双井', x: 540, y: 440, isTransfer: false }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}
