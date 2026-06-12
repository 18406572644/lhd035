import { writable, derived, get } from 'svelte/store'
import type {
  Branch,
  Version,
  VersionControlState,
  MetroMapData,
  MapDiff,
  MergeConflict,
  VersionTag
} from '../types'
import {
  createMainBranch,
  createBranch as createBranchUtil,
  createVersion as createVersionUtil,
  saveBranches,
  loadBranches,
  saveVersions,
  loadVersions,
  getVersionsByBranch,
  getNextVersionNumber,
  getLatestVersionInBranch,
  generateAutoSummary,
  formatTimestampReadable,
  createTag,
  deepCloneMapData,
  importVersionFromFile,
  exportVersionToFile
} from '../utils/versionManager'
import { compareMaps } from '../utils/diff'
import {
  mergeBranches,
  resolveConflict,
  applyAllResolutions,
  canAutoResolveConflicts
} from '../utils/merge'
import { AUTO_SNAPSHOT_DEBOUNCE_MS } from '../types'

function createVersionStore() {
  const savedBranches = loadBranches()
  const savedVersions = loadVersions()

  let initialBranches: Branch[] = []
  let initialVersions: Version[] = []

  if (savedBranches && savedBranches.length > 0) {
    initialBranches = savedBranches
  } else {
    const mainBranch = createMainBranch()
    initialBranches = [mainBranch]
  }

  if (savedVersions && savedVersions.length > 0) {
    initialVersions = savedVersions
  }

  const activeBranchId = initialBranches.find(b => b.isActive)?.id || initialBranches[0]?.id || ''

  const initialState: VersionControlState = {
    branches: initialBranches,
    versions: initialVersions,
    activeBranchId,
    selectedVersionIds: [],
    isDiffMode: false,
    diffFromVersionId: null,
    diffToVersionId: null,
    mergeSourceBranchId: null,
    mergeTargetBranchId: null,
    pendingConflicts: [],
    showVersionPanel: false,
    currentDiff: null,
    lastAutoSnapshotTime: 0
  }

  const { subscribe, set, update } = writable<VersionControlState>(initialState)

  let autoSnapshotTimer: number | null = null
  let lastSnapshotDataHash: string = ''

  function computeDataHash(data: MetroMapData): string {
    try {
      return JSON.stringify(data)
    } catch {
      return ''
    }
  }

  function persistState(branches: Branch[], versions: Version[]) {
    saveBranches(branches)
    const { overflowed } = saveVersions(versions)
    if (overflowed.length > 0) {
      console.warn(`已清理 ${overflowed.length} 个旧版本，请及时导出里程碑版本`)
    }
  }

  function createInitialVersionIfNeeded(mapData: MetroMapData) {
    update(state => {
      if (state.versions.length === 0) {
        const mainBranch = state.branches.find(b => b.isMain) || state.branches[0]
        const version = createVersionUtil(mapData, mainBranch.id, {
          versionNumber: 1,
          summary: '初始版本',
          snapshotType: 'auto',
          isMilestone: true
        })
        mainBranch.currentVersionId = version.id
        mainBranch.updatedAt = Date.now()

        lastSnapshotDataHash = computeDataHash(mapData)

        persistState(
          state.branches.map(b => b.id === mainBranch.id ? { ...mainBranch } : b),
          [...state.versions, version]
        )

        return {
          ...state,
          versions: [...state.versions, version],
          branches: state.branches.map(b => b.id === mainBranch.id ? { ...mainBranch } : b)
        }
      }
      return state
    })
  }

  function createSnapshot(
    mapData: MetroMapData,
    options: {
      userDescription?: string
      isMilestone?: boolean
      tags?: VersionTag[]
      force?: boolean
    } = {}
  ) {
    update(state => {
      const activeBranch = state.branches.find(b => b.id === state.activeBranchId)
      if (!activeBranch) return state

      const dataHash = computeDataHash(mapData)

      if (!options.force) {
        if (dataHash && dataHash === lastSnapshotDataHash) {
          return state
        }

        const latestVersion = getLatestVersionInBranch(state.versions, activeBranch.id)
        const latestData = latestVersion?.data
        if (latestData && JSON.stringify(latestData) === dataHash) {
          lastSnapshotDataHash = dataHash
          return state
        }
      }

      const latestVersion = getLatestVersionInBranch(state.versions, activeBranch.id)
      const latestData = latestVersion?.data || null
      const versionNumber = getNextVersionNumber(state.versions, activeBranch.id)
      const summary = generateAutoSummary(latestData, mapData)

      const version = createVersionUtil(mapData, activeBranch.id, {
        parentVersionId: activeBranch.currentVersionId,
        versionNumber,
        summary,
        userDescription: options.userDescription,
        isMilestone: options.isMilestone,
        tags: options.tags,
        snapshotType: options.userDescription || options.isMilestone ? 'manual' : 'auto'
      })

      const updatedBranch: Branch = {
        ...activeBranch,
        currentVersionId: version.id,
        updatedAt: Date.now()
      }

      const newVersions = [...state.versions, version]
      const newBranches = state.branches.map(b => b.id === activeBranch.id ? updatedBranch : b)

      lastSnapshotDataHash = dataHash

      persistState(newBranches, newVersions)

      return {
        ...state,
        versions: newVersions,
        branches: newBranches,
        lastAutoSnapshotTime: Date.now()
      }
    })
  }

  function scheduleAutoSnapshot(getMapData: () => MetroMapData) {
    if (autoSnapshotTimer) {
      clearTimeout(autoSnapshotTimer)
    }

    autoSnapshotTimer = window.setTimeout(() => {
      const mapData = getMapData()
      if (mapData) {
        const hash = computeDataHash(mapData)
        if (hash && hash === lastSnapshotDataHash) {
          return
        }
        createSnapshot(mapData, {})
      }
    }, AUTO_SNAPSHOT_DEBOUNCE_MS)
  }

  function restoreVersion(versionId: string, asNewVersion: boolean = true): MetroMapData | null {
    let resultData: MetroMapData | null = null

    update(state => {
      const version = state.versions.find(v => v.id === versionId)
      if (!version) { resultData = null; return state }

      const data = deepCloneMapData(version.data)
      resultData = data

      if (asNewVersion) {
        const activeBranch = state.branches.find(b => b.id === state.activeBranchId)
        if (activeBranch) {
          const versionNumber = getNextVersionNumber(state.versions, activeBranch.id)
          const newVersion = createVersionUtil(data, activeBranch.id, {
            parentVersionId: activeBranch.currentVersionId,
            versionNumber,
            summary: `回滚至 v${version.versionNumber}（${formatTimestampReadable(version.timestamp)}）`,
            snapshotType: 'manual'
          })

          const updatedBranch: Branch = {
            ...activeBranch,
            currentVersionId: newVersion.id,
            updatedAt: Date.now()
          }

          const newVersions = [...state.versions, newVersion]
          const newBranches = state.branches.map(b => b.id === activeBranch.id ? updatedBranch : b)

          lastSnapshotDataHash = computeDataHash(data)
          persistState(newBranches, newVersions)

          return {
            ...state,
            versions: newVersions,
            branches: newBranches
          }
        }
      }

      return state
    })

    return resultData
  }

  function switchBranch(branchId: string): MetroMapData | null {
    let resultData: MetroMapData | null = null

    update(state => {
      const targetBranch = state.branches.find(b => b.id === branchId)
      if (!targetBranch) return state

      const newBranches = state.branches.map(b => ({
        ...b,
        isActive: b.id === branchId
      }))

      saveBranches(newBranches)

      if (targetBranch.currentVersionId) {
        const version = state.versions.find(v => v.id === targetBranch.currentVersionId)
        if (version) {
          resultData = deepCloneMapData(version.data)
          lastSnapshotDataHash = computeDataHash(version.data)
        }
      }

      return {
        ...state,
        branches: newBranches,
        activeBranchId: branchId,
        selectedVersionIds: [],
        isDiffMode: false,
        diffFromVersionId: null,
        diffToVersionId: null,
        currentDiff: null
      }
    })

    return resultData
  }

  function createBranch(
    name: string,
    baseVersionId?: string,
    description?: string
  ): Branch {
    let createdBranch: Branch | null = null

    update(state => {
      const activeBranch = state.branches.find(b => b.id === state.activeBranchId)
      const baseVerId = baseVersionId || activeBranch?.currentVersionId || null

      const newBranch: Branch = createBranchUtil(name, {
        baseBranchId: state.activeBranchId,
        baseVersionId: baseVerId,
        description
      })

      if (baseVerId) {
        newBranch.currentVersionId = baseVerId
      }

      createdBranch = newBranch

      const newBranches = [...state.branches, newBranch]
      saveBranches(newBranches)

      return {
        ...state,
        branches: newBranches
      }
    })

    return createdBranch!
  }

  function deleteBranch(branchId: string) {
    update(state => {
      const branch = state.branches.find(b => b.id === branchId)
      if (!branch || branch.isMain) return state

      if (branch.isActive) {
        const mainBranch = state.branches.find(b => b.isMain)
        if (mainBranch) {
          mainBranch.isActive = true
        }
      }

      const newBranches = state.branches.filter(b => b.id !== branchId)
      const branchVersionIds = new Set(state.versions.filter(v => v.branchId === branchId).map(v => v.id))

      let newVersions = state.versions.filter(v => v.branchId !== branchId)
      newVersions = newVersions.map(v => {
        if (v.parentVersionId && branchVersionIds.has(v.parentVersionId)) {
          return { ...v, parentVersionId: null }
        }
        return v
      })

      persistState(newBranches, newVersions)

      return {
        ...state,
        branches: newBranches,
        versions: newVersions,
        activeBranchId: newBranches.find(b => b.isActive)?.id || newBranches[0]?.id || ''
      }
    })
  }

  function startDiff(fromVersionId: string, toVersionId: string): MapDiff | null {
    let result: MapDiff | null = null

    update(state => {
      const fromVersion = state.versions.find(v => v.id === fromVersionId)
      const toVersion = state.versions.find(v => v.id === toVersionId)

      if (!fromVersion || !toVersion) return state

      const diff = compareMaps(fromVersion.data, toVersion.data)
      result = diff

      return {
        ...state,
        isDiffMode: true,
        diffFromVersionId: fromVersionId,
        diffToVersionId: toVersionId,
        currentDiff: diff
      }
    })

    return result
  }

  function exitDiffMode() {
    update(s => ({
      ...s,
      isDiffMode: false,
      diffFromVersionId: null,
      diffToVersionId: null,
      currentDiff: null
    }))
  }

  function startMerge(sourceBranchId: string): { conflicts: MergeConflict[]; mergedData?: MetroMapData } | null {
    let mergeResult: { conflicts: MergeConflict[]; mergedData?: MetroMapData } | null = null

    update(state => {
      const targetBranch = state.branches.find(b => b.id === state.activeBranchId)
      const sourceBranch = state.branches.find(b => b.id === sourceBranchId)

      if (!targetBranch || !sourceBranch) { mergeResult = null; return state }

      const result = mergeBranches(state.versions, targetBranch, targetBranch, sourceBranch)
      mergeResult = {
        conflicts: result.conflicts,
        mergedData: result.mergedData
      }

      return {
        ...state,
        mergeSourceBranchId: sourceBranchId,
        mergeTargetBranchId: state.activeBranchId,
        pendingConflicts: result.conflicts
      }
    })

    return mergeResult
  }

  function resolveMergeConflict(conflictId: string, resolution: 'base' | 'ours' | 'theirs') {
    update(state => {
      const updatedConflicts = state.pendingConflicts.map(c =>
        c.id === conflictId ? { ...c, resolution } : c
      )
      return {
        ...state,
        pendingConflicts: updatedConflicts
      }
    })
  }

  function finalizeMerge(mergedData: MetroMapData, options?: { userDescription?: string }) {
    const currentState = get({ subscribe })
    const sourceBranch = currentState.branches.find(b => b.id === currentState.mergeSourceBranchId)

    const resolvedData = applyAllResolutions(mergedData, currentState.pendingConflicts)

    createSnapshot(resolvedData, {
      userDescription: options?.userDescription || `合并分支「${sourceBranch?.name || ''}」`
    })

    update(s => ({
      ...s,
      mergeSourceBranchId: null,
      mergeTargetBranchId: null,
      pendingConflicts: []
    }))
  }

  function cancelMerge() {
    update(s => ({
      ...s,
      mergeSourceBranchId: null,
      mergeTargetBranchId: null,
      pendingConflicts: []
    }))
  }

  function toggleMilestone(versionId: string) {
    update(state => {
      const newVersions = state.versions.map(v =>
        v.id === versionId ? { ...v, isMilestone: !v.isMilestone } : v
      )
      saveVersions(newVersions)
      return {
        ...state,
        versions: newVersions
      }
    })
  }

  function addTagToVersion(versionId: string, name: string, description?: string, color?: string) {
    update(state => {
      const tag = createTag(name, description, color)
      const newVersions = state.versions.map(v =>
        v.id === versionId ? { ...v, tags: [...v.tags, tag] } : v
      )
      saveVersions(newVersions)
      return {
        ...state,
        versions: newVersions
      }
    })
  }

  function removeTagFromVersion(versionId: string, tagId: string) {
    update(state => {
      const newVersions = state.versions.map(v =>
        v.id === versionId ? { ...v, tags: v.tags.filter(t => t.id !== tagId) } : v
      )
      saveVersions(newVersions)
      return {
        ...state,
        versions: newVersions
      }
    })
  }

  function toggleVersionPanel(show?: boolean) {
    update(state => ({
      ...state,
      showVersionPanel: show !== undefined ? show : !state.showVersionPanel
    }))
  }

  function toggleVersionSelection(versionId: string) {
    update(state => {
      let selected = [...state.selectedVersionIds]
      if (selected.includes(versionId)) {
        selected = selected.filter(id => id !== versionId)
      } else {
        if (selected.length >= 2) {
          selected.shift()
        }
        selected.push(versionId)
      }
      return {
        ...state,
        selectedVersionIds: selected
      }
    })
  }

  function clearVersionSelection() {
    update(state => ({
      ...state,
      selectedVersionIds: []
    }))
  }

  async function importVersion(file: File) {
    const version = await importVersionFromFile(file)
    if (version) {
      update(state => {
        const newVersions = [...state.versions, version]
        saveVersions(newVersions)
        return {
          ...state,
          versions: newVersions
        }
      })
      return true
    }
    return false
  }

  function exportVersion(versionId: string) {
    const currentState = get({ subscribe })
    const version = currentState.versions.find(v => v.id === versionId)
    if (version) {
      exportVersionToFile(version)
    }
  }

  function updateBranch(branchId: string, updates: Partial<Branch>) {
    update(state => {
      const newBranches = state.branches.map(b =>
        b.id === branchId ? { ...b, ...updates, updatedAt: Date.now() } : b
      )
      saveBranches(newBranches)
      return {
        ...state,
        branches: newBranches
      }
    })
  }

  function getVersionById(id: string): Version | undefined {
    return get({ subscribe }).versions.find(v => v.id === id)
  }

  function getBranchById(id: string): Branch | undefined {
    return get({ subscribe }).branches.find(b => b.id === id)
  }

  const activeBranch = derived({ subscribe }, s => s.branches.find(b => b.id === s.activeBranchId))

  const activeBranchVersions = derived({ subscribe }, s =>
    getVersionsByBranch(s.versions, s.activeBranchId)
  )

  const milestoneVersions = derived({ subscribe }, s =>
    s.versions.filter(v => v.isMilestone).sort((a, b) => b.timestamp - a.timestamp)
  )

  const branchesWithVersionCount = derived({ subscribe }, s =>
    s.branches.map(b => ({
      branch: b,
      versionCount: s.versions.filter(v => v.branchId === b.id).length,
      lastUpdated: getVersionsByBranch(s.versions, b.id)[0]?.timestamp || b.updatedAt
    }))
  )

  return {
    subscribe,

    createInitialVersionIfNeeded,
    createSnapshot,
    scheduleAutoSnapshot,
    restoreVersion,
    switchBranch,
    createBranch,
    deleteBranch,
    updateBranch,
    startDiff,
    exitDiffMode,
    startMerge,
    resolveMergeConflict,
    finalizeMerge,
    cancelMerge,
    toggleMilestone,
    addTagToVersion,
    removeTagFromVersion,
    toggleVersionPanel,
    toggleVersionSelection,
    clearVersionSelection,
    importVersion,
    exportVersion,

    getVersionById,
    getBranchById,

    activeBranch,
    activeBranchVersions,
    milestoneVersions,
    branchesWithVersionCount,

    applyAllResolutions,
    canAutoResolveConflicts
  }
}

export const versionStore = createVersionStore()
