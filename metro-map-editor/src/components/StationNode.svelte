<script lang="ts">
  import { onDestroy } from 'svelte'
  import { selectedStationIdStore, toolModeStore, mapStore, highlightStationIdStore, validationResultStore, draggingStateStore } from '../stores/mapStore'
  import { simulationStore } from '../stores/simulationStore'
  import type { Station, ValidationSeverity, DraggingState, LiveStation } from '../types'

  export let station: Station

  let isSelected = false
  let isHighlighted = false
  let toolMode: string = 'select'
  let hasIssue = false
  let highestSeverity: ValidationSeverity | null = null
  let draggingState: DraggingState = {
    isDragging: false,
    stationId: null,
    startX: 0,
    startY: 0,
    startStationX: 0,
    startStationY: 0,
    currentX: 0,
    currentY: 0,
    shiftPressed: false
  }
  let liveStation: LiveStation | null = null
  let isSimulating = false
  let waitingPassengers = 0

  const unsubscribeSelected = selectedStationIdStore.subscribe(id => {
    isSelected = id === station.id
  })

  const unsubscribeTool = toolModeStore.subscribe(v => {
    toolMode = v
  })

  const unsubscribeHighlight = highlightStationIdStore.subscribe(id => {
    isHighlighted = id === station.id
  })

  const unsubscribeValidation = validationResultStore.subscribe(result => {
    const stationIssues = result.issues.filter(
      i => i.targetType === 'station' && i.targetId === station.id
    )
    hasIssue = stationIssues.length > 0
    if (hasIssue) {
      const severities = stationIssues.map(i => i.severity)
      if (severities.includes('error')) {
        highestSeverity = 'error'
      } else if (severities.includes('warning')) {
        highestSeverity = 'warning'
      } else {
        highestSeverity = 'info'
      }
    } else {
      highestSeverity = null
    }
  })

  const unsubscribeDragging = draggingStateStore.subscribe(s => {
    draggingState = s
  })

  const unsubscribeSimulation = simulationStore.subscribe(state => {
    isSimulating = state.isRunning
    liveStation = state.stations[station.id] || null
    waitingPassengers = liveStation?.waitingPassengers || 0
  })

  function handleClick(e: Event) {
    e.stopPropagation()
    if (toolMode === 'delete') {
      if (confirm(`确定要删除站点「${station.name}」吗？`)) {
        mapStore.removeStation(station.id)
      }
    } else {
      selectedStationIdStore.set(station.id)
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    if (toolMode !== 'edit' && toolMode !== 'select') return
    e.stopPropagation()
    e.preventDefault()
    selectedStationIdStore.set(station.id)
    draggingStateStore.set({
      isDragging: true,
      stationId: station.id,
      startX: e.clientX,
      startY: e.clientY,
      startStationX: station.x,
      startStationY: station.y,
      currentX: station.x,
      currentY: station.y,
      shiftPressed: e.shiftKey
    })
  }

  $: isThisDragging = draggingState.isDragging && draggingState.stationId === station.id
  $: displayX = isThisDragging ? draggingState.currentX : station.x
  $: displayY = isThisDragging ? draggingState.currentY : station.y

  $: doorOpen = liveStation?.doorOpen || false
  $: doorAnimPhase = liveStation?.doorAnimPhase || 0

  function getDoorGlowOpacity(): number {
    if (!isSimulating || !doorOpen) return 0
    return 0.3 + doorAnimPhase * 0.7
  }

  function getStationFill(): string {
    if (!isSimulating || !doorOpen) return 'white'
    const intensity = Math.floor(doorAnimPhase * 255)
    return `rgb(255, ${255 - intensity * 0.5}, ${255 - intensity})`
  }

  onDestroy(() => {
    unsubscribeSelected()
    unsubscribeTool()
    unsubscribeHighlight()
    unsubscribeValidation()
    unsubscribeDragging()
    unsubscribeSimulation()
  })
</script>

<g
  class="station-node"
  class:selected={isSelected}
  class:highlighted={isHighlighted}
  class:dragging={isThisDragging}
  class:transfer={station.isTransfer}
  class:has-issue={hasIssue}
  class:issue-error={highestSeverity === 'error'}
  class:issue-warning={highestSeverity === 'warning'}
  class:issue-info={highestSeverity === 'info'}
  class:door-open={doorOpen && isSimulating}
  transform={`translate(${displayX}, ${displayY})`}
  on:click={handleClick}
  on:mousedown={handleMouseDown}
>
  {#if isSimulating && doorOpen}
    <circle
      class="door-glow"
      r={station.isTransfer ? 16 : 12}
      fill="#4CAF50"
      opacity={getDoorGlowOpacity()}
    />
  {/if}

  {#if station.isTransfer}
    <circle r="10" fill={getStationFill()} stroke="#333" stroke-width="2" />
    <circle r="5" fill={doorOpen && isSimulating ? '#4CAF50' : '#333'} />
  {:else}
    <circle r="6" fill={getStationFill()} stroke="#333" stroke-width="2" />
  {/if}

  <text
    class="station-name"
    x="14"
    y="4"
    text-anchor="start"
    font-size="12"
    fill="#333"
  >
    {station.name}
  </text>

  {#if isSelected}
    <circle r="14" fill="none" stroke="#0065B3" stroke-width="2" stroke-dasharray="4 2" class="selected-ring" />
  {/if}

  {#if isHighlighted}
    <circle r="18" fill="none" stroke="#ff9800" stroke-width="3" class="highlight-ring" />
    <circle r="22" fill="none" stroke="#ff9800" stroke-width="2" opacity="0.4" class="highlight-ring-outer" />
  {/if}

  {#if hasIssue}
    <g class="issue-indicator">
      <circle r="8" class="issue-bg" />
      <text class="issue-icon" text-anchor="middle" dominant-baseline="central">!</text>
    </g>
  {/if}

  {#if isSimulating && waitingPassengers > 0}
    <g class="passenger-indicator" transform="translate(0, -14)">
      <rect
        x="-10"
        y="-8"
        width="20"
        height="12"
        rx="3"
        fill="rgba(0, 101, 179, 0.9)"
      />
      <text
        text-anchor="middle"
        dominant-baseline="central"
        y="-1"
        font-size="9"
        font-weight="bold"
        fill="white"
      >
        {waitingPassengers}
      </text>
    </g>
  {/if}
</g>

<style>
  .station-node {
    cursor: pointer;
  }

  .station-node.dragging {
    cursor: grabbing;
    opacity: 0.85;
  }

  .station-node.dragging circle {
    filter: drop-shadow(0 2px 8px rgba(0, 101, 179, 0.6));
  }

  .station-node:hover circle {
    filter: drop-shadow(0 0 4px rgba(0, 101, 179, 0.5));
  }

  .station-name {
    font-family: 'Segoe UI', system-ui, 'Microsoft YaHei', sans-serif;
    font-weight: 500;
    user-select: none;
    pointer-events: none;
  }

  .selected-ring {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .highlight-ring {
    animation: highlight-flash 0.5s ease-in-out 3;
  }

  .highlight-ring-outer {
    animation: highlight-expand 0.5s ease-in-out 3;
  }

  @keyframes highlight-flash {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  @keyframes highlight-expand {
    0%, 100% {
      opacity: 0.4;
      r: 22;
    }
    50% {
      opacity: 0;
      r: 28;
    }
  }

  .issue-indicator {
    transform: translate(10px, -10px);
  }

  .issue-bg {
    fill: #ff4d4f;
  }

  .issue-icon {
    fill: white;
    font-size: 10px;
    font-weight: bold;
    font-family: Arial, sans-serif;
  }

  .station-node.issue-warning .issue-bg {
    fill: #faad14;
  }

  .station-node.issue-info .issue-bg {
    fill: #1890ff;
  }

  .station-node.has-issue circle:first-of-type {
    stroke: #ff4d4f;
    stroke-width: 3;
  }

  .station-node.issue-warning circle:first-of-type {
    stroke: #faad14;
  }

  .station-node.issue-info circle:first-of-type {
    stroke: #1890ff;
  }

  .station-node.has-issue .issue-indicator {
    animation: issue-bounce 1s ease-in-out infinite;
  }

  @keyframes issue-bounce {
    0%, 100% {
      transform: translate(10px, -10px) scale(1);
    }
    50% {
      transform: translate(10px, -10px) scale(1.2);
    }
  }

  .door-glow {
    animation: door-pulse 0.5s ease-in-out infinite alternate;
  }

  @keyframes door-pulse {
    from { opacity: 0.3; }
    to { opacity: 0.8; }
  }

  .station-node.door-open circle:nth-of-type(2),
  .station-node.door-open circle:first-of-type {
    animation: door-flash 0.6s ease-in-out infinite alternate;
  }

  @keyframes door-flash {
    from { filter: brightness(1); }
    to { filter: brightness(1.4); }
  }

  .passenger-indicator {
    pointer-events: none;
    animation: passenger-bounce 2s ease-in-out infinite;
  }

  @keyframes passenger-bounce {
    0%, 100% { transform: translate(0, -14px); }
    50% { transform: translate(0, -16px); }
  }
</style>
