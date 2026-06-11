<script lang="ts">
  import { mapStore } from '../stores/mapStore'
  import ExportPanel from './ExportPanel.svelte'

  let mapName = ''

  const unsubscribe = mapStore.subscribe(data => {
    mapName = data.mapName
  })

  function handleNameChange(e: Event) {
    const input = e.target as HTMLInputElement
    mapStore.setMapName(input.value)
  }
</script>

<header class="app-header">
  <div class="header-left">
    <div class="logo">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <rect x="3" y="6" width="18" height="14" rx="3" fill="white" stroke="#0065B3" stroke-width="2" />
        <circle cx="8" cy="13" r="2" fill="#0065B3" />
        <circle cx="16" cy="13" r="2" fill="#0065B3" />
        <rect x="6" y="9" width="12" height="3" rx="1" fill="#0065B3" />
      </svg>
    </div>
    <div class="title-section">
      <h1>地铁线路图绘制工具</h1>
      <input
        type="text"
        class="map-name-input"
        value={mapName}
        on:input={handleNameChange}
        on:blur={handleNameChange}
        maxlength="30"
      />
    </div>
  </div>

  <div class="header-right">
    <ExportPanel />
  </div>
</header>

<style>
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    height: 60px;
    background: white;
    border-bottom: 1px solid #e8e8e8;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .title-section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title-section h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .map-name-input {
    font-size: 12px;
    color: #999;
    border: none;
    background: transparent;
    padding: 2px 4px;
    border-radius: 4px;
    outline: none;
    width: 160px;
    transition: all 0.2s;
  }

  .map-name-input:hover,
  .map-name-input:focus {
    background: #f5f5f5;
    color: #666;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
</style>
