<script lang="ts">
  import { versionStore } from '../stores/versionStore'
  import type { Version, Branch, VersionTag, MapDiff } from '../types'
  import {
    getRelativeTime,
    formatTimestampReadable,
    getVersionsByBranch
  } from '../utils/versionManager'
  import { BRANCH_COLORS, MAX_LOCAL_VERSIONS } from '../types'
  import BranchTree from './BranchTree.svelte'
  import DiffViewer from './DiffViewer.svelte'

  export let show: boolean

  let activeTab: 'versions' | 'branches' | 'diff' = 'versions'
  let branchViewMode: 'list' | 'tree' = 'tree'
  let filterBranchId: string = ''
  let showMilestoneOnly = false
  let searchQuery = ''
  let showCreateBranchModal = false
  let showSaveVersionModal = false
  let newBranchName = ''
  let newBranchBaseVersionId: string | null = null
  let newBranchDescription = ''
  let saveVersionDescription = ''
  let saveVersionIsMilestone = false
  let selectedMergeSourceId: string | null = null

  let state: {
    versions: Version[]
    branches: Branch[]
    activeBranchId: string
    selectedVersionIds: string[]
    isDiffMode: boolean
    currentDiff: MapDiff | null
    pendingConflicts: unknown[]
  } = {
    versions: [],
    branches: [],
    activeBranchId: '',
    selectedVersionIds: [],
    isDiffMode: false,
    currentDiff: null,
    pendingConflicts: []
  }

  const unsubscribe = versionStore.subscribe(s => {
    state = { ...s }
    if (!filterBranchId) filterBranchId = s.activeBranchId
  })

  $: filteredVersions = computeFilteredVersions(
    state.versions,
    state.branches,
    filterBranchId,
    showMilestoneOnly,
    searchQuery
  )

  $: currentBranchVersions = getVersionsByBranch(state.versions, state.activeBranchId)

  $: canDiff = state.selectedVersionIds.length === 2

  function computeFilteredVersions(
    versions: Version[],
    branches: Branch[],
    branchFilterId: string,
    milestoneOnly: boolean,
    query: string
  ) {
    let result = versions

    if (branchFilterId) {
      result = result.filter(v => v.branchId === branchFilterId)
    }

    if (milestoneOnly) {
      result = result.filter(v => v.isMilestone)
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(v => {
        const branch = branches.find(b => b.id === v.branchId)
        return (
          v.summary.toLowerCase().includes(q) ||
          v.userDescription?.toLowerCase().includes(q) ||
          v.author.toLowerCase().includes(q) ||
          branch?.name.toLowerCase().includes(q) ||
          v.tags.some(t => t.name.toLowerCase().includes(q))
        )
      })
    }

    return result.sort((a, b) => b.timestamp - a.timestamp)
  }

  function handleClose() {
    versionStore.toggleVersionPanel(false)
  }

  function handleRestoreVersion(versionId: string) {
    if (!confirm('确定要回滚到此版本吗？当前未保存的修改将丢失。')) return
    const data = versionStore.restoreVersion(versionId, true)
    if (data) {
      import('../stores/mapStore').then(m => {
        m.mapStore.set(data)
      })
    }
  }

  function handleStartDiff() {
    if (state.selectedVersionIds.length === 2) {
      const [fromId, toId] = state.selectedVersionIds
      versionStore.startDiff(fromId, toId)
      activeTab = 'diff'
    }
  }

  function handleCreateBranch() {
    if (!newBranchName.trim()) return
    versionStore.createBranch(newBranchName.trim(), newBranchBaseVersionId || undefined, newBranchDescription.trim() || undefined)
    showCreateBranchModal = false
    newBranchName = ''
    newBranchDescription = ''
    newBranchBaseVersionId = null
  }

  function handleSaveVersion() {
    import('../stores/mapStore').then(m => {
      const mapData = { ...m.mapStore }
      versionStore.createSnapshot(mapData as any, {
        userDescription: saveVersionDescription.trim() || undefined,
        isMilestone: saveVersionIsMilestone,
        force: true
      })
    })
    showSaveVersionModal = false
    saveVersionDescription = ''
    saveVersionIsMilestone = false
  }

  function handleSwitchBranch(branchId: string) {
    if (branchId === state.activeBranchId) return
    const data = versionStore.switchBranch(branchId)
    if (data) {
      import('../stores/mapStore').then(m => {
        m.mapStore.set(data)
      })
    }
  }

  function handleDeleteBranch(branchId: string) {
    const branch = state.branches.find(b => b.id === branchId)
    if (!branch || branch.isMain) return
    if (!confirm(`确定要删除分支「${branch.name}」吗？该分支的所有版本将被删除。`)) return
    versionStore.deleteBranch(branchId)
  }

  function handleToggleMilestone(versionId: string) {
    versionStore.toggleMilestone(versionId)
  }

  function handleExportVersion(versionId: string) {
    versionStore.exportVersion(versionId)
  }

  async function handleImportVersion(e: Event) {
    const input = e.target as HTMLInputElement
    const files = input.files
    if (!files || files.length === 0) return

    const success = await versionStore.importVersion(files[0])
    if (!success) {
      alert('导入失败：文件格式不正确')
    }
    input.value = ''
  }

  function handleStartMerge() {
    if (!selectedMergeSourceId) return
    const result = versionStore.startMerge(selectedMergeSourceId)
    if (result) {
      if (result.conflicts.length === 0 && result.mergedData) {
        versionStore.finalizeMerge(result.mergedData)
        alert('合并成功！无冲突。')
      } else {
        alert(`检测到 ${result.conflicts.length} 个冲突，请在合并面板中解决。`)
      }
    }
    selectedMergeSourceId = null
  }

  function getBranchColor(branchId: string): string {
    const branch = state.branches.find(b => b.id === branchId)
    return branch?.color || BRANCH_COLORS[0]
  }

  function getBranchName(branchId: string): string {
    const branch = state.branches.find(b => b.id === branchId)
    return branch?.name || branchId
  }

  function getVersionChangeCount(version: Version): number {
    const parent = state.versions.find(v => v.id === version.parentVersionId)
    if (!parent) return version.data.stations.length + version.data.lines.length
    const diff = version.data.stations.length + version.data.lines.length -
                 (parent.data.stations.length + parent.data.lines.length)
    return Math.abs(diff)
  }
</script>

{#if show}
  <div class="vc-overlay" on:click={handleClose}>
    <div class="vc-panel" on:click|stopPropagation>
      <div class="vc-header">
        <div class="vc-header-left">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#0065B3" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <circle cx="18" cy="6" r="2" />
            <circle cx="6" cy="6" r="2" />
            <circle cx="18" cy="18" r="2" />
            <circle cx="6" cy="18" r="2" />
            <line x1="15" y1="9" x2="16.5" y2="7.5" />
            <line x1="9" y1="9" x2="7.5" y2="7.5" />
            <line x1="15" y1="15" x2="16.5" y2="16.5" />
            <line x1="9" y1="15" x2="7.5" y2="16.5" />
          </svg>
          <h2>版本控制</h2>
        </div>
        <button class="vc-close-btn" on:click={handleClose}>✕</button>
      </div>

      <div class="vc-tabs">
        <button class="vc-tab" class:active={activeTab === 'versions'} on:click={() => activeTab = 'versions'}>
          历史版本
        </button>
        <button class="vc-tab" class:active={activeTab === 'branches'} on:click={() => activeTab = 'branches'}>
          分支
        </button>
        <button class="vc-tab" class:active={activeTab === 'diff'} on:click={() => activeTab = 'diff'}>
          对比
        </button>
      </div>

      <div class="vc-toolbar">
        {#if activeTab === 'versions'}
          <div class="vc-toolbar-left">
            <select class="vc-select" bind:value={filterBranchId}>
              <option value="">全部分支</option>
              {#each state.branches as branch}
                <option value={branch.id}>{branch.name}</option>
              {/each}
            </select>
            <label class="vc-checkbox-label">
              <input type="checkbox" bind:checked={showMilestoneOnly} />
              <span>仅里程碑</span>
            </label>
            <input
              type="text"
              class="vc-search"
              placeholder="搜索版本..."
              bind:value={searchQuery}
            />
          </div>
          <div class="vc-toolbar-right">
            <label class="vc-btn vc-btn-secondary">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              导入
              <input type="file" accept=".json" style="display:none" on:change={handleImportVersion} />
            </label>
            <button class="vc-btn vc-btn-secondary" on:click={() => { showCreateBranchModal = true; newBranchBaseVersionId = null }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="6" cy="3" r="2" />
                <circle cx="6" cy="15" r="2" />
                <circle cx="18" cy="9" r="2" />
                <path d="M18 7a6 6 0 0 0-6-6 2 2 0 0 0-2 2" />
              </svg>
              新分支
            </button>
            <button class="vc-btn vc-btn-primary" on:click={() => showSaveVersionModal = true}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              保存版本
            </button>
          </div>
        {:else if activeTab === 'branches'}
          <div class="vc-toolbar-left">
            <div class="vc-view-toggle">
              <button
                class={branchViewMode === 'tree' ? 'active' : ''}
                on:click={() => branchViewMode = 'tree'}
              >
                🌳 树状图
              </button>
              <button
                class={branchViewMode === 'list' ? 'active' : ''}
                on:click={() => branchViewMode = 'list'}
              >
                📋 列表
              </button>
            </div>
          </div>
          <div class="vc-toolbar-right">
            <button class="vc-btn vc-btn-primary" on:click={() => showCreateBranchModal = true}>+ 新建分支</button>
          </div>
        {:else if activeTab === 'diff'}
          <div class="vc-toolbar-left">
            <span class="vc-selection-info">
              已选择 {state.selectedVersionIds.length}/2 个版本
            </span>
            {#if canDiff}
              <button class="vc-btn vc-btn-primary" on:click={handleStartDiff}>开始对比</button>
            {/if}
            {#if state.selectedVersionIds.length > 0}
              <button class="vc-btn vc-btn-secondary" on:click={() => versionStore.clearVersionSelection()}>清除选择</button>
            {/if}
          </div>
        {/if}
      </div>

      <div class="vc-content">
        {#if activeTab === 'versions'}
          {#if filteredVersions.length === 0}
            <div class="vc-empty">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ccc" stroke-width="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p>暂无历史版本</p>
              <p class="vc-empty-hint">点击「保存版本」手动创建，或等待自动生成快照</p>
            </div>
          {:else}
            <div class="vc-version-list">
              {#each filteredVersions as version, i}
                <div
                  class="vc-version-item"
                  class:selected={state.selectedVersionIds.includes(version.id)}
                  class:milestone={version.isMilestone}
                  on:click={() => {
                    if (activeTab === 'diff') {
                      versionStore.toggleVersionSelection(version.id)
                    }
                  }}
                >
                  <div class="vc-version-left">
                    <div
                      class="vc-version-dot"
                      style="background: {getBranchColor(version.branchId)}"
                    />
                    <div class="vc-version-info">
                      <div class="vc-version-header-row">
                        <span class="vc-version-number">v{version.versionNumber}</span>
                        {#if version.isMilestone}
                          <button
                            class="vc-icon-btn vc-milestone-btn active"
                            title="取消里程碑"
                            on:click|stopPropagation={() => handleToggleMilestone(version.id)}
                          >
                            ★
                          </button>
                        {:else}
                          <button
                            class="vc-icon-btn vc-milestone-btn"
                            title="标记为里程碑"
                            on:click|stopPropagation={() => handleToggleMilestone(version.id)}
                          >
                            ☆
                          </button>
                        {/if}
                        {#if version.snapshotType === 'auto'}
                          <span class="vc-badge vc-badge-auto">自动</span>
                        {:else}
                          <span class="vc-badge vc-badge-manual">手动</span>
                        {/if}
                        <span class="vc-branch-tag" style="background: {getBranchColor(version.branchId)}20; color: {getBranchColor(version.branchId)}">
                          {getBranchName(version.branchId)}
                        </span>
                      </div>
                      <div class="vc-version-summary">{version.summary}</div>
                      {#if version.userDescription}
                        <div class="vc-version-desc">📝 {version.userDescription}</div>
                      {/if}
                      {#if version.tags.length > 0}
                        <div class="vc-version-tags">
                          {#each version.tags as tag}
                            <span class="vc-tag" style="background: {tag.color || '#e8f4ff'}">
                              {tag.name}
                            </span>
                          {/each}
                        </div>
                      {/if}
                      <div class="vc-version-meta">
                        <span>👤 {version.author}</span>
                        <span>🕐 {getRelativeTime(version.timestamp)}</span>
                        <span title={formatTimestampReadable(version.timestamp)}>
                          {formatTimestampReadable(version.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="vc-version-actions">
                    <button
                      class="vc-icon-btn"
                      title="导出此版本"
                      on:click|stopPropagation={() => handleExportVersion(version.id)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                    <button
                      class="vc-icon-btn"
                      title="从此版本创建分支"
                      on:click|stopPropagation={() => {
                        newBranchBaseVersionId = version.id
                        showCreateBranchModal = true
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="6" cy="3" r="2" />
                        <circle cx="6" cy="15" r="2" />
                        <circle cx="18" cy="9" r="2" />
                        <path d="M18 7a6 6 0 0 0-6-6 2 2 0 0 0-2 2" />
                      </svg>
                    </button>
                    <button
                      class="vc-btn vc-btn-sm vc-btn-secondary"
                      title="回滚到此版本"
                      on:click|stopPropagation={() => handleRestoreVersion(version.id)}
                    >
                      回滚
                    </button>
                  </div>
                </div>
              {/each}
            </div>
            {#if state.versions.length >= MAX_LOCAL_VERSIONS}
              <div class="vc-storage-warning">
                ⚠️ 已达本地存储上限（{MAX_LOCAL_VERSIONS} 个版本），旧版本将被自动清理。建议导出里程碑版本。
              </div>
            {/if}
          {/if}
        {:else if activeTab === 'branches'}
          {#if branchViewMode === 'tree'}
            <BranchTree
              branches={state.branches}
              versions={state.versions}
              activeBranchId={state.activeBranchId}
              onSelectVersion={(id) => {
                versionStore.toggleVersionSelection(id)
                activeTab = 'diff'
              }}
              onSelectBranch={(id) => handleSwitchBranch(id)}
            />
          {:else}
            <div class="vc-branch-list">
              {#each state.branches as branch}
                <div
                  class="vc-branch-item"
                  class:active={branch.id === state.activeBranchId}
                >
                  <div class="vc-branch-header">
                    <div class="vc-branch-info">
                      <div
                        class="vc-branch-color-dot"
                        style="background: {branch.color}"
                      />
                      <div class="vc-branch-name-row">
                        <span class="vc-branch-name">{branch.name}</span>
                        {#if branch.isMain}
                          <span class="vc-badge vc-badge-main">主分支</span>
                        {/if}
                        {#if branch.id === state.activeBranchId}
                          <span class="vc-badge vc-badge-active">当前</span>
                        {/if}
                      </div>
                      {#if branch.description}
                        <div class="vc-branch-desc">{branch.description}</div>
                      {/if}
                    </div>
                  </div>

                  <div class="vc-branch-stats">
                    <span>{getVersionsByBranch(state.versions, branch.id).length} 个版本</span>
                    <span>
                      创建于 {formatTimestampReadable(branch.createdAt)}
                    </span>
                  </div>

                  <div class="vc-branch-actions">
                    {#if branch.id !== state.activeBranchId}
                      <button
                        class="vc-btn vc-btn-sm vc-btn-primary"
                        on:click={() => handleSwitchBranch(branch.id)}
                      >
                        切换
                      </button>
                      <div class="vc-merge-section">
                        <select
                          class="vc-select vc-select-sm"
                          bind:value={selectedMergeSourceId}
                        >
                          <option value="">选择源分支...</option>
                          {#each state.branches.filter(b => b.id !== branch.id) as b}
                            <option value={b.id}>{b.name}</option>
                          {/each}
                        </select>
                        {#if selectedMergeSourceId}
                          <button
                            class="vc-btn vc-btn-sm vc-btn-secondary"
                            on:click={() => {
                              versionStore.switchBranch(branch.id)
                              setTimeout(() => handleStartMerge(), 100)
                            }}
                          >
                            合并到当前
                          </button>
                        {/if}
                      </div>
                    {/if}
                    {#if !branch.isMain}
                      <button
                        class="vc-icon-btn vc-icon-danger"
                        title="删除分支"
                        on:click={() => handleDeleteBranch(branch.id)}
                      >
                        🗑
                      </button>
                    {/if}
                  </div>

                  {#if branch.baseVersionId && branch.baseBranchId}
                    <div class="vc-branch-base">
                      基于「{getBranchName(branch.baseBranchId)}」的某版本创建
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'diff'}
          {#if !state.isDiffMode}
            <div class="vc-diff-instructions">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#ccc" stroke-width="1.5">
                <rect x="3" y="3" width="7" height="18" rx="1" />
                <rect x="14" y="3" width="7" height="18" rx="1" />
                <path d="M10 9l3 3-3 3" />
              </svg>
              <p>选择两个版本进行对比</p>
              <ol>
                <li>在左侧列表中点击选择<strong>第 1 个版本</strong></li>
                <li>再点击选择<strong>第 2 个版本</strong></li>
                <li>点击「开始对比」查看差异</li>
              </ol>
            </div>

            <div class="vc-version-list vc-selectable">
              {#each state.versions.sort((a, b) => b.timestamp - a.timestamp) as version}
                <div
                  class="vc-version-item"
                  class:selected={state.selectedVersionIds.includes(version.id)}
                  on:click={() => versionStore.toggleVersionSelection(version.id)}
                >
                  <div class="vc-select-indicator">
                    {#if state.selectedVersionIds.includes(version.id)}
                      {state.selectedVersionIds.indexOf(version.id) + 1}
                    {/if}
                  </div>
                  <div class="vc-version-left">
                    <div
                      class="vc-version-dot"
                      style="background: {getBranchColor(version.branchId)}"
                    />
                    <div class="vc-version-info">
                      <div class="vc-version-header-row">
                        <span class="vc-version-number">v{version.versionNumber}</span>
                        <span class="vc-branch-tag" style="background: {getBranchColor(version.branchId)}20; color: {getBranchColor(version.branchId)}">
                          {getBranchName(version.branchId)}
                        </span>
                      </div>
                      <div class="vc-version-summary">{version.summary}</div>
                      <div class="vc-version-meta">
                        <span>🕐 {formatTimestampReadable(version.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else if state.currentDiff}
            <DiffViewer diff={state.currentDiff} />
          {/if}
        {/if}
      </div>
    </div>
  </div>

  {#if showCreateBranchModal}
    <div class="vc-modal-overlay" on:click={() => showCreateBranchModal = false}>
      <div class="vc-modal" on:click|stopPropagation>
        <h3>创建新分支</h3>
        <div class="vc-form-group">
          <label>分支名称</label>
          <input
            type="text"
            class="vc-input"
            bind:value={newBranchName}
            placeholder="输入分支名称..."
            maxlength="30"
          />
        </div>
        <div class="vc-form-group">
          <label>描述（可选）</label>
          <textarea
            class="vc-textarea"
            bind:value={newBranchDescription}
            placeholder="描述此分支的用途..."
            rows="2"
          />
        </div>
        {#if newBranchBaseVersionId}
          <div class="vc-form-hint">
            将从选中的版本（v{state.versions.find(v => v.id === newBranchBaseVersionId)?.versionNumber}）创建分支
          </div>
        {:else}
          <div class="vc-form-hint">
            将从当前分支的最新版本创建分支
          </div>
        {/if}
        <div class="vc-modal-actions">
          <button class="vc-btn vc-btn-secondary" on:click={() => showCreateBranchModal = false}>取消</button>
          <button
            class="vc-btn vc-btn-primary"
            disabled={!newBranchName.trim()}
            on:click={handleCreateBranch}
          >
            创建分支
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showSaveVersionModal}
    <div class="vc-modal-overlay" on:click={() => showSaveVersionModal = false}>
      <div class="vc-modal" on:click|stopPropagation>
        <h3>保存当前版本</h3>
        <div class="vc-form-group">
          <label>版本描述（可选）</label>
          <textarea
            class="vc-textarea"
            bind:value={saveVersionDescription}
            placeholder="描述此版本的主要变更..."
            rows="3"
          />
        </div>
        <label class="vc-checkbox-label vc-form-group">
          <input type="checkbox" bind:checked={saveVersionIsMilestone} />
          <span>标记为里程碑（防止被自动清理）</span>
        </label>
        <div class="vc-modal-actions">
          <button class="vc-btn vc-btn-secondary" on:click={() => showSaveVersionModal = false}>取消</button>
          <button class="vc-btn vc-btn-primary" on:click={handleSaveVersion}>保存</button>
        </div>
      </div>
    </div>
  {/if}
{/if}


<style>
  .vc-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vc-panel {
    width: 900px;
    max-width: 95vw;
    height: 85vh;
    max-height: 85vh;
    background: white;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .vc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid #e8e8e8;
  }

  .vc-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .vc-header h2 {
    margin: 0;
    font-size: 18px;
    color: #333;
  }

  .vc-close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: #f5f5f5;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    transition: all 0.2s;
  }

  .vc-close-btn:hover {
    background: #e8e8e8;
    color: #333;
  }

  .vc-tabs {
    display: flex;
    padding: 0 24px;
    border-bottom: 1px solid #e8e8e8;
    gap: 0;
  }

  .vc-tab {
    padding: 12px 20px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.2s;
  }

  .vc-tab:hover {
    color: #0065B3;
  }

  .vc-tab.active {
    color: #0065B3;
    border-bottom-color: #0065B3;
    font-weight: 500;
  }

  .vc-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    border-bottom: 1px solid #f0f0f0;
    gap: 12px;
    flex-wrap: wrap;
  }

  .vc-toolbar-left,
  .vc-toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .vc-select {
    padding: 6px 10px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    font-size: 13px;
    background: white;
    outline: none;
    cursor: pointer;
  }

  .vc-select:focus {
    border-color: #0065B3;
  }

  .vc-select-sm {
    padding: 4px 8px;
    font-size: 12px;
  }

  .vc-search {
    padding: 6px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    width: 200px;
  }

  .vc-search:focus {
    border-color: #0065B3;
  }

  .vc-checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #666;
    cursor: pointer;
    user-select: none;
  }

  .vc-checkbox-label input {
    cursor: pointer;
    accent-color: #0065B3;
  }

  .vc-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid #d9d9d9;
    background: white;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    color: #333;
    font-weight: 500;
  }

  .vc-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }

  .vc-btn-sm {
    padding: 4px 10px;
    font-size: 12px;
  }

  .vc-btn-primary {
    background: #0065B3;
    color: white;
    border-color: #0065B3;
  }

  .vc-btn-primary:hover {
    background: #005290;
    border-color: #005290;
    color: white;
  }

  .vc-btn-primary:disabled {
    background: #b8d4e8;
    border-color: #b8d4e8;
    cursor: not-allowed;
  }

  .vc-btn-secondary {
    background: #f5f7fa;
    border-color: #e8e8e8;
  }

  .vc-btn-secondary:hover {
    background: #e8f0ff;
  }

  .vc-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px 24px;
  }

  .vc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: #999;
    text-align: center;
  }

  .vc-empty p {
    margin: 12px 0 4px;
    font-size: 14px;
  }

  .vc-empty-hint {
    font-size: 12px;
    color: #bbb;
  }

  .vc-version-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vc-version-list.vc-selectable .vc-version-item {
    cursor: pointer;
  }

  .vc-version-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 14px 16px;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    transition: all 0.2s;
    position: relative;
  }

  .vc-version-item:hover {
    background: #f0f5ff;
    border-color: #cce0ff;
  }

  .vc-version-item.selected {
    background: #e6f0ff;
    border-color: #0065B3;
    box-shadow: 0 0 0 2px rgba(0, 101, 179, 0.1);
  }

  .vc-version-item.milestone {
    background: linear-gradient(135deg, #fffbe6 0%, #fff8e1 100%);
    border-color: #ffe58f;
  }

  .vc-select-indicator {
    position: absolute;
    left: -8px;
    top: 14px;
    width: 22px;
    height: 22px;
    background: #0065B3;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .vc-version-left {
    display: flex;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .vc-version-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-top: 4px;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px white, 0 0 0 3px currentColor;
    opacity: 0.9;
  }

  .vc-version-info {
    flex: 1;
    min-width: 0;
  }

  .vc-version-header-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .vc-version-number {
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }

  .vc-version-summary {
    color: #555;
    font-size: 13px;
    margin-bottom: 4px;
    line-height: 1.4;
  }

  .vc-version-desc {
    color: #666;
    font-size: 12px;
    padding: 4px 8px;
    background: white;
    border-radius: 4px;
    margin-bottom: 4px;
    border-left: 2px solid #0065B3;
  }

  .vc-version-tags {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .vc-tag {
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    color: #333;
  }

  .vc-version-meta {
    display: flex;
    gap: 16px;
    font-size: 11px;
    color: #999;
    flex-wrap: wrap;
  }

  .vc-version-actions {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-shrink: 0;
  }

  .vc-icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    transition: all 0.2s;
    font-size: 14px;
  }

  .vc-icon-btn:hover {
    background: #e8e8e8;
    color: #333;
  }

  .vc-icon-danger:hover {
    background: #fff1f0;
    color: #ff4d4f;
  }

  .vc-milestone-btn {
    font-size: 16px;
    color: #d4b106;
  }

  .vc-milestone-btn.active {
    color: #faad14;
  }

  .vc-badge {
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }

  .vc-badge-auto {
    background: #f0f5ff;
    color: #666;
  }

  .vc-badge-manual {
    background: #e6f7ff;
    color: #0065B3;
  }

  .vc-badge-main {
    background: #fff7e6;
    color: #d46b08;
  }

  .vc-badge-active {
    background: #f6ffed;
    color: #52c41a;
  }

  .vc-branch-tag {
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }

  .vc-storage-warning {
    margin-top: 16px;
    padding: 12px 16px;
    background: #fff7e6;
    border: 1px solid #ffe58f;
    border-radius: 8px;
    color: #d46b08;
    font-size: 12px;
  }

  .vc-branch-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .vc-branch-item {
    padding: 16px;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .vc-branch-item.active {
    background: #f0f5ff;
    border-color: #0065B3;
  }

  .vc-branch-item:hover {
    background: #f5f7fa;
  }

  .vc-branch-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
  }

  .vc-branch-info {
    display: flex;
    gap: 10px;
  }

  .vc-branch-color-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    margin-top: 3px;
    flex-shrink: 0;
  }

  .vc-branch-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .vc-branch-name {
    font-weight: 600;
    font-size: 15px;
    color: #333;
  }

  .vc-branch-desc {
    color: #666;
    font-size: 13px;
  }

  .vc-branch-stats {
    display: flex;
    gap: 20px;
    padding: 8px 12px;
    background: white;
    border-radius: 6px;
    font-size: 12px;
    color: #888;
    margin-bottom: 10px;
  }

  .vc-branch-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .vc-merge-section {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .vc-branch-base {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #e8e8e8;
    font-size: 12px;
    color: #999;
  }

  .vc-selection-info {
    font-size: 13px;
    color: #666;
  }

  .vc-diff-instructions {
    padding: 40px 20px;
    text-align: center;
    color: #999;
  }

  .vc-diff-instructions ol {
    text-align: left;
    max-width: 320px;
    margin: 20px auto 0;
    color: #666;
    line-height: 1.8;
  }

  .vc-diff-instructions ol strong {
    color: #0065B3;
  }

  .vc-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vc-modal {
    width: 420px;
    max-width: 90vw;
    background: white;
    border-radius: 10px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .vc-modal h3 {
    margin: 0 0 20px;
    font-size: 16px;
    color: #333;
  }

  .vc-form-group {
    margin-bottom: 16px;
  }

  .vc-form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    color: #555;
    font-weight: 500;
  }

  .vc-input,
  .vc-textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
    resize: vertical;
  }

  .vc-input:focus,
  .vc-textarea:focus {
    border-color: #0065B3;
    box-shadow: 0 0 0 2px rgba(0, 101, 179, 0.1);
  }

  .vc-form-hint {
    padding: 10px 12px;
    background: #f5f7fa;
    border-radius: 6px;
    font-size: 12px;
    color: #666;
    margin-bottom: 16px;
  }

  .vc-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }

  .vc-view-toggle {
    display: flex;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    overflow: hidden;
  }

  .vc-view-toggle button {
    padding: 5px 12px;
    border: none;
    background: white;
    cursor: pointer;
    font-size: 12px;
    color: #666;
    transition: all 0.2s;
  }

  .vc-view-toggle button:hover {
    background: #f5f5f5;
  }

  .vc-view-toggle button.active {
    background: #0065B3;
    color: white;
  }
</style>
