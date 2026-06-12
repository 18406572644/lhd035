import type { MetroMapData, Version, Branch, VersionTag } from '../types'
import { MAX_LOCAL_VERSIONS, VERSION_STORAGE_KEYS, BRANCH_COLORS } from '../types'
import { generateId } from './path'

const DEFAULT_AUTHOR = '当前用户'

export function generateVersionId(): string {
  return 'ver_' + generateId()
}

export function generateBranchId(): string {
  return 'br_' + generateId()
}

export function generateTagId(): string {
  return 'tag_' + generateId()
}

export function createBranch(
  name: string,
  options: Partial<Branch> = {}
): Branch {
  const now = Date.now()
  const colorIndex = Math.floor(Math.random() * BRANCH_COLORS.length)

  return {
    id: generateBranchId(),
    name,
    description: options.description,
    color: options.color || BRANCH_COLORS[colorIndex],
    createdAt: now,
    updatedAt: now,
    baseVersionId: options.baseVersionId || null,
    baseBranchId: options.baseBranchId || null,
    currentVersionId: null,
    isActive: options.isActive || false,
    isMain: options.isMain || false
  }
}

export function createMainBranch(): Branch {
  const branch = createBranch('main', { isMain: true, isActive: true })
  branch.name = '主分支'
  branch.color = BRANCH_COLORS[0]
  return branch
}

export function createVersion(
  data: MetroMapData,
  branchId: string,
  options: {
    parentVersionId?: string | null
    versionNumber?: number
    summary?: string
    userDescription?: string
    author?: string
    snapshotType?: 'auto' | 'manual'
    isMilestone?: boolean
    tags?: VersionTag[]
  } = {}
): Version {
  const now = Date.now()

  return {
    id: generateVersionId(),
    versionNumber: options.versionNumber || 1,
    branchId,
    timestamp: now,
    author: options.author || DEFAULT_AUTHOR,
    summary: options.summary || '保存版本',
    userDescription: options.userDescription,
    data: deepCloneMapData(data),
    parentVersionId: options.parentVersionId !== undefined ? options.parentVersionId : null,
    tags: options.tags || [],
    isMilestone: options.isMilestone || false,
    snapshotType: options.snapshotType || 'manual'
  }
}

export function deepCloneMapData(data: MetroMapData): MetroMapData {
  return JSON.parse(JSON.stringify(data))
}

export function generateAutoSummary(
  oldData: MetroMapData | null,
  newData: MetroMapData
): string {
  if (!oldData) {
    return `初始化地图：${newData.mapName}`
  }

  const changes: string[] = []

  const stationDiff = newData.stations.length - oldData.stations.length
  if (stationDiff > 0) changes.push(`新增 ${stationDiff} 个站点`)
  else if (stationDiff < 0) changes.push(`删除 ${Math.abs(stationDiff)} 个站点`)

  const lineDiff = newData.lines.length - oldData.lines.length
  if (lineDiff > 0) changes.push(`新增 ${lineDiff} 条线路`)
  else if (lineDiff < 0) changes.push(`删除 ${Math.abs(lineDiff)} 条线路`)

  if (changes.length === 0) {
    const oldStations = new Map(oldData.stations.map(s => [s.id, s]))
    const newStations = new Map(newData.stations.map(s => [s.id, s]))
    let modifiedCount = 0

    for (const [id, newStation] of newStations) {
      const oldStation = oldStations.get(id)
      if (oldStation && JSON.stringify(oldStation) !== JSON.stringify(newStation)) {
        modifiedCount++
      }
    }

    const oldLines = new Map(oldData.lines.map(l => [l.id, l]))
    const newLines = new Map(newData.lines.map(l => [l.id, l]))
    for (const [id, newLine] of newLines) {
      const oldLine = oldLines.get(id)
      if (oldLine && JSON.stringify(oldLine) !== JSON.stringify(newLine)) {
        modifiedCount++
      }
    }

    if (modifiedCount > 0) {
      changes.push(`修改 ${modifiedCount} 项属性`)
    }
  }

  if (oldData.mapName !== newData.mapName) {
    changes.push(`地图重命名为「${newData.mapName}」`)
  }

  return changes.length > 0 ? changes.join('；') : '未检测到变更'
}

export function saveBranches(branches: Branch[]): void {
  try {
    localStorage.setItem(VERSION_STORAGE_KEYS.BRANCHES, JSON.stringify(branches))
  } catch (e) {
    console.error('保存分支数据失败:', e)
  }
}

export function loadBranches(): Branch[] | null {
  try {
    const data = localStorage.getItem(VERSION_STORAGE_KEYS.BRANCHES)
    if (data) return JSON.parse(data) as Branch[]
  } catch (e) {
    console.error('加载分支数据失败:', e)
  }
  return null
}

export function saveVersions(versions: Version[]): { overflowed: Version[] } {
  const overflowed: Version[] = []

  try {
    const milestoneVersions = versions.filter(v => v.isMilestone)
    const nonMilestoneVersions = versions.filter(v => !v.isMilestone)

    if (versions.length > MAX_LOCAL_VERSIONS) {
      const overflowCount = versions.length - MAX_LOCAL_VERSIONS
      const sortedByTime = [...nonMilestoneVersions].sort((a, b) => a.timestamp - b.timestamp)
      const toRemove = sortedByTime.slice(0, overflowCount)
      overflowed.push(...toRemove)

      const toRemoveIds = new Set(toRemove.map(v => v.id))
      const remaining = versions.filter(v => !toRemoveIds.has(v.id))
      localStorage.setItem(VERSION_STORAGE_KEYS.VERSIONS, JSON.stringify(remaining))
    } else {
      localStorage.setItem(VERSION_STORAGE_KEYS.VERSIONS, JSON.stringify(versions))
    }
  } catch (e) {
    console.error('保存版本数据失败:', e)
  }

  return { overflowed }
}

export function loadVersions(): Version[] | null {
  try {
    const data = localStorage.getItem(VERSION_STORAGE_KEYS.VERSIONS)
    if (data) return JSON.parse(data) as Version[]
  } catch (e) {
    console.error('加载版本数据失败:', e)
  }
  return null
}

export function exportVersionToFile(version: Version): void {
  const exportData = {
    type: 'metro_map_version',
    exportTime: Date.now(),
    version
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `version_${version.versionNumber}_${formatTimestamp(version.timestamp)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importVersionFromFile(file: File): Promise<Version | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const parsed = JSON.parse(content)

        if (parsed.type === 'metro_map_version' && parsed.version) {
          resolve(parsed.version as Version)
        } else if (parsed.id && parsed.data && parsed.timestamp) {
          resolve(parsed as Version)
        } else {
          resolve(null)
        }
      } catch {
        resolve(null)
      }
    }
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`
}

export function formatTimestampReadable(ts: number): string {
  const date = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function getRelativeTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const week = 7 * day

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < week) return `${Math.floor(diff / day)} 天前`
  return formatTimestampReadable(ts)
}

export function getVersionsByBranch(versions: Version[], branchId: string): Version[] {
  return versions
    .filter(v => v.branchId === branchId)
    .sort((a, b) => b.timestamp - a.timestamp)
}

export function getNextVersionNumber(versions: Version[], branchId: string): number {
  const branchVersions = getVersionsByBranch(versions, branchId)
  if (branchVersions.length === 0) return 1
  return Math.max(...branchVersions.map(v => v.versionNumber)) + 1
}

export function getLatestVersionInBranch(versions: Version[], branchId: string): Version | null {
  const branchVersions = getVersionsByBranch(versions, branchId)
  return branchVersions.length > 0 ? branchVersions[0] : null
}

export function findCommonAncestor(
  versions: Version[],
  versionAId: string,
  versionBId: string
): Version | null {
  const versionA = versions.find(v => v.id === versionAId)
  const versionB = versions.find(v => v.id === versionBId)
  if (!versionA || !versionB) return null

  const ancestorsA = collectAncestors(versions, versionA.id)
  const ancestorsB = collectAncestors(versions, versionB.id)

  for (const ancestor of ancestorsA) {
    if (ancestorsB.some(b => b.id === ancestor.id)) {
      return ancestor
    }
  }

  return null
}

function collectAncestors(versions: Version[], versionId: string): Version[] {
  const ancestors: Version[] = []
  let current: Version | undefined = versions.find(v => v.id === versionId)

  while (current) {
    ancestors.push(current)
    if (current.parentVersionId) {
      current = versions.find(v => v.id === current!.parentVersionId)
    } else {
      break
    }
  }

  return ancestors
}

export function createTag(name: string, description?: string, color?: string): VersionTag {
  return {
    id: generateTagId(),
    name,
    description,
    color,
    createdAt: Date.now()
  }
}
