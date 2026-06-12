<script lang="ts">
  import Header from './components/Header.svelte'
  import MetroMap from './components/MetroMap.svelte'
  import Toolbar from './components/Toolbar.svelte'
  import LinePanel from './components/LinePanel.svelte'
  import StationDetail from './components/StationDetail.svelte'
  import ValidationPanel from './components/ValidationPanel.svelte'
  import SimulationPanel from './components/SimulationPanel.svelte'
  import Scene3D from './components/Scene3D.svelte'
  import ControlPanel3D from './components/ControlPanel3D.svelte'
  import { selectedStationIdStore, isSimulatingStore, mapStore } from './stores/mapStore'
  import { simulationStore } from './stores/simulationStore'
  import type { Scene3DConfig, ViewMode3D, MetroMapData, MetroLine } from './types'
  import { DEFAULT_SCENE_3D_CONFIG } from './types'

  let showSidebar = true
  let showSimPanel = false
  let selectedStationId: string | null = null
  let isSimulating = false
  let viewMode: '2d' | '3d' = '2d'
  let current3DViewMode: ViewMode3D | null = null
  let scene3DConfig: Scene3DConfig = { ...DEFAULT_SCENE_3D_CONFIG }
  let scene3DComponent: Scene3D
  let mapData: MetroMapData | null = null

  const unsubscribeMap = mapStore.subscribe(data => {
    mapData = data
  })

  const unsubscribeStation = selectedStationIdStore.subscribe(id => {
    selectedStationId = id
  })

  const unsubscribeSim = isSimulatingStore.subscribe(v => {
    isSimulating = v
  })

  function toggleSidebar() {
    showSidebar = !showSidebar
  }

  function toggleSimPanel() {
    showSimPanel = !showSimPanel
    if (showSimPanel) {
      simulationStore.init()
    }
  }

  function switchTo2D() {
    viewMode = '2d'
  }

  function switchTo3D() {
    viewMode = '3d'
    setTimeout(() => {
      scene3DComponent?.refreshScene()
    }, 50)
  }

  function handleCameraPreset(mode: ViewMode3D) {
    current3DViewMode = mode
    scene3DComponent?.setCameraPreset(mode)
  }

  function handleLineSelect(lineId: string | null) {
    if (lineId && current3DViewMode === 'firstperson') {
      scene3DComponent?.setFirstPersonLine(lineId)
    }
  }

  function toggleSimulation() {
    isSimulatingStore.update(v => !v)
    if (!isSimulating) {
      showSimPanel = true
      simulationStore.start()
    } else {
      simulationStore.pause()
    }
  }

  $: linesForPanel = mapData?.lines || []
</script>

<div class="app-container">
  <Header />

  <div class="main-content">
    <button class="sidebar-toggle" on:click={toggleSidebar} title={showSidebar ? '隐藏侧边栏' : '显示侧边栏'}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
           style="transform: {showSidebar ? 'rotate(0deg)' : 'rotate(180deg)'}; transition: transform 0.3s;">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>

    <aside class="sidebar" class:collapsed={!showSidebar}>
      <div class="sidebar-content">
        {#if viewMode === '2d'}
          <div class="sidebar-main">
            <LinePanel />
          </div>
          <ValidationPanel />
        {:else}
          <ControlPanel3D
            bind:config={scene3DConfig}
            {isSimulating}
            lines={linesForPanel}
            currentViewMode={current3DViewMode}
            onCameraPreset={handleCameraPreset}
            onToggleSimulation={toggleSimulation}
            onLineSelect={handleLineSelect}
          />
        {/if}
      </div>
    </aside>

    <main class="map-area">
      {#if viewMode === '2d'}
        <MetroMap />
        <Toolbar />
        <StationDetail />
      {:else}
        <Scene3D bind:this={scene3DComponent} config={scene3DConfig} />
      {/if}

      {#if showSimPanel && viewMode === '2d'}
        <SimulationPanel />
      {/if}

      {#if viewMode === '2d'}
        <div class="sim-toggle">
          <button
            class="sim-toggle-btn"
            class:active={showSimPanel}
            on:click={toggleSimPanel}
            title="仿真控制"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            仿真
          </button>
        </div>
      {/if}

      <div class="view-switcher">
        <button
          class="view-btn"
          class:active={viewMode === '2d'}
          on:click={switchTo2D}
          title="2D 编辑模式"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="12" y1="3" x2="12" y2="21" />
          </svg>
          <span>2D</span>
        </button>
        <button
          class="view-btn"
          class:active={viewMode === '3d'}
          on:click={switchTo3D}
          title="3D 可视化模式"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>3D</span>
        </button>
      </div>
    </main>
  </div>
</div>

<style>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    font-family: 'Segoe UI', system-ui, -apple-system, 'Microsoft YaHei', sans-serif;
    color: #333;
    background: #f5f7fa;
  }

  .main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .sidebar-toggle {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 100;
    width: 20px;
    height: 48px;
    border: none;
    background: white;
    color: #999;
    cursor: pointer;
    border-radius: 0 6px 6px 0;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
  }

  .sidebar-toggle:hover {
    color: #0065B3;
    width: 24px;
  }

  .sidebar {
    width: 280px;
    background: white;
    border-right: 1px solid #e8e8e8;
    display: flex;
    flex-direction: column;
    transition: width 0.3s, margin-left 0.3s;
    overflow: hidden;
    flex-shrink: 0;
  }

  .sidebar.collapsed {
    width: 0;
    margin-left: -1px;
  }

  .sidebar-content {
    width: 280px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .sidebar-main {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .map-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .view-switcher {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    z-index: 20;
  }

  .view-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    background: white;
    color: #666;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .view-btn:hover {
    background: #f0f5ff;
    color: #0065B3;
  }

  .view-btn.active {
    background: #0065B3;
    color: white;
  }

  .view-btn.active:hover {
    background: #005290;
  }

  .sim-toggle {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 30;
    display: flex;
    gap: 8px;
  }

  .sim-toggle-btn {
    padding: 8px 16px;
    border: none;
    background: white;
    color: #333;
    cursor: pointer;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sim-toggle-btn:hover {
    background: #f0f5ff;
    color: #0065B3;
  }

  .sim-toggle-btn.active {
    background: #0065B3;
    color: white;
  }

  .sim-toggle-btn.active:hover {
    background: #005290;
  }
</style>
