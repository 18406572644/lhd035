<script lang="ts">
  import { mapStore, selectedLineIdStore, selectedStationIdStore } from '../stores/mapStore'
  import type { MetroLine, Station } from '../types'

  let lines: MetroLine[] = []
  let stations: Station[] = []
  let selectedLineId: string | null = null
  let showAddLine = false
  let newLineName = ''
  let newLineColor = '#0065B3'

  const predefinedColors = [
    '#E4002B',
    '#009944',
    '#0065B3',
    '#F9A800',
    '#9600A8',
    '#FF6600',
    '#00B2A9',
    '#8B4513',
    '#FF69B4',
    '#808080'
  ]

  const unsubscribe = mapStore.subscribe(data => {
    lines = data.lines
    stations = data.stations
  })

  const unsubscribeSelected = selectedLineIdStore.subscribe(id => {
    selectedLineId = id
  })

  function selectLine(lineId: string) {
    selectedLineIdStore.set(lineId)
  }

  function toggleAddLine() {
    showAddLine = !showAddLine
    if (showAddLine) {
      newLineName = ''
      newLineColor = predefinedColors[lines.length % predefinedColors.length]
    }
  }

  function addLine() {
    if (!newLineName.trim()) return
    mapStore.addLine(newLineName.trim(), newLineColor)
    showAddLine = false
    newLineName = ''
  }

  function deleteLine(lineId: string) {
    const line = lines.find(l => l.id === lineId)
    if (line && confirm(`确定要删除线路「${line.name}」吗？`)) {
      mapStore.removeLine(lineId)
      if (selectedLineId === lineId) {
        selectedLineIdStore.set(null)
      }
    }
  }

  function getLineStations(line: MetroLine): Station[] {
    return line.stationIds
      .map(id => stations.find(s => s.id === id))
      .filter((s): s is Station => s !== undefined)
  }

  function handleStationClick(stationId: string) {
    selectedStationIdStore.set(stationId)
  }

  function addStationToLine(lineId: string) {
    const stationName = prompt('请输入新站点名称：')
    if (stationName) {
      const line = lines.find(l => l.id === lineId)
      const lastStation = line ? getLineStations(line).slice(-1)[0] : null
      const x = lastStation ? lastStation.x + 80 : 100
      const y = lastStation ? lastStation.y : 200
      const stationId = mapStore.addStation(stationName, x, y)
      mapStore.addStationToLine(lineId, stationId)
    }
  }
</script>

<div class="line-panel">
  <div class="panel-header">
    <h3>线路管理</h3>
    <button class="add-btn" on:click={toggleAddLine}>
      {showAddLine ? '取消' : '+ 新线路'}
    </button>
  </div>

  {#if showAddLine}
    <div class="add-line-form">
      <input
        type="text"
        bind:value={newLineName}
        placeholder="线路名称"
        maxlength="20"
      />
      <div class="color-picker">
        {#each predefinedColors as color}
          <button
            class="color-dot"
            class:selected={newLineColor === color}
            style="background: {color}"
            on:click={() => newLineColor = color}
          />
        {/each}
      </div>
      <button class="confirm-btn" on:click={addLine} disabled={!newLineName.trim()}>
        创建线路
      </button>
    </div>
  {/if}

  <div class="line-list">
    {#each lines as line}
      <div
        class="line-item"
        class:selected={selectedLineId === line.id}
        on:click={() => selectLine(line.id)}
      >
        <div class="line-header">
          <div class="line-info">
            <span class="line-color" style="background: {line.color}" />
            <span class="line-name">{line.name}</span>
            <span class="station-count">{line.stationIds.length}站</span>
          </div>
          <button
            class="delete-btn"
            on:click|stopPropagation={() => deleteLine(line.id)}
            title="删除线路"
          >
            ×
          </button>
        </div>

        {#if selectedLineId === line.id}
          <div class="station-list">
            {#each getLineStations(line) as station}
              <div
                class="station-item"
                on:click|stopPropagation={() => handleStationClick(station.id)}
              >
                <span class="station-dot" class:transfer={station.isTransfer} />
                <span class="station-name">{station.name}</span>
                {#if station.isTransfer}
                  <span class="transfer-tag">换乘</span>
                {/if}
              </div>
            {/each}
            <button class="add-station-btn" on:click|stopPropagation={() => addStationToLine(line.id)}>
              + 添加站点
            </button>
          </div>
        {/if}
      </div>
    {/each}

    {#if lines.length === 0}
      <div class="empty-tip">暂无线路，点击上方按钮创建</div>
    {/if}
  </div>
</div>

<style>
  .line-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #e8e8e8;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .add-btn {
    padding: 6px 12px;
    border: 1px solid #0065B3;
    background: transparent;
    color: #0065B3;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .add-btn:hover {
    background: #f0f5ff;
  }

  .add-line-form {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .add-line-form input {
    padding: 8px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }

  .add-line-form input:focus {
    border-color: #0065B3;
  }

  .color-picker {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .color-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }

  .color-dot.selected {
    border-color: #333;
    transform: scale(1.1);
  }

  .confirm-btn {
    padding: 8px;
    background: #0065B3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
  }

  .confirm-btn:hover:not(:disabled) {
    background: #005290;
  }

  .confirm-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .line-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .line-item {
    border-radius: 6px;
    margin-bottom: 4px;
    cursor: pointer;
    transition: background 0.2s;
    overflow: hidden;
  }

  .line-item:hover {
    background: #f5f5f5;
  }

  .line-item.selected {
    background: #f0f5ff;
  }

  .line-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
  }

  .line-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .line-color {
    width: 16px;
    height: 16px;
    border-radius: 50%;
  }

  .line-name {
    font-weight: 500;
    font-size: 14px;
    color: #333;
  }

  .station-count {
    font-size: 12px;
    color: #999;
  }

  .delete-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 18px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all 0.2s;
  }

  .line-item:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background: #ffccc7;
    color: #ff4d4f;
  }

  .station-list {
    padding: 0 12px 12px 36px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .station-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
    transition: background 0.2s;
  }

  .station-item:hover {
    background: #e8f0ff;
  }

  .station-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
    border: 2px solid #333;
  }

  .station-dot.transfer {
    width: 10px;
    height: 10px;
    background: #333;
  }

  .station-name {
    flex: 1;
    color: #555;
  }

  .transfer-tag {
    font-size: 11px;
    padding: 1px 6px;
    background: #fff0f6;
    color: #eb2f96;
    border-radius: 10px;
  }

  .add-station-btn {
    margin-top: 4px;
    padding: 6px;
    border: 1px dashed #d9d9d9;
    background: transparent;
    color: #999;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .add-station-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
    background: #f0f5ff;
  }

  .empty-tip {
    text-align: center;
    padding: 40px 20px;
    color: #999;
    font-size: 13px;
  }
</style>
