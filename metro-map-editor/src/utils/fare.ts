import type {
  MetroMapData,
  FareConfig,
  FareCalculationResult,
  RouteResult,
  DiscountPeriod,
  StationFareRange,
  FareTableEntry
} from '../types'
import { findRoute } from './routing'
import { generateId } from './path'

export function calculateFare(
  mapData: MetroMapData,
  fromStationId: string,
  toStationId: string,
  fareConfig: FareConfig,
  travelTime?: number
): FareCalculationResult | null {
  const route = findRoute(mapData, fromStationId, toStationId)
  if (!route) return null

  const breakdown: { description: string; amount: number }[] = []

  let basePrice = 0
  switch (fareConfig.ruleType) {
    case 'distance':
      basePrice = calculateDistanceFare(route.totalDistance, fareConfig)
      breakdown.push({ description: '里程票价', amount: basePrice })
      break
    case 'station_count':
      basePrice = calculateStationCountFare(route.totalStations, fareConfig)
      breakdown.push({ description: '站数票价', amount: basePrice })
      break
    case 'by_line':
      basePrice = calculateByLineFare(route, fareConfig)
      breakdown.push({ description: '线路票价', amount: basePrice })
      break
  }

  let transferFee = 0
  if (fareConfig.transferConfig.enabled && route.transferCount > 0) {
    transferFee = calculateTransferFee(route.transferCount, fareConfig)
    if (transferFee > 0) {
      breakdown.push({ description: `换乘费 (${route.transferCount}次)`, amount: transferFee })
    }
  }

  const subtotal = basePrice + transferFee

  let discount = 0
  let discountApplied: DiscountPeriod | undefined
  if (travelTime !== undefined && fareConfig.discountPeriods.length > 0) {
    const period = getActiveDiscountPeriod(fareConfig.discountPeriods, travelTime)
    if (period) {
      discount = subtotal * (1 - period.discountRate)
      discountApplied = period
      breakdown.push({ description: `${period.name}优惠`, amount: -discount })
    }
  }

  const finalPrice = Math.max(0, subtotal - discount)

  return {
    basePrice,
    transferFee,
    discount,
    finalPrice: Math.round(finalPrice * 100) / 100,
    route,
    discountApplied,
    breakdown
  }
}

function calculateDistanceFare(distance: number, fareConfig: FareConfig): number {
  const { basePrice, baseDistance, unitPrice, unitDistance } = fareConfig.distanceConfig

  if (distance <= baseDistance) {
    return basePrice
  }

  const extraDistance = distance - baseDistance
  const extraUnits = Math.ceil(extraDistance / unitDistance)
  return basePrice + extraUnits * unitPrice
}

function calculateStationCountFare(stationCount: number, fareConfig: FareConfig): number {
  const { tiers, defaultPrice } = fareConfig.stationCountConfig

  if (stationCount <= 0) return 0

  const sortedTiers = [...tiers].sort((a, b) => a.maxStations - b.maxStations)

  for (const tier of sortedTiers) {
    if (stationCount <= tier.maxStations) {
      return tier.price
    }
  }

  return defaultPrice
}

function calculateByLineFare(route: RouteResult, fareConfig: FareConfig): number {
  const { linePrices, defaultLinePrice, basePrice } = fareConfig.lineConfig

  let totalLinePrice = 0
  const lineIds = new Set(route.lineIds)

  for (const lineId of lineIds) {
    totalLinePrice += linePrices[lineId] ?? defaultLinePrice
  }

  return basePrice + totalLinePrice
}

function calculateTransferFee(transferCount: number, fareConfig: FareConfig): number {
  const { feePerTransfer, maxTransferFee, freeTransferCount = 0 } = fareConfig.transferConfig

  const chargeableTransfers = Math.max(0, transferCount - freeTransferCount)
  let fee = chargeableTransfers * feePerTransfer

  if (maxTransferFee !== undefined) {
    fee = Math.min(fee, maxTransferFee)
  }

  return fee
}

function getActiveDiscountPeriod(
  periods: DiscountPeriod[],
  travelTime: number
): DiscountPeriod | undefined {
  const timeInSeconds = travelTime % 86400

  for (const period of periods) {
    if (period.startTime <= period.endTime) {
      if (timeInSeconds >= period.startTime && timeInSeconds < period.endTime) {
        return period
      }
    } else {
      if (timeInSeconds >= period.startTime || timeInSeconds < period.endTime) {
        return period
      }
    }
  }

  return undefined
}

export function getStationFareRanges(
  mapData: MetroMapData,
  stationId: string,
  fareConfig: FareConfig
): StationFareRange[] {
  const results: StationFareRange[] = []

  for (const targetStation of mapData.stations) {
    if (targetStation.id === stationId) continue

    const fareResult = calculateFare(mapData, stationId, targetStation.id, fareConfig)
    if (fareResult) {
      results.push({
        stationId: targetStation.id,
        stationName: targetStation.name,
        minPrice: fareResult.finalPrice,
        maxPrice: fareResult.finalPrice,
        avgPrice: fareResult.finalPrice
      })
    }
  }

  return results.sort((a, b) => a.minPrice - b.minPrice)
}

export function getFarePriceRange(
  mapData: MetroMapData,
  stationId: string,
  fareConfig: FareConfig
): { minPrice: number; maxPrice: number; avgPrice: number } {
  const ranges = getStationFareRanges(mapData, stationId, fareConfig)

  if (ranges.length === 0) {
    return { minPrice: 0, maxPrice: 0, avgPrice: 0 }
  }

  const prices = ranges.map(r => r.minPrice)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length

  return {
    minPrice,
    maxPrice,
    avgPrice: Math.round(avgPrice * 100) / 100
  }
}

export function generateFareTable(
  mapData: MetroMapData,
  fareConfig: FareConfig
): FareTableEntry[] {
  const entries: FareTableEntry[] = []

  for (let i = 0; i < mapData.stations.length; i++) {
    for (let j = i + 1; j < mapData.stations.length; j++) {
      const fromStation = mapData.stations[i]
      const toStation = mapData.stations[j]

      const fareResult = calculateFare(
        mapData,
        fromStation.id,
        toStation.id,
        fareConfig
      )

      if (fareResult) {
        entries.push({
          fromStationId: fromStation.id,
          fromStationName: fromStation.name,
          toStationId: toStation.id,
          toStationName: toStation.name,
          price: fareResult.finalPrice,
          distance: fareResult.route.totalDistance,
          stationCount: fareResult.route.totalStations,
          transferCount: fareResult.route.transferCount
        })
      }
    }
  }

  return entries
}

export function exportFareTableCSV(
  mapData: MetroMapData,
  fareConfig: FareConfig
): string {
  const entries = generateFareTable(mapData, fareConfig)

  const headers = [
    '起点站',
    '终点站',
    '票价(元)',
    '距离(米)',
    '站数',
    '换乘次数'
  ]

  const rows = entries.map(entry => [
    entry.fromStationName,
    entry.toStationName,
    entry.price.toFixed(2),
    Math.round(entry.distance).toString(),
    entry.stationCount.toString(),
    entry.transferCount.toString()
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  return '\uFEFF' + csvContent
}

export function downloadFareTableCSV(
  mapData: MetroMapData,
  fareConfig: FareConfig,
  filename?: string
): void {
  const csvContent = exportFareTableCSV(mapData, fareConfig)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename || `fare-table-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function createDiscountPeriod(
  name: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  discountRate: number
): DiscountPeriod {
  return {
    id: generateId(),
    name,
    startTime: startHour * 3600 + startMinute * 60,
    endTime: endHour * 3600 + endMinute * 60,
    discountRate
  }
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}
