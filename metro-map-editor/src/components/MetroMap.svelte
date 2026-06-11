<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    mapStore,
    viewStore,
    selectedStationIdStore,
    toolModeStore,
    isSimulatingStore
  } from '../stores/mapStore'
  import { generateSmoothPath, getPointOnPath } from '../utils/path'
  import type { Station, MetroLine } from '../types'
  import StationNode from './StationNode.svelte'
  import TrainSimulation from './TrainSimulation.svelte'

  let svgContainer: HTMLDivElement
  let svgElement: SVGSVGElement
  let isDragging = false
  let startX = 0
  let startY = 0
  let startOffsetX = 0
  let startOffsetY = 0
  let scale = 1
  let offsetX = 0
  let offsetY = 0
  let toolMode: string = 'select'
  let isSimulating = false
  let mapData: any = null

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

  const unsubscribeMap = mapStore.subscribe(v => {
    mapData = v
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

    if (toolMode === 'select' || toolMode === 'addStation') {
      isDragging = true
      startX = e.clientX
      startY = e.clientY
      startOffsetX = offsetX
      startOffsetY = offsetY
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    viewStore.update(v => ({
      ...v,
      offsetX: startOffsetX + dx,
      offsetY: startOffsetY + dy
    }))
  }

  function handleMouseUp() {
    isDragging = false
  }

  function handleSvgClick(e: MouseEvent) {
    if (isDragging) return
    if (toolMode !== 'addStation') {
      selectedStationIdStore.set(null)
      return
    }

    const rect = svgElement.getBoundingClientRect()
    const x = (e.clientX - rect.left - offsetX) / scale
    const y = (e.clientY - rect.top - offsetY) / scale

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

  onMount(() => {
    svgContainer.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mousemove', handleMouseMove)
  })

  onDestroy(() => {
    unsubscribeView()
    unsubscribeTool()
    unsubscribeSim()
    unsubscribeMap()
    svgContainer?.removeEventListener('wheel', handleWheel)
    window.removeEventListener('mouseup', handleMouseUp)
    window.removeEventListener('mousemove', handleMouseMove)
  })
</script>

<div
  class="metro-map-container"
  bind:this={svgContainer}
  class:dragging={isDragging}
  class:add-mode={toolMode === 'addStation'}
>
  <svg
    bind:this={svgElement}
    class="metro-svg"
    on:mousedown={handleMouseDown}
    on:click={handleSvgClick}
  >
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e8e8e8" stroke-width="0.5" />
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

      {#if mapData}
        {#each mapData.lines as line}
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
              stations={getLineStations(line)}
              color={line.color}
            />
          {/if}
        {/each}

        {#each mapData.stations as station}
          <StationNode {station} />
        {/each}
      {/if}
    </g>
  </svg>

  <div class="zoom-indicator">
    {Math.round(scale * 100)}%
  </div>
</div>

<style>
  .metro-map-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fafafa;
    cursor: grab;
  }

  .metro-map-container.dragging {
    cursor: grabbing;
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
</style>
