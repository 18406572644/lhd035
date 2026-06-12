<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    mapStore,
    viewStore,
    selectedStationIdStore,
    toolModeStore,
    isSimulatingStore,
    draggingStateStore,
    alignmentGuidesStore,
    editorConfigStore
  } from '../stores/mapStore'
  import { simulationStore } from '../stores/simulationStore'
  import { generateSmoothPath, getPointOnPath } from '../utils/path'
  import type { Station, MetroLine, EditorConfig, DraggingState, AlignmentGuides, SimulationStats } from '../types'
  import StationNode from './StationNode.svelte'
  import TrainSimulation from './TrainSimulation.svelte'

  let svgContainer: HTMLDivElement
  let svgElement: SVGSVGElement
  let isPanning = false
  let panStartX = 0
  let panStartY = 0
  let panStartOffsetX = 0
  let panStartOffsetY = 0
  let scale = 1
  let offsetX = 0
  let offsetY = 0
  let toolMode: string = 'select'
  let isSimulating = false
  let mapData: any = null
  let editorConfig: EditorConfig
  let draggingState: DraggingState
  let alignmentGuides: AlignmentGuides
  let simStats: SimulationStats | null = null
  let showHeatmap = false

  const unsubscribeView = viewStore.subscribe(v => {
    scale = v.scale
    offsetX = v.offsetX
    offsetY = v.offsetY
  })

  const unsubscribeTool = toolModeStore.subscribe(v => {
    toolMode = v
  })

  const unsubscribeSim = isSimulatingStore.subscribe(v => {
    isSimulating = v
  })

  const unsubscribeSimState = simulationStore.subscribe(state => {
    simStats = state.stats
    if (state.isRunning) {
      isSimulating = true
    }
  })

  const unsubscribeMap = mapStore.subscribe(v => {
    mapData = v
  })

  const unsubscribeEditorConfig = editorConfigStore.subscribe(v => {
    editorConfig = v
  })

  const unsubscribeDragging = draggingStateStore.subscribe(v => {
    draggingState = v
  })

  const unsubscribeGuides = alignmentGuidesStore.subscribe(v => {
    alignmentGuides = v
  })

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.2, Math.min(5, scale * delta))

    const rect = svgContainer.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const newOffsetX = mouseX - (mouseX - offsetX) * (newScale / scale)
    const newOffsetY = mouseY - (mouseY - offsetY) * (newScale / scale)

    viewStore.set({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY })
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    if (draggingState.isDragging) return

    if (toolMode === 'select' || toolMode === 'addStation') {
      isPanning = true
      panStartX = e.clientX
      panStartY = e.clientY
      panStartOffsetX = offsetX
      panStartOffsetY = offsetY
    }
  }

  function screenToMap(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svgElement.getBoundingClientRect()
    const x = (clientX - rect.left - offsetX) / scale
    const y = (clientY - rect.top - offsetY) / scale
    return { x, y }
  }

  function snapToGrid(value: number, gridSize: number): number {
    return Math.round(value / gridSize) * gridSize
  }

  function computeAlignmentGuides(draggingStationId: string, x: number, y: number): AlignmentGuides {
    if (!editorConfig.showAlignmentGuides || !mapData) {
      return { vertical: [], horizontal: [], snapVertical: null, snapHorizontal: null }
    }

    const otherStations = mapData.stations.filter((s: Station) => s.id !== draggingStationId)
    const threshold = editorConfig.alignmentThreshold

    const vertical: number[] = []
    const horizontal: number[] = []
    let snapVertical: number | null = null
    let snapHorizontal: number | null = null
    let minVerticalDist = Infinity
    let minHorizontalDist = Infinity

    for (const station of otherStations) {
      vertical.push(station.x)
      horizontal.push(station.y)

      const vDist = Math.abs(x - station.x)
      if (vDist < threshold && vDist < minVerticalDist) {
        minVerticalDist = vDist
        snapVertical = station.x
      }

      const hDist = Math.abs(y - station.y)
      if (hDist < threshold && hDist < minHorizontalDist) {
        minHorizontalDist = hDist
        snapHorizontal = station.y
      }
    }

    return { vertical, horizontal, snapVertical, snapHorizontal }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanning) {
      const dx = e.clientX - panStartX
      const dy = e.clientY - panStartY

      viewStore.update(v => ({
        ...v,
        offsetX: panStartOffsetX + dx,
        offsetY: panStartOffsetY + dy
      }))
      return
    }

    if (!draggingState.isDragging || !draggingState.stationId) return

    const shiftPressed = e.shiftKey

    const dxScreen = e.clientX - draggingState.startX
    const dyScreen = e.clientY - draggingState.startY
    const dxMap = dxScreen / scale
    const dyMap = dyScreen / scale

    let newX = draggingState.startStationX + dxMap
    let newY = draggingState.startStationY + dyMap

    if (shiftPressed) {
      const dx = Math.abs(newX - draggingState.startStationX)
      const dy = Math.abs(newY - draggingState.startStationY)
      if (dx > dy) {
        newY = draggingState.startStationY
      } else {
        newX = draggingState.startStationX
      }
    }

    const guides = computeAlignmentGuides(draggingState.stationId, newX, newY)

    if (guides.snapVertical !== null) {
      newX = guides.snapVertical
    }
    if (guides.snapHorizontal !== null) {
      newY = guides.snapHorizontal
    }

    if (editorConfig.snapToGrid) {
      newX = snapToGrid(newX, editorConfig.gridSize)
      newY = snapToGrid(newY, editorConfig.gridSize)
    }

    draggingStateStore.update(s => ({
      ...s,
      currentX: newX,
      currentY: newY,
      shiftPressed
    }))

    alignmentGuidesStore.set(guides)
  }

  function handleMouseUp() {
    isPanning = false

    if (draggingState.isDragging && draggingState.stationId) {
      mapStore.updateStation(draggingState.stationId, {
        x: draggingState.currentX,
        y: draggingState.currentY
      })

      draggingStateStore.set({
        isDragging: false,
        stationId: null,
        startX: 0,
        startY: 0,
        startStationX: 0,
        startStationY: 0,
        currentX: 0,
        currentY: 0,
        shiftPressed: false
      })

      alignmentGuidesStore.set({
        vertical: [],
        horizontal: [],
        snapVertical: null,
        snapHorizontal: null
      })
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Shift' && draggingState.isDragging) {
      draggingStateStore.update(s => ({ ...s, shiftPressed: true }))
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') {
      draggingStateStore.update(s => ({ ...s, shiftPressed: false }))
    }
  }

  function handleSvgClick(e: MouseEvent) {
    if (isPanning || draggingState.isDragging) return
    if (toolMode !== 'addStation') {
      selectedStationIdStore.set(null)
      return
    }

    const rect = svgElement.getBoundingClientRect()
    let x = (e.clientX - rect.left - offsetX) / scale
    let y = (e.clientY - rect.top - offsetY) / scale

    if (editorConfig.snapToGrid) {
      x = snapToGrid(x, editorConfig.gridSize)
      y = snapToGrid(y, editorConfig.gridSize)
    }

    const stationName = prompt('请输入站点名称：', '新站点')
    if (stationName) {
      mapStore.addStation(stationName, x, y)
    }
  }

  function getLinePath(line: MetroLine): string {
    if (!mapData) return ''
    const points = line.stationIds
      .map(id => mapData.stations.find((s: Station) => s.id === id))
      .filter(Boolean)
      .map((s: Station) => ({ x: s.x, y: s.y }))

    return generateSmoothPath(points)
  }

  function getLineStations(line: MetroLine): { x: number; y: number }[] {
    if (!mapData) return []
    return line.stationIds
      .map(id => mapData.stations.find((s: Station) => s.id === id))
      .filter(Boolean)
      .map((s: Station) => ({ x: s.x, y: s.y }))
  }

  $: dragCoordX = draggingState.isDragging ? Math.round(draggingState.currentX) : 0
  $: dragCoordY = draggingState.isDragging ? Math.round(draggingState.currentY) : 0
  $: showGuides = draggingState.isDragging && editorConfig?.showAlignmentGuides
  $: gridSize = editorConfig?.gridSize ?? 40

  onMount(() => {
    svgContainer.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
  })

  function getCongestionColor(congestion: number, maxCongestion: number): string {
    if (maxCongestion === 0) return 'rgba(0, 255, 0, 0.3)'
    const ratio = congestion / maxCongestion
    if (ratio < 0.3) return `rgba(0, 255, 0, ${0.3 + ratio * 0.3})`
    if (ratio < 0.6) return `rgba(255, 255, 0, ${0.4 + ratio * 0.3})`
    return `rgba(255, ${Math.floor(255 * (1 - ratio))}, 0, ${0.5 + ratio * 0.3})`
  }

  function toggleHeatmap() {
    showHeatmap = !showHeatmap
  }

  function getLineCongestion(lineId: string): number[] {
    return simStats?.lineCongestion?.[lineId] || []
  }

  function getMaxCongestion(congestion: number[]): number {
    return Math.max(...congestion, 1)
  }

  function getStationById(stationId: string): Station | undefined {
    return mapData?.stations.find((s: Station) => s.id === stationId)
  }

  function getHeatmapStroke(lineId: string, segmentIndex: number): string {
    const congestion = getLineCongestion(lineId)
    const maxCongestion = getMaxCongestion(congestion)
    return getCongestionColor(congestion[segmentIndex] || 0, maxCongestion)
  }

  function shouldShowHeatmap(lineId: string): boolean {
    return showHeatmap && isSimulating && getLineCongestion(lineId).length > 0
  }

  onDestroy(() => {
    unsubscribeView()
    unsubscribeTool()
    unsubscribeSim()
    unsubscribeSimState()
    unsubscribeMap()
    unsubscribeEditorConfig()
    unsubscribeDragging()
    unsubscribeGuides()
    svgContainer?.removeEventListener('wheel', handleWheel)
    window.removeEventListener('mouseup', handleMouseUp)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  })
</script>

<div
  class="metro-map-container"
  bind:this={svgContainer}
  class:dragging={isPanning || draggingState.isDragging}
  class:station-dragging={draggingState.isDragging}
  class:add-mode={toolMode === 'addStation'}
>
  <svg
    bind:this={svgElement}
    class="metro-svg"
    on:mousedown={handleMouseDown}
    on:click={handleSvgClick}
  >
    <defs>
      <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
        <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#e8e8e8" stroke-width="0.5" />
      </pattern>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <g
      transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}
      style="transform-origin: 0 0"
    >
      <rect width="2000" height="2000" fill="url(#grid)" />

      {#if showGuides}
        {#each alignmentGuides.vertical as vx}
          <line
            x1={vx}
            y1={0}
            x2={vx}
            y2={2000}
            stroke="#d0d0d0"
            stroke-width="0.5"
            stroke-dasharray="4 4"
            opacity="0.5"
          />
        {/each}
        {#each alignmentGuides.horizontal as hy}
          <line
            x1={0}
            y1={hy}
            x2={2000}
            y2={hy}
            stroke="#d0d0d0"
            stroke-width="0.5"
            stroke-dasharray="4 4"
            opacity="0.5"
          />
        {/each}

        {#if alignmentGuides.snapVertical !== null}
          <line
            x1={alignmentGuides.snapVertical}
            y1={0}
            x2={alignmentGuides.snapVertical}
            y2={2000}
            stroke="#0065B3"
            stroke-width="2"
            class="guide-line-highlight"
          />
        {/if}
        {#if alignmentGuides.snapHorizontal !== null}
          <line
            x1={0}
            y1={alignmentGuides.snapHorizontal}
            x2={2000}
            y2={alignmentGuides.snapHorizontal}
            stroke="#0065B3"
            stroke-width="2"
            class="guide-line-highlight"
          />
        {/if}
      {/if}

      {#if mapData}
        {#each mapData.lines as line}
          {#if shouldShowHeatmap(line.id)}
            {#each line.stationIds as stationId, i}
              {#if i < line.stationIds.length - 1}
                {#each [getStationById(stationId)] as startStation}
                  {#each [getStationById(line.stationIds[i + 1])] as endStation}
                    {#if startStation && endStation}
                      <line
                        x1={startStation.x}
                        y1={startStation.y}
                        x2={endStation.x}
                        y2={endStation.y}
                        stroke={getHeatmapStroke(line.id, i)}
                        stroke-width="12"
                        stroke-linecap="round"
                        opacity="0.6"
                      />
                    {/if}
                  {/each}
                {/each}
              {/if}
            {/each}
          {/if}

          <path
            d={getLinePath(line)}
            fill="none"
            stroke={line.color}
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="metro-line"
          />
        {/each}

        {#each mapData.lines as line}
          {#if isSimulating}
            <TrainSimulation
              lineId={line.id}
            />
          {/if}
        {/each}

        {#each mapData.stations as station}
          <StationNode
            {station}
          />
        {/each}
      {/if}
    </g>
  </svg>

  <div class="zoom-indicator">
    {Math.round(scale * 100)}%
  </div>

  {#if isSimulating}
    <button
      class="heatmap-toggle"
      class:active={showHeatmap}
      on:click={toggleHeatmap}
    >
      🔥 热力图 {showHeatmap ? '开' : '关'}
    </button>
  {/if}

  {#if draggingState.isDragging}
    <div class="coord-tooltip">
      <span class="coord-label">X:</span>
      <span class="coord-value">{dragCoordX}</span>
      <span class="coord-sep">·</span>
      <span class="coord-label">Y:</span>
      <span class="coord-value">{dragCoordY}</span>
      {#if draggingState.shiftPressed}
        <span class="shift-badge">SHIFT</span>
      {/if}
      {#if editorConfig.snapToGrid}
        <span class="snap-badge">吸附 {gridSize}px</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .metro-map-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fafafa;
    cursor: grab;
    padding-right: 0;
    transition: padding-right 0.3s;
  }

  .metro-map-container.dragging {
    cursor: grabbing;
  }

  .metro-map-container.station-dragging {
    cursor: grabbing;
    user-select: none;
  }

  .metro-map-container.add-mode {
    cursor: crosshair;
  }

  .metro-svg {
    width: 100%;
    height: 100%;
  }

  .metro-line {
    transition: stroke-width 0.2s;
  }

  .metro-line:hover {
    stroke-width: 8;
  }

  .guide-line-highlight {
    animation: guide-pulse 0.6s ease-in-out infinite alternate;
  }

  @keyframes guide-pulse {
    from {
      opacity: 0.6;
    }
    to {
      opacity: 1;
    }
  }

  .zoom-indicator {
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.9);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: #666;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    font-family: 'Segoe UI', system-ui, sans-serif;
  }

  .coord-tooltip {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 101, 179, 0.95);
    color: white;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 12px rgba(0, 101, 179, 0.4);
    z-index: 100;
    pointer-events: none;
    animation: coord-fade-in 0.15s ease;
  }

  @keyframes coord-fade-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .coord-label {
    opacity: 0.7;
    font-weight: 500;
  }

  .coord-value {
    font-family: monospace;
    font-weight: 600;
    min-width: 32px;
    text-align: center;
  }

  .coord-sep {
    opacity: 0.5;
    margin: 0 2px;
  }

  .shift-badge {
    margin-left: 8px;
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .snap-badge {
    margin-left: 6px;
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  .heatmap-toggle {
    position: absolute;
    bottom: 20px;
    right: 100px;
    background: rgba(255, 255, 255, 0.95);
    padding: 8px 14px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    color: #666;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    font-family: 'Segoe UI', system-ui, sans-serif;
    transition: all 0.2s;
  }

  .heatmap-toggle:hover {
    background: #f0f5ff;
    color: #0065B3;
  }

  .heatmap-toggle.active {
    background: #ff6b6b;
    color: white;
  }

  .heatmap-toggle.active:hover {
    background: #ff5252;
  }
</style>
