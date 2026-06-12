<script lang="ts">
  import { mapStore, selectedStationIdStore, viewStore, highlightStationIdStore } from '../stores/mapStore'
  import type { Station, MetroLine } from '../types'
  import ExportPanel from './ExportPanel.svelte'
  import SettingsPanel from './SettingsPanel.svelte'
  import FareSettingsPanel from './FareSettingsPanel.svelte'

  let showSettings = false
  let showFareSettings = false

  let mapName = ''
  let stations: Station[] = []
  let lines: MetroLine[] = []
  let searchQuery = ''
  let showDropdown = false
  let filterLineId: string | null = null
  let filterTransferOnly = false

  const unsubscribe = mapStore.subscribe(data => {
    mapName = data.mapName
    stations = data.stations
    lines = data.lines
  })

  function handleNameChange(e: Event) {
    const input = e.target as HTMLInputElement
    mapStore.setMapName(input.value)
  }

  interface SearchResult {
    station: Station
    matchedLines: MetroLine[]
  }

  $: searchResults = computeSearchResults(searchQuery, stations, lines, filterLineId, filterTransferOnly)

  function computeSearchResults(
    query: string,
    allStations: Station[],
    allLines: MetroLine[],
    lineFilter: string | null,
    transferOnly: boolean
  ): SearchResult[] {
    let filtered = allStations

    if (lineFilter) {
      const line = allLines.find(l => l.id === lineFilter)
      if (line) {
        filtered = filtered.filter(s => line.stationIds.includes(s.id))
      }
    }

    if (transferOnly) {
      filtered = filtered.filter(s => s.isTransfer)
    }

    if (!query.trim()) {
      return filtered.slice(0, 20).map(s => ({
        station: s,
        matchedLines: allLines.filter(l => l.stationIds.includes(s.id))
      }))
    }

    const q = query.trim().toLowerCase()
    const matched = filtered.filter(s => s.name.toLowerCase().includes(q))

    return matched.slice(0, 20).map(s => ({
      station: s,
      matchedLines: allLines.filter(l => l.stationIds.includes(s.id))
    }))
  }

  function handleSearchInput() {
    showDropdown = true
  }

  function handleSearchFocus() {
    showDropdown = true
  }

  function handleSearchBlur() {
    setTimeout(() => {
      showDropdown = false
    }, 200)
  }

  function handleResultClick(station: Station) {
    selectedStationIdStore.set(station.id)
    highlightStationIdStore.set(station.id)
    centerOnStation(station)
    searchQuery = ''
    showDropdown = false

    setTimeout(() => {
      highlightStationIdStore.set(null)
    }, 1500)
  }

  function centerOnStation(station: Station) {
    const container = document.querySelector('.metro-map-container') as HTMLDivElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const currentScale = 1.5
    const newOffsetX = centerX - station.x * currentScale
    const newOffsetY = centerY - station.y * currentScale

    viewStore.set({ scale: currentScale, offsetX: newOffsetX, offsetY: newOffsetY })
  }

  function handleClearFilter() {
    filterLineId = null
    filterTransferOnly = false
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

  <div class="header-center">
    <div class="search-container">
      <div class="search-input-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#999" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          type="text"
          class="search-input"
          placeholder="搜索站点..."
          bind:value={searchQuery}
          on:input={handleSearchInput}
          on:focus={handleSearchFocus}
          on:blur={handleSearchBlur}
        />
        {#if searchQuery || filterLineId || filterTransferOnly}
          <button class="search-clear" on:click={() => { searchQuery = ''; filterLineId = null; filterTransferOnly = false; }}>✕</button>
        {/if}
      </div>

      <div class="search-filters">
        <select class="filter-select" bind:value={filterLineId} on:change={() => showDropdown = true}>
          <option value="">全部线路</option>
          {#each lines as line}
            <option value={line.id}>{line.name}</option>
          {/each}
        </select>
        <label class="filter-checkbox">
          <input type="checkbox" bind:checked={filterTransferOnly} on:change={() => showDropdown = true} />
          <span>换乘站</span>
        </label>
      </div>

      {#if showDropdown && searchResults.length > 0}
        <div class="search-dropdown">
          {#each searchResults as result}
            <div class="search-result-item" on:mousedown|preventDefault={() => handleResultClick(result.station)}>
              <div class="result-station-info">
                <span class="result-station-name">{result.station.name}</span>
                {#if result.station.isTransfer}
                  <span class="result-transfer-badge">换乘</span>
                {/if}
              </div>
              <div class="result-line-tags">
                {#each result.matchedLines as line}
                  <span class="result-line-tag" style="background: {line.color}20; color: {line.color}; border: 1px solid {line.color}40;">
                    <span class="result-line-dot" style="background: {line.color}" />
                    {line.name}
                  </span>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if showDropdown && searchResults.length === 0 && (searchQuery.trim() || filterLineId || filterTransferOnly)}
        <div class="search-dropdown">
          <div class="search-empty">未找到匹配的站点</div>
        </div>
      {/if}
    </div>
  </div>

  <div class="header-right">
    <button class="settings-btn" on:click={() => showFareSettings = true} title="票价配置">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 18V6" />
      </svg>
    </button>
    <button class="settings-btn" on:click={() => showSettings = true} title="设置">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
    <ExportPanel />
  </div>
</header>

<SettingsPanel bind:show={showSettings} />
<FareSettingsPanel bind:show={showFareSettings} />

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

  .header-center {
    flex: 1;
    display: flex;
    justify-content: center;
    max-width: 480px;
    margin: 0 24px;
  }

  .search-container {
    position: relative;
    width: 100%;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    background: #f5f7fa;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 0 12px;
    transition: all 0.2s;
  }

  .search-input-wrapper:focus-within {
    border-color: #0065B3;
    background: white;
    box-shadow: 0 0 0 2px rgba(0, 101, 179, 0.1);
  }

  .search-icon {
    flex-shrink: 0;
    margin-right: 8px;
  }

  .search-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px 0;
    font-size: 14px;
    color: #333;
    outline: none;
    width: 100%;
  }

  .search-input::placeholder {
    color: #aaa;
  }

  .search-clear {
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 12px;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    transition: all 0.2s;
  }

  .search-clear:hover {
    background: #e8e8e8;
    color: #666;
  }

  .search-filters {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }

  .filter-select {
    padding: 3px 8px;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
    background: white;
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .filter-select:focus {
    border-color: #0065B3;
  }

  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #666;
    cursor: pointer;
    user-select: none;
  }

  .filter-checkbox input {
    cursor: pointer;
    accent-color: #0065B3;
  }

  .search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
    margin-top: 4px;
    max-height: 360px;
    overflow-y: auto;
    z-index: 1000;
  }

  .search-result-item {
    padding: 10px 14px;
    cursor: pointer;
    transition: background 0.15s;
    border-bottom: 1px solid #f5f5f5;
  }

  .search-result-item:last-child {
    border-bottom: none;
  }

  .search-result-item:hover {
    background: #f0f5ff;
  }

  .result-station-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .result-station-name {
    font-size: 14px;
    font-weight: 500;
    color: #333;
  }

  .result-transfer-badge {
    font-size: 11px;
    padding: 1px 6px;
    background: #fff0f6;
    color: #eb2f96;
    border-radius: 10px;
  }

  .result-line-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .result-line-tag {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }

  .result-line-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .search-empty {
    padding: 20px;
    text-align: center;
    color: #999;
    font-size: 13px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .settings-btn {
    width: 36px;
    height: 36px;
    border: 1px solid #d9d9d9;
    background: white;
    color: #666;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .settings-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }
</style>
