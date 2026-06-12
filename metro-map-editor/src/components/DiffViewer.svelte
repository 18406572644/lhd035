<script lang="ts">
  import type {
    MapDiff,
    StationDiff,
    LineDiff,
    PropertyDiff,
    LineStationOrderChange,
    ChangeType
  } from '../types'
  import { formatPropertyValue, getPropertyDisplayName } from '../utils/diff'
  import { versionStore } from '../stores/versionStore'

  export let diff: MapDiff

  let expandedSections: Record<string, boolean> = {
    mapName: true,
    stations: true,
    lines: true
  }
  let expandedStations: Record<string, boolean> = {}
  let expandedLines: Record<string, boolean> = {}
  let viewMode: 'split' | 'unified' = 'split'

  function toggleSection(section: string) {
    expandedSections[section] = !expandedSections[section]
    expandedSections = { ...expandedSections }
  }

  function toggleStation(stationId: string) {
    expandedStations[stationId] = !expandedStations[stationId]
    expandedStations = { ...expandedStations }
  }

  function toggleLine(lineId: string) {
    expandedLines[lineId] = !expandedLines[lineId]
    expandedLines = { ...expandedLines }
  }

  function getChangeTypeLabel(type: ChangeType): string {
    const labels: Record<ChangeType, string> = {
      added: '新增',
      removed: '删除',
      modified: '修改',
      unchanged: '未变'
    }
    return labels[type]
  }

  function getChangeTypeClass(type: ChangeType): string {
    const classes: Record<ChangeType, string> = {
      added: 'diff-added',
      removed: 'diff-removed',
      modified: 'diff-modified',
      unchanged: ''
    }
    return classes[type]
  }

  function handleExitDiff() {
    versionStore.exitDiffMode()
  }

  function isStationMoved(stationId: string, changes: LineStationOrderChange[]): boolean {
    return changes.some(c => c.stationId === stationId)
  }
</script>

<div class="diff-viewer">
  <div class="diff-header">
    <div class="diff-summary">
      <div class="diff-stats">
        <div class="diff-stat diff-stat-added">
          <span class="stat-label">新增</span>
          <span class="stat-value">
            {diff.summary.addedStations + diff.summary.addedLines}
          </span>
        </div>
        <div class="diff-stat diff-stat-removed">
          <span class="stat-label">删除</span>
          <span class="stat-value">
            {diff.summary.removedStations + diff.summary.removedLines}
          </span>
        </div>
        <div class="diff-stat diff-stat-modified">
          <span class="stat-label">修改</span>
          <span class="stat-value">
            {diff.summary.modifiedStations + diff.summary.modifiedLines + (diff.mapName ? 1 : 0)}
          </span>
        </div>
      </div>
      <div class="diff-header-actions">
        <div class="diff-view-mode-toggle">
          <button
            class={viewMode === 'split' ? 'active' : ''}
            on:click={() => viewMode = 'split'}
          >
            分屏
          </button>
          <button
            class={viewMode === 'unified' ? 'active' : ''}
            on:click={() => viewMode = 'unified'}
          >
            统一
          </button>
        </div>
        <button class="vc-btn vc-btn-secondary vc-btn-sm" on:click={handleExitDiff}>
          退出对比
        </button>
      </div>
    </div>
    <div class="diff-legend">
      <span class="legend-item legend-added">新增</span>
      <span class="legend-item legend-removed">删除</span>
      <span class="legend-item legend-modified">修改</span>
    </div>
  </div>

  <div class="diff-content">
    {#if diff.mapName}
      <div class="diff-section">
        <div class="diff-section-header" on:click={() => toggleSection('mapName')}>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            style="transform: {expandedSections.mapName ? 'rotate(90deg)' : ''}; transition: transform 0.2s;"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span class="section-title">📝 地图属性</span>
          <span class="section-count">(1 处变更)</span>
        </div>
        {#if expandedSections.mapName}
          <div class="diff-section-body">
            <div class="property-diff-row diff-modified">
              <div class="property-name">
                {getPropertyDisplayName(diff.mapName.property)}
              </div>
              <div class="property-values">
                {#if viewMode === 'split'}
                  <div class="value-old">
                    <span class="value-label">旧值</span>
                    <span class="value-content">{formatPropertyValue(diff.mapName.oldValue, diff.mapName.property)}</span>
                  </div>
                  <div class="value-arrow">→</div>
                  <div class="value-new">
                    <span class="value-label">新值</span>
                    <span class="value-content">{formatPropertyValue(diff.mapName.newValue, diff.mapName.property)}</span>
                  </div>
                {:else}
                  <div class="value-changed">
                    {formatPropertyValue(diff.mapName.oldValue, diff.mapName.property)}
                    <span class="arrow">→</span>
                    {formatPropertyValue(diff.mapName.newValue, diff.mapName.property)}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if diff.stationDiffs.length > 0}
      <div class="diff-section">
        <div class="diff-section-header" on:click={() => toggleSection('stations')}>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            style="transform: {expandedSections.stations ? 'rotate(90deg)' : ''}; transition: transform 0.2s;"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span class="section-title">🚇 站点变更</span>
          <span class="section-count">
            ({diff.stationDiffs.length} 个站点
            {#if diff.summary.addedStations > 0}
              ，<span class="text-added">+{diff.summary.addedStations}</span>
            {/if}
            {#if diff.summary.removedStations > 0}
              ，<span class="text-removed">-{diff.summary.removedStations}</span>
            {/if}
            {#if diff.summary.modifiedStations > 0}
              ，<span class="text-modified">~{diff.summary.modifiedStations}</span>
            {/if}
            )
          </span>
        </div>

        {#if expandedSections.stations}
          <div class="diff-section-body">
            {#each diff.stationDiffs as stationDiff}
              <div class="diff-item {getChangeTypeClass(stationDiff.changeType)}">
                <div
                  class="diff-item-header"
                  on:click={() => toggleStation(stationDiff.stationId)}
                >
                  <div class="item-change-type">
                    {#if stationDiff.changeType === 'added'}
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    {:else if stationDiff.changeType === 'removed'}
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    {:else}
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3l4 4-4 4" />
                        <path d="M3 17l4 4 4-4" />
                        <path d="M21 7H7" />
                        <path d="M3 17h14" />
                      </svg>
                    {/if}
                  </div>
                  <div class="item-main">
                    <span class="item-name">{stationDiff.stationName}</span>
                    <span class="item-id">{stationDiff.stationId}</span>
                  </div>
                  <div class="item-badge">{getChangeTypeLabel(stationDiff.changeType)}</div>
                  {#if stationDiff.propertyDiffs.length > 0}
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="#999"
                      stroke-width="2"
                      class="expand-arrow"
                      style="transform: {expandedStations[stationDiff.stationId] ? 'rotate(90deg)' : ''}; transition: transform 0.2s;"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  {/if}
                </div>

                {#if stationDiff.propertyDiffs.length > 0 && expandedStations[stationDiff.stationId]}
                  <div class="diff-item-body">
                    {#each stationDiff.propertyDiffs as prop}
                      <div class="property-diff-row {getChangeTypeClass(prop.changeType)}">
                        <div class="property-name">
                          {getPropertyDisplayName(prop.property)}
                        </div>
                        <div class="property-values">
                          {#if viewMode === 'split'}
                            <div class="value-old">
                              <span class="value-label">旧</span>
                              <span class="value-content">
                                {formatPropertyValue(prop.oldValue, prop.property)}
                              </span>
                            </div>
                            <div class="value-arrow">→</div>
                            <div class="value-new">
                              <span class="value-label">新</span>
                              <span class="value-content">
                                {formatPropertyValue(prop.newValue, prop.property)}
                              </span>
                            </div>
                          {:else}
                            <div class="value-changed">
                              {formatPropertyValue(prop.oldValue, prop.property)}
                              <span class="arrow">→</span>
                              {formatPropertyValue(prop.newValue, prop.property)}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if diff.lineDiffs.length > 0}
      <div class="diff-section">
        <div class="diff-section-header" on:click={() => toggleSection('lines')}>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            style="transform: {expandedSections.lines ? 'rotate(90deg)' : ''}; transition: transform 0.2s;"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span class="section-title">🎨 线路变更</span>
          <span class="section-count">
            ({diff.lineDiffs.length} 条线路
            {#if diff.summary.addedLines > 0}
              ，<span class="text-added">+{diff.summary.addedLines}</span>
            {/if}
            {#if diff.summary.removedLines > 0}
              ，<span class="text-removed">-{diff.summary.removedLines}</span>
            {/if}
            {#if diff.summary.modifiedLines > 0}
              ，<span class="text-modified">~{diff.summary.modifiedLines}</span>
            {/if}
            )
          </span>
        </div>

        {#if expandedSections.lines}
          <div class="diff-section-body">
            {#each diff.lineDiffs as lineDiff}
              <div class="diff-item {getChangeTypeClass(lineDiff.changeType)}">
                <div
                  class="diff-item-header"
                  on:click={() => toggleLine(lineDiff.lineId)}
                >
                  <div class="item-change-type">
                    {#if lineDiff.changeType === 'added'}
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    {:else if lineDiff.changeType === 'removed'}
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    {:else}
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3l4 4-4 4" />
                        <path d="M3 17l4 4 4-4" />
                        <path d="M21 7H7" />
                        <path d="M3 17h14" />
                      </svg>
                    {/if}
                  </div>
                  <div class="item-main">
                    <span class="line-color-dot" style="background: {lineDiff.newLine?.color || lineDiff.oldLine?.color}" />
                    <span class="item-name">{lineDiff.lineName}</span>
                    <span class="item-id">{lineDiff.lineId}</span>
                  </div>
                  <div class="item-badge">{getChangeTypeLabel(lineDiff.changeType)}</div>
                  {#if lineDiff.propertyDiffs.length > 0 || lineDiff.stationOrderChanges.length > 0}
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="#999"
                      stroke-width="2"
                      class="expand-arrow"
                      style="transform: {expandedLines[lineDiff.lineId] ? 'rotate(90deg)' : ''}; transition: transform 0.2s;"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  {/if}
                </div>

                {#if (lineDiff.propertyDiffs.length > 0 || lineDiff.stationOrderChanges.length > 0) && expandedLines[lineDiff.lineId]}
                  <div class="diff-item-body">
                    {#each lineDiff.propertyDiffs as prop}
                      <div class="property-diff-row {getChangeTypeClass(prop.changeType)}">
                        <div class="property-name">
                          {getPropertyDisplayName(prop.property)}
                        </div>
                        <div class="property-values">
                          {#if viewMode === 'split'}
                            <div class="value-old">
                              <span class="value-label">旧</span>
                              <span class="value-content">
                                {formatPropertyValue(prop.oldValue, prop.property)}
                              </span>
                            </div>
                            <div class="value-arrow">→</div>
                            <div class="value-new">
                              <span class="value-label">新</span>
                              <span class="value-content">
                                {formatPropertyValue(prop.newValue, prop.property)}
                              </span>
                            </div>
                          {:else}
                            <div class="value-changed">
                              {formatPropertyValue(prop.oldValue, prop.property)}
                              <span class="arrow">→</span>
                              {formatPropertyValue(prop.newValue, prop.property)}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/each}

                    {#if lineDiff.stationOrderChanges.length > 0}
                      <div class="station-order-diff">
                        <div class="section-subtitle">站点顺序变化</div>
                        <div class="station-order-changes">
                          {#each lineDiff.stationOrderChanges as change}
                            <div class="order-change-item order-{change.action}">
                              {#if change.action === 'added'}
                                <span class="order-icon order-added-icon">+</span>
                                <span class="order-station">{change.stationId}</span>
                                <span class="order-position">插入位置 {change.newIndex}</span>
                              {:else if change.action === 'removed'}
                                <span class="order-icon order-removed-icon">−</span>
                                <span class="order-station">{change.stationId}</span>
                                <span class="order-position">原位置 {change.oldIndex}</span>
                              {:else}
                                <span class="order-icon order-moved-icon">↔</span>
                                <span class="order-station">{change.stationId}</span>
                                <span class="order-position">{change.oldIndex} → {change.newIndex}</span>
                              {/if}
                            </div>
                          {/each}
                        </div>

                        {#if viewMode === 'split' && lineDiff.oldLine && lineDiff.newLine}
                          <div class="station-order-split-view">
                            <div class="order-col-old">
                              <div class="order-col-title">原顺序</div>
                              {#each lineDiff.oldLine.stationIds as stationId, i}
                                <div
                                  class="order-station-item"
                                  class:order-moved={isStationMoved(stationId, lineDiff.stationOrderChanges)}
                                >
                                  <span class="order-index">{i + 1}</span>
                                  <span class="order-name">{stationId}</span>
                                </div>
                              {/each}
                            </div>
                            <div class="order-col-new">
                              <div class="order-col-title">新顺序</div>
                              {#each lineDiff.newLine.stationIds as stationId, i}
                                <div
                                  class="order-station-item"
                                  class:order-moved={isStationMoved(stationId, lineDiff.stationOrderChanges)}
                                >
                                  <span class="order-index">{i + 1}</span>
                                  <span class="order-name">{stationId}</span>
                                </div>
                              {/each}
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if diff.stationDiffs.length === 0 && diff.lineDiffs.length === 0 && !diff.mapName}
      <div class="diff-empty">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#999" stroke-width="1.5">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        <p>两个版本内容完全一致</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .diff-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .diff-header {
    padding: 0 0 16px;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 16px;
  }

  .diff-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .diff-stats {
    display: flex;
    gap: 16px;
  }

  .diff-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 16px;
    border-radius: 8px;
    min-width: 70px;
  }

  .diff-stat-added {
    background: #f6ffed;
    border: 1px solid #b7eb8f;
  }

  .diff-stat-added .stat-value {
    color: #52c41a;
  }

  .diff-stat-removed {
    background: #fff1f0;
    border: 1px solid #ffa39e;
  }

  .diff-stat-removed .stat-value {
    color: #ff4d4f;
  }

  .diff-stat-modified {
    background: #fffbe6;
    border: 1px solid #ffe58f;
  }

  .diff-stat-modified .stat-value {
    color: #faad14;
  }

  .stat-label {
    font-size: 11px;
    color: #666;
    margin-bottom: 2px;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 700;
  }

  .diff-header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .diff-view-mode-toggle {
    display: flex;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    overflow: hidden;
  }

  .diff-view-mode-toggle button {
    padding: 4px 12px;
    border: none;
    background: white;
    cursor: pointer;
    font-size: 12px;
    color: #666;
    transition: all 0.2s;
  }

  .diff-view-mode-toggle button.active {
    background: #0065B3;
    color: white;
  }

  .diff-legend {
    display: flex;
    gap: 12px;
    font-size: 12px;
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 4px;
  }

  .legend-added {
    background: #f6ffed;
    color: #52c41a;
    border: 1px solid #b7eb8f;
  }

  .legend-removed {
    background: #fff1f0;
    color: #ff4d4f;
    border: 1px solid #ffa39e;
  }

  .legend-modified {
    background: #fffbe6;
    color: #faad14;
    border: 1px solid #ffe58f;
  }

  .diff-content {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }

  .diff-section {
    margin-bottom: 16px;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    overflow: hidden;
  }

  .diff-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #fafafa;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }

  .diff-section-header:hover {
    background: #f5f5f5;
  }

  .section-title {
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }

  .section-count {
    color: #999;
    font-size: 12px;
    margin-left: 4px;
  }

  .text-added {
    color: #52c41a;
    font-weight: 600;
  }

  .text-removed {
    color: #ff4d4f;
    font-weight: 600;
  }

  .text-modified {
    color: #faad14;
    font-weight: 600;
  }

  .diff-section-body {
    padding: 8px;
  }

  .diff-item {
    border: 1px solid transparent;
    border-radius: 6px;
    margin-bottom: 6px;
    overflow: hidden;
  }

  .diff-item.diff-added {
    background: #f6ffed;
    border-color: #d9f7be;
  }

  .diff-item.diff-removed {
    background: #fff1f0;
    border-color: #ffccc7;
  }

  .diff-item.diff-modified {
    background: #fffbe6;
    border-color: #fff1b8;
  }

  .diff-item-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    cursor: pointer;
    user-select: none;
  }

  .item-change-type {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: white;
  }

  .diff-added .item-change-type {
    background: #52c41a;
  }

  .diff-removed .item-change-type {
    background: #ff4d4f;
  }

  .diff-modified .item-change-type {
    background: #faad14;
  }

  .item-main {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .line-color-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .item-name {
    font-weight: 500;
    color: #333;
    font-size: 13px;
  }

  .item-id {
    font-size: 11px;
    color: #999;
    font-family: monospace;
  }

  .item-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
  }

  .diff-added .item-badge {
    background: #b7eb8f;
    color: #237804;
  }

  .diff-removed .item-badge {
    background: #ffa39e;
    color: #a8071a;
  }

  .diff-modified .item-badge {
    background: #ffe58f;
    color: #ad6800;
  }

  .expand-arrow {
    flex-shrink: 0;
  }

  .diff-item-body {
    padding: 4px 12px 12px 44px;
    border-top: 1px dashed rgba(0, 0, 0, 0.08);
  }

  .property-diff-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 10px;
    margin-bottom: 4px;
    background: white;
    border-radius: 4px;
    border: 1px solid #f0f0f0;
  }

  .property-diff-row.diff-added {
    background: #f6ffed;
    border-color: #d9f7be;
  }

  .property-diff-row.diff-removed {
    background: #fff1f0;
    border-color: #ffccc7;
  }

  .property-diff-row.diff-modified {
    background: #fffbe6;
    border-color: #fff1b8;
  }

  .property-name {
    width: 100px;
    flex-shrink: 0;
    font-size: 12px;
    color: #666;
    font-weight: 500;
    padding-top: 2px;
  }

  .property-values {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .value-old,
  .value-new {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 120px;
  }

  .value-label {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    color: #999;
    background: #f5f5f5;
  }

  .value-old .value-label {
    background: #fff1f0;
    color: #ff4d4f;
  }

  .value-new .value-label {
    background: #f6ffed;
    color: #52c41a;
  }

  .value-content {
    font-size: 12px;
    color: #333;
    font-family: monospace;
    word-break: break-all;
  }

  .value-arrow {
    color: #999;
    font-weight: 600;
  }

  .value-changed {
    font-size: 12px;
    color: #333;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .value-changed .arrow {
    color: #0065B3;
    font-weight: 600;
  }

  .station-order-diff {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed #e8e8e8;
  }

  .section-subtitle {
    font-size: 12px;
    color: #666;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .station-order-changes {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .order-change-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
  }

  .order-change-item.order-added {
    background: #f6ffed;
    color: #237804;
  }

  .order-change-item.order-removed {
    background: #fff1f0;
    color: #a8071a;
  }

  .order-change-item.order-moved {
    background: #fffbe6;
    color: #ad6800;
  }

  .order-icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: white;
    font-weight: 700;
    font-size: 11px;
  }

  .order-added-icon {
    background: #52c41a;
  }

  .order-removed-icon {
    background: #ff4d4f;
  }

  .order-moved-icon {
    background: #faad14;
  }

  .order-station {
    font-family: monospace;
    font-weight: 500;
  }

  .order-position {
    color: #999;
    margin-left: auto;
  }

  .station-order-split-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .order-col-old,
  .order-col-new {
    background: white;
    border-radius: 6px;
    border: 1px solid #e8e8e8;
    overflow: hidden;
  }

  .order-col-title {
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    background: #f5f5f5;
    border-bottom: 1px solid #e8e8e8;
  }

  .order-col-new .order-col-title {
    background: #f6ffed;
    color: #237804;
  }

  .order-col-old .order-col-title {
    background: #fff1f0;
    color: #a8071a;
  }

  .order-station-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    font-size: 12px;
    border-bottom: 1px solid #f5f5f5;
  }

  .order-station-item:last-child {
    border-bottom: none;
  }

  .order-station-item.order-moved {
    background: #fffbe6;
    font-weight: 500;
  }

  .order-index {
    width: 20px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f0f0;
    border-radius: 3px;
    font-family: monospace;
    font-size: 10px;
    color: #666;
  }

  .order-name {
    font-family: monospace;
  }

  .diff-empty {
    padding: 60px 20px;
    text-align: center;
    color: #999;
  }

  .diff-empty p {
    margin: 12px 0 0;
    font-size: 14px;
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

  .vc-btn-secondary {
    background: #f5f7fa;
    border-color: #e8e8e8;
  }

  .vc-btn-secondary:hover {
    background: #e8f0ff;
  }
</style>
