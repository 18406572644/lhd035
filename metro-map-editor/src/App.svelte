<script lang="ts">
  import Header from './components/Header.svelte'
  import MetroMap from './components/MetroMap.svelte'
  import Toolbar from './components/Toolbar.svelte'
  import LinePanel from './components/LinePanel.svelte'
  import StationDetail from './components/StationDetail.svelte'
  import { selectedStationIdStore } from './stores/mapStore'

  let showSidebar = true
  let selectedStationId: string | null = null

  const unsubscribe = selectedStationIdStore.subscribe(id => {
    selectedStationId = id
  })

  function toggleSidebar() {
    showSidebar = !showSidebar
  }
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
        <LinePanel />
      </div>
    </aside>

    <main class="map-area">
      <MetroMap />
      <Toolbar />
      <StationDetail />
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
  }

  .map-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
</style>
