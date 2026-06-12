<script lang="ts">
  import type { Version, Branch } from '../types'
  import { formatTimestampReadable } from '../utils/versionManager'

  export let branches: Branch[] = []
  export let versions: Version[] = []
  export let activeBranchId: string = ''
  export let onSelectVersion: (versionId: string) => void = () => {}
  export let onSelectBranch: (branchId: string) => void = () => {}

  let selectedVersionId: string | null = null

  interface TreeLayout {
    branchColumns: Record<string, number>
    maxColumn: number
    nodePositions: Record<string, { x: number; y: number; branchId: string }>
    rowHeight: number
    columnWidth: number
    rows: Array<{
      versionId: string
      version: Version | null
      y: number
      connections: Array<{ fromX: number; fromY: number; toX: number; toY: number; color: string }>
    }>
  }

  let cachedLayout: TreeLayout | null = null
  let cachedVersionIds: string = ''

  $: layout = computeTreeLayoutStable(branches, versions)

  function computeTreeLayoutStable(
    allBranches: Branch[],
    allVersions: Version[]
  ): TreeLayout {
    const versionIds = allVersions.map(v => v.id).sort().join(',')
    const branchIds = allBranches.map(b => b.id).sort().join(',')

    if (cachedLayout && cachedVersionIds === versionIds + '|' + branchIds) {
      return cachedLayout
    }

    const result = computeTreeLayout(allBranches, allVersions)
    cachedLayout = result
    cachedVersionIds = versionIds + '|' + branchIds
    return result
  }

  function computeTreeLayout(
    allBranches: Branch[],
    allVersions: Version[]
  ): TreeLayout {
    const branchColumns: Record<string, number> = {}
    let maxColumn = 0
    const columnWidth = 60
    const rowHeight = 44

    const sortedBranches = [...allBranches].sort((a, b) => {
      if (a.isMain) return -1
      if (b.isMain) return 1
      return a.createdAt - b.createdAt
    })

    sortedBranches.forEach((branch, i) => {
      branchColumns[branch.id] = i
      maxColumn = Math.max(maxColumn, i)
    })

    const allVersionsSorted = [...allVersions].sort((a, b) => a.timestamp - b.timestamp)

    const nodePositions: Record<string, { x: number; y: number; branchId: string }> = {}
    const rows: TreeLayout['rows'] = []

    for (let i = 0; i < allVersionsSorted.length; i++) {
      const version = allVersionsSorted[i]
      const col = branchColumns[version.branchId] ?? 0
      const x = col * columnWidth + columnWidth / 2
      const y = i * rowHeight + rowHeight / 2

      nodePositions[version.id] = { x, y, branchId: version.branchId }

      const connections: TreeLayout['rows'][0]['connections'] = []

      if (version.parentVersionId && nodePositions[version.parentVersionId]) {
        const parent = nodePositions[version.parentVersionId]
        const parentBranch = allBranches.find(b => b.id === parent.branchId)
        connections.push({
          fromX: parent.x,
          fromY: parent.y,
          toX: x,
          toY: y,
          color: parentBranch?.color || '#999'
        })
      }

      rows.push({
        versionId: version.id,
        version,
        y,
        connections
      })
    }

    return {
      branchColumns,
      maxColumn,
      nodePositions,
      rowHeight,
      columnWidth,
      rows
    }
  }

  function getBranchColor(branchId: string): string {
    const branch = branches.find(b => b.id === branchId)
    return branch?.color || '#999'
  }

  function getBranchName(branchId: string): string {
    const branch = branches.find(b => b.id === branchId)
    return branch?.name || branchId
  }

  function handleVersionClick(versionId: string) {
    selectedVersionId = versionId
    onSelectVersion(versionId)
  }

  function handleBranchClick(branchId: string) {
    onSelectBranch(branchId)
  }

  function getVersionNodeClass(version: Version): string {
    const classes = ['version-node']
    if (version.branchId === activeBranchId) classes.push('active-branch')
    if (version.id === selectedVersionId) classes.push('selected')
    return classes.join(' ')
  }
</script>

<div class="branch-tree-container">
  {#if layout.rows.length === 0}
    <div class="tree-empty">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ccc" stroke-width="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
      <p>暂无版本数据</p>
    </div>
  {:else}
    <div class="branch-tree" style="min-height: {layout.rows.length * layout.rowHeight + 80}px;">
      <svg
        class="tree-svg"
        width="100%"
        viewBox="0 0 {(layout.maxColumn + 1) * layout.columnWidth} {layout.rows.length * layout.rowHeight}"
        preserveAspectRatio="xMinYMin meet"
      >
        {#each layout.rows as row (row.versionId)}
          {#each row.connections as conn}
            {#if Math.abs(conn.fromX - conn.toX) < 1}
              <line
                x1={conn.fromX}
                y1={conn.fromY}
                x2={conn.toX}
                y2={conn.toY}
                stroke={conn.color}
                stroke-width="2"
                fill="none"
                opacity="0.7"
              />
            {:else}
              <path
                d="M {conn.fromX} {conn.fromY}
                   C {conn.fromX} {conn.fromY + (conn.toY - conn.fromY) * 0.6},
                     {conn.toX} {conn.toY - (conn.toY - conn.fromY) * 0.4},
                     {conn.toX} {conn.toY}"
                stroke={conn.color}
                stroke-width="2"
                fill="none"
                opacity="0.7"
              />
            {/if}
          {/each}
        {/each}

        {#each layout.rows as row (row.versionId)}
          {#if row.version}
            {@const pos = layout.nodePositions[row.version.id]}
            <g
              transform="translate({pos.x}, {pos.y})"
              class={getVersionNodeClass(row.version)}
              on:click={() => { if (row.version) handleVersionClick(row.version.id) }}
            >
              <circle
                r={row.version.isMilestone ? 11 : 7}
                fill={getBranchColor(row.version.branchId)}
                stroke={row.version.branchId === activeBranchId ? '#fff' : '#f5f5f5'}
                stroke-width={row.version.branchId === activeBranchId ? 3 : 2}
              />
              {#if row.version.isMilestone}
                <text
                  text-anchor="middle"
                  dominant-baseline="central"
                  y="1"
                  fill="#fff"
                  font-size="10"
                  font-weight="bold"
                >★</text>
              {/if}

              <title>
                {`v${row.version.versionNumber} - ${getBranchName(row.version.branchId)}\n${row.version.summary}\n${formatTimestampReadable(row.version.timestamp)}${row.version.isMilestone ? '\n⭐ 里程碑' : ''}`}
              </title>
            </g>
          {/if}
        {/each}
      </svg>

      <div class="version-labels">
        {#each layout.rows as row (row.versionId)}
          {#if row.version}
            {@const pos = layout.nodePositions[row.version.id]}
            <div
              class="version-label"
              class:label-active={row.version.branchId === activeBranchId}
              class:label-selected={row.version.id === selectedVersionId}
              style="top: {pos.y - 14}px; left: {(layout.maxColumn + 1) * layout.columnWidth + 8}px;"
              on:click={() => { if (row.version) handleVersionClick(row.version.id) }}
            >
              <div class="label-header">
                <span
                  class="label-branch-dot"
                  style="background: {getBranchColor(row.version.branchId)}"
                />
                <span class="label-version">v{row.version.versionNumber}</span>
                <span class="label-branch-name">{getBranchName(row.version.branchId)}</span>
                {#if row.version.isMilestone}
                  <span class="label-milestone">⭐</span>
                {/if}
                {#if row.version.snapshotType === 'auto'}
                  <span class="label-auto">自动</span>
                {/if}
              </div>
              <div class="label-summary">{row.version.summary}</div>
              <div class="label-time">{formatTimestampReadable(row.version.timestamp)}</div>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <div class="tree-legend">
      <div class="legend-title">图例</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-circle" style="background: #52c41a; width: 14px; height: 14px;">★</span>
          <span>里程碑版本</span>
        </div>
        <div class="legend-item">
          <span class="legend-circle" style="background: #999;"></span>
          <span>普通版本</span>
        </div>
        <div class="legend-item">
          <span class="legend-border-demo" />
          <span>当前分支</span>
        </div>
      </div>

      <div class="legend-branches">
        <div class="legend-title mt">分支</div>
        {#each branches as branch (branch.id)}
          <div
            class="legend-branch-item"
            class:legend-branch-active={branch.id === activeBranchId}
            on:click={() => handleBranchClick(branch.id)}
          >
            <span class="legend-branch-color" style="background: {branch.color}" />
            <span class="legend-branch-name">{branch.name}</span>
            {#if branch.isMain}
              <span class="legend-badge-main">主</span>
            {/if}
            {#if branch.id === activeBranchId}
              <span class="legend-badge-active">当前</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .branch-tree-container {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    padding: 16px;
    background: #fafafa;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
  }

  .tree-empty {
    width: 100%;
    padding: 40px 20px;
    text-align: center;
    color: #999;
  }

  .tree-empty p {
    margin: 12px 0 0;
    font-size: 13px;
  }

  .branch-tree {
    flex: 1;
    position: relative;
    min-width: 300px;
    overflow: auto;
  }

  .tree-svg {
    display: block;
    min-width: 100%;
  }

  :global(.version-node) {
    cursor: pointer;
  }

  :global(.version-node:hover circle) {
    filter: brightness(1.2);
  }

  :global(.version-node.active-branch circle) {
    filter: drop-shadow(0 0 4px rgba(0, 101, 179, 0.4));
  }

  :global(.version-node.selected circle) {
    stroke: #faad14;
    stroke-width: 3;
    filter: drop-shadow(0 0 6px rgba(250, 173, 20, 0.5));
  }

  .version-labels {
    position: relative;
    width: 280px;
    flex-shrink: 0;
    padding-left: 8px;
  }

  .version-label {
    position: absolute;
    left: 0;
    padding: 6px 10px;
    background: white;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    font-size: 11px;
    width: 260px;
    cursor: pointer;
    z-index: 1;
  }

  .version-label:hover {
    background: #f0f5ff;
    border-color: #0065B3;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 101, 179, 0.15);
  }

  .version-label.label-active {
    border-color: #0065B3;
    background: #e6f0ff;
  }

  .version-label.label-selected {
    border-color: #faad14;
    background: #fffbe6;
    z-index: 5;
    box-shadow: 0 2px 8px rgba(250, 173, 20, 0.2);
  }

  .label-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
    flex-wrap: wrap;
  }

  .label-branch-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .label-version {
    font-weight: 600;
    color: #333;
  }

  .label-branch-name {
    color: #666;
    font-size: 10px;
  }

  .label-milestone {
    font-size: 11px;
  }

  .label-auto {
    padding: 0 4px;
    background: #f5f5f5;
    color: #999;
    border-radius: 3px;
    font-size: 10px;
  }

  .label-summary {
    color: #555;
    line-height: 1.4;
    margin-bottom: 3px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .label-time {
    color: #999;
    font-size: 10px;
  }

  .tree-legend {
    width: 180px;
    flex-shrink: 0;
    padding: 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e8e8e8;
  }

  .legend-title {
    font-size: 12px;
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
  }

  .legend-title.mt {
    margin-top: 14px;
  }

  .legend-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #666;
  }

  .legend-circle {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    color: white;
    flex-shrink: 0;
  }

  .legend-border-demo {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #0065B3;
    border: 2px solid #fff;
    outline: 2px solid #0065B3;
    flex-shrink: 0;
  }

  .legend-branches {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .legend-branch-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
    border-radius: 4px;
    cursor: pointer;
    flex-wrap: wrap;
  }

  .legend-branch-item:hover {
    background: #f5f5f5;
  }

  .legend-branch-item.legend-branch-active {
    background: #e6f0ff;
  }

  .legend-branch-color {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-branch-name {
    font-size: 11px;
    color: #555;
    flex: 1;
  }

  .legend-badge-main {
    font-size: 9px;
    padding: 0 4px;
    background: #fff7e6;
    color: #d46b08;
    border-radius: 2px;
  }

  .legend-badge-active {
    font-size: 9px;
    padding: 0 4px;
    background: #f6ffed;
    color: #52c41a;
    border-radius: 2px;
  }
</style>
