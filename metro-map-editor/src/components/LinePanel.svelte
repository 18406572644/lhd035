<script lang="ts">
  import { mapStore, selectedLineIdStore, selectedStationIdStore } from '../stores/mapStore'
  import type { MetroLine, Station } from '../types'

  let lines: MetroLine[] = []
  let stations: Station[] = []
  let selectedLineId: string | null = null
  let showAddLine = false
  let newLineName = ''
  let newLineColor = '#0065B3'

  let dragStationId: string | null = null
  let dragOverIndex: number = -1
  let dragLineId: string | null = null

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

  function handleDragStart(e: DragEvent, stationId: string, lineId: string) {
    dragStationId = stationId
    dragLineId = lineId
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', stationId)
    }
    const target = e.currentTarget as HTMLElement
    target.classList.add('dragging')
  }

  function handleDragEnd(e: DragEvent) {
    dragStationId = null
    dragOverIndex = -1
    dragLineId = null
    const target = e.currentTarget as HTMLElement
    target.classList.remove('dragging')
  }

  function handleDragOver(e: DragEvent, index: number, lineId: string) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    if (dragLineId === lineId) {
      dragOverIndex = index
    }
  }

  function handleDragLeave() {
    dragOverIndex = -1
  }

  function handleDrop(e: DragEvent, targetIndex: number, lineId: string) {
    e.preventDefault()
    if (!dragStationId || dragLineId !== lineId) return

    const line = lines.find(l => l.id === lineId)
    if (!line) return

    const currentIndex = line.stationIds.indexOf(dragStationId)
    if (currentIndex === -1 || currentIndex === targetIndex) {
      dragStationId = null
      dragOverIndex = -1
      dragLineId = null
      return
    }

    const newStationIds = [...line.stationIds]
    newStationIds.splice(currentIndex, 1)
    const adjustedIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex
    newStationIds.splice(adjustedIndex, 0, dragStationId)

    mapStore.reorderStationsInLine(lineId, newStationIds)

    dragStationId = null
    dragOverIndex = -1
    dragLineId = null
  }

  function moveStationToStart(lineId: string, stationId: string) {
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const idx = line.stationIds.indexOf(stationId)
    if (idx <= 0) return
    const newIds = [...line.stationIds]
    newIds.splice(idx, 1)
    newIds.unshift(stationId)
    mapStore.reorderStationsInLine(lineId, newIds)
  }

  function moveStationToEnd(lineId: string, stationId: string) {
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const idx = line.stationIds.indexOf(stationId)
    if (idx === -1 || idx === line.stationIds.length - 1) return
    const newIds = [...line.stationIds]
    newIds.splice(idx, 1)
    newIds.push(stationId)
    mapStore.reorderStationsInLine(lineId, newIds)
  }

  function moveStationUp(lineId: string, stationId: string) {
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const idx = line.stationIds.indexOf(stationId)
    if (idx <= 0) return
    const newIds = [...line.stationIds]
    const temp = newIds[idx - 1]
    newIds[idx - 1] = newIds[idx]
    newIds[idx] = temp
    mapStore.reorderStationsInLine(lineId, newIds)
  }

  function moveStationDown(lineId: string, stationId: string) {
    const line = lines.find(l => l.id === lineId)
    if (!line) return
    const idx = line.stationIds.indexOf(stationId)
    if (idx === -1 || idx >= line.stationIds.length - 1) return
    const newIds = [...line.stationIds]
    const temp = newIds[idx]
    newIds[idx] = newIds[idx + 1]
    newIds[idx + 1] = temp
    mapStore.reorderStationsInLine(lineId, newIds)
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
            {#each getLineStations(line) as station, index}
              <div
                class="drag-insert-indicator"
                class:visible={dragOverIndex === index && dragStationId !== station.id}
                on:dragover|preventDefault={() => {}}
              />
              <div
                class="station-item"
                class:dragging={dragStationId === station.id}
                class:hover-active={true}
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, station.id, line.id)}
                on:dragend={handleDragEnd}
                on:dragover={(e) => handleDragOver(e, index, line.id)}
                on:dragleave={handleDragLeave}
                on:drop={(e) => handleDrop(e, index, line.id)}
                on:click|stopPropagation={() => handleStationClick(station.id)}
              >
                <div class="station-drag-handle" title="拖拽排序">
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="#bbb">
                    <circle cx="4" cy="3" r="1.5" />
                    <circle cx="12" cy="3" r="1.5" />
                    <circle cx="4" cy="8" r="1.5" />
                    <circle cx="12" cy="8" r="1.5" />
                    <circle cx="4" cy="13" r="1.5" />
                    <circle cx="12" cy="13" r="1.5" />
                  </svg>
                </div>
                <span class="station-dot" class:transfer={station.isTransfer} />
                <span class="station-name">{station.name}</span>
                {#if station.isTransfer}
                  <span class="transfer-tag">换乘</span>
                {/if}
                <div class="station-order-btns">
                  <button
                    class="order-btn"
                    on:click|stopPropagation={() => moveStationToStart(line.id, station.id)}
                    title="移到起点"
                    disabled={index === 0}
                  >
                    ⇤
                  </button>
                  <button
                    class="order-btn"
                    on:click|stopPropagation={() => moveStationUp(line.id, station.id)}
                    title="上移"
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    class="order-btn"
                    on:click|stopPropagation={() => moveStationDown(line.id, station.id)}
                    title="下移"
                    disabled={index === getLineStations(line).length - 1}
                  >
                    ↓
                  </button>
                  <button
                    class="order-btn"
                    on:click|stopPropagation={() => moveStationToEnd(line.id, station.id)}
                    title="移到终点"
                    disabled={index === getLineStations(line).length - 1}
                  >
                    ⇥
                  </button>
                </div>
              </div>
            {/each}
            {#if getLineStations(line).length > 0 && dragOverIndex === getLineStations(line).length}
              <div class="drag-insert-indicator visible" />
            {/if}
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
    padding: 0 12px 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .drag-insert-indicator {
    height: 0;
    border-top: 2px solid transparent;
    transition: all 0.15s;
    border-radius: 1px;
  }

  .drag-insert-indicator.visible {
    border-top-color: #0065B3;
    margin: 2px 0;
  }

  .station-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 13px;
    transition: background 0.2s, box-shadow 0.2s, opacity 0.2s;
    cursor: grab;
    position: relative;
  }

  .station-item:hover {
    background: #e8f0ff;
  }

  .station-item.dragging {
    opacity: 0.4;
    cursor: grabbing;
    background: #e8f0ff;
    box-shadow: 0 2px 8px rgba(0, 101, 179, 0.15);
  }

  .station-drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    padding: 2px;
    opacity: 0;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }

  .station-item:hover .station-drag-handle {
    opacity: 1;
  }

  .station-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
    border: 2px solid #333;
    flex-shrink: 0;
  }

  .station-dot.transfer {
    width: 10px;
    height: 10px;
    background: #333;
  }

  .station-name {
    flex: 1;
    color: #555;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .transfer-tag {
    font-size: 11px;
    padding: 1px 6px;
    background: #fff0f6;
    color: #eb2f96;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .station-order-btns {
    display: flex;
    gap: 1px;
    opacity: 0;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }

  .station-item:hover .station-order-btns {
    opacity: 1;
  }

  .order-btn {
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: #999;
    cursor: pointer;
    font-size: 11px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.15s;
  }

  .order-btn:hover:not(:disabled) {
    background: #0065B3;
    color: white;
  }

  .order-btn:disabled {
    cursor: not-allowed;
    opacity: 0.3;
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
