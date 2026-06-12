<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import {
    toolModeStore,
    isSimulatingStore,
    editorConfigStore,
    toggleSnapToGrid,
    setGridSize,
    toggleAlignmentGuides,
    resetView,
    zoomIn,
    zoomOut
  } from '../stores/mapStore'
  import type { ToolMode, EditorConfig } from '../types'

  let currentMode: ToolMode = 'select'
  let isSimulating = false
  let editorConfig: EditorConfig
  let showGridSettings = false

  const unsubscribeTool = toolModeStore.subscribe(v => {
    currentMode = v
  })

  const unsubscribeSim = isSimulatingStore.subscribe(v => {
    isSimulating = v
  })

  const unsubscribeEditor = editorConfigStore.subscribe(v => {
    editorConfig = v
  })

  function setMode(mode: ToolMode) {
    toolModeStore.set(mode)
  }

  function toggleSimulation() {
    isSimulatingStore.update(v => !v)
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  function handlePrint() {
    window.print()
  }

  function onGridSizeChange(e: Event) {
    const target = e.target as HTMLInputElement
    setGridSize(parseInt(target.value) || 40)
  }

  function handleGridSettingsClick(e: MouseEvent) {
    e.stopPropagation()
    showGridSettings = !showGridSettings
  }

  function handleDocumentClick() {
    showGridSettings = false
  }

  onMount(() => {
    document.addEventListener('click', handleDocumentClick)
  })

  onDestroy(() => {
    unsubscribeTool()
    unsubscribeSim()
    unsubscribeEditor()
    document.removeEventListener('click', handleDocumentClick)
  })
</script>

<div class="toolbar">
  <div class="tool-group">
    <button
      class="tool-btn"
      class:active={currentMode === 'select'}
      on:click={() => setMode('select')}
      title="选择/移动画布"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      </svg>
    </button>
    <button
      class="tool-btn"
      class:active={currentMode === 'addStation'}
      on:click={() => setMode('addStation')}
      title="添加站点"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    </button>
    <button
      class="tool-btn"
      class:active={currentMode === 'edit'}
      on:click={() => setMode('edit')}
      title="编辑模式（拖拽站点）"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
    <button
      class="tool-btn"
      class:active={currentMode === 'delete'}
      on:click={() => setMode('delete')}
      title="删除"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  </div>

  <div class="divider" />

  <div class="tool-group">
    <button class="tool-btn" on:click={zoomIn} title="放大">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="11" y1="8" x2="11" y2="14" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    </button>
    <button class="tool-btn" on:click={zoomOut} title="缩小">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    </button>
    <button class="tool-btn" on:click={resetView} title="重置视图">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    </button>
  </div>

  <div class="divider" />

  <div class="tool-group" style="position: relative;">
    <button
      class="tool-btn"
      class:active={editorConfig?.snapToGrid}
      on:click={(e) => { e.stopPropagation(); toggleSnapToGrid() }}
      title="吸附到网格"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    </button>
    <button
      class="tool-btn"
      class:active={editorConfig?.showAlignmentGuides}
      on:click={(e) => { e.stopPropagation(); toggleAlignmentGuides() }}
      title="对齐辅助线"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="4" y1="4" x2="4" y2="20" />
        <line x1="12" y1="2" x2="12" y2="22" stroke-dasharray="2 2" />
        <line x1="20" y1="4" x2="20" y2="20" />
        <line x1="2" y1="12" x2="22" y2="12" stroke-width="1.5" />
      </svg>
    </button>
    <button
      class="tool-btn grid-settings-btn"
      class:active={showGridSettings}
      on:click={handleGridSettingsClick}
      title="网格设置"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>

    {#if showGridSettings}
      <div class="grid-settings-popup" on:click|stopPropagation>
        <div class="popup-header">网格设置</div>
        <div class="popup-item">
          <label class="popup-label">
            <input
              type="checkbox"
              checked={editorConfig?.snapToGrid}
              on:change={toggleSnapToGrid}
            />
            <span>吸附到网格</span>
          </label>
        </div>
        <div class="popup-item">
          <div class="popup-label-row">
            <span class="popup-label">网格大小</span>
            <span class="popup-value">{editorConfig?.gridSize ?? 40}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="200"
            step="5"
            value={editorConfig?.gridSize ?? 40}
            on:input={onGridSizeChange}
            class="grid-size-slider"
          />
          <div class="slider-ticks">
            <span>10</span>
            <span>40</span>
            <span>100</span>
            <span>200</span>
          </div>
        </div>
        <div class="popup-item">
          <label class="popup-label">
            <input
              type="checkbox"
              checked={editorConfig?.showAlignmentGuides}
              on:change={toggleAlignmentGuides}
            />
            <span>显示对齐辅助线</span>
          </label>
        </div>
      </div>
    {/if}
  </div>

  <div class="divider" />

  <div class="tool-group">
    <button
      class="tool-btn sim-btn"
      class:active={isSimulating}
      on:click={toggleSimulation}
      title={isSimulating ? '停止模拟' : '模拟运行'}
    >
      {#if isSimulating}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" />
          <rect x="14" y="4" width="4" height="16" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      {/if}
    </button>
    <button class="tool-btn" on:click={toggleFullscreen} title="全屏">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
    </button>
    <button class="tool-btn" on:click={handlePrint} title="打印">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    </button>
  </div>
</div>

<style>
  .toolbar {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    z-index: 10;
  }

  .tool-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .divider {
    height: 1px;
    background: #e8e8e8;
    margin: 4px 0;
  }

  .tool-btn {
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    transition: all 0.2s;
  }

  .tool-btn:hover {
    background: #f0f5ff;
    color: #0065B3;
  }

  .tool-btn:active {
    background: #e0efff;
  }

  .tool-btn.active {
    background: #0065B3;
    color: white;
  }

  .tool-btn.active:hover {
    background: #005290;
  }

  .sim-btn.active {
    background: #009944;
  }

  .sim-btn.active:hover {
    background: #007a37;
  }

  .grid-settings-btn.active {
    background: #f0f5ff;
    color: #0065B3;
  }

  .grid-settings-popup {
    position: absolute;
    left: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%);
    background: white;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    padding: 14px;
    width: 220px;
    z-index: 100;
    animation: popup-in 0.15s ease;
  }

  @keyframes popup-in {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }

  .popup-header {
    font-size: 14px;
    font-weight: 600;
    color: #333;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
  }

  .popup-item {
    margin-bottom: 12px;
  }

  .popup-item:last-child {
    margin-bottom: 0;
  }

  .popup-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #555;
    cursor: pointer;
    user-select: none;
  }

  .popup-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #0065B3;
    cursor: pointer;
  }

  .popup-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .popup-label-row .popup-label {
    font-size: 13px;
    color: #555;
    cursor: default;
  }

  .popup-value {
    font-size: 13px;
    font-weight: 600;
    color: #0065B3;
    font-family: monospace;
  }

  .grid-size-slider {
    width: 100%;
    accent-color: #0065B3;
    cursor: pointer;
  }

  .slider-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #999;
    margin-top: 2px;
  }
</style>
