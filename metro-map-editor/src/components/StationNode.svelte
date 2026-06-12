<script lang="ts">
  import { selectedStationIdStore, toolModeStore, mapStore, highlightStationIdStore } from '../stores/mapStore'
  import type { Station } from '../types'

  export let station: Station

  let isSelected = false
  let isHighlighted = false
  let toolMode: string = 'select'

  const unsubscribeSelected = selectedStationIdStore.subscribe(id => {
    isSelected = id === station.id
  })

  const unsubscribeTool = toolModeStore.subscribe(v => {
    toolMode = v
  })

  const unsubscribeHighlight = highlightStationIdStore.subscribe(id => {
    isHighlighted = id === station.id
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

  function handleMouseDown(e: Event) {
    if (toolMode !== 'edit') return
    e.stopPropagation()
  }
</script>

<g
  class="station-node"
  class:selected={isSelected}
  class:highlighted={isHighlighted}
  class:transfer={station.isTransfer}
  transform={`translate(${station.x}, ${station.y})`}
  on:click={handleClick}
  on:mousedown={handleMouseDown}
>
  {#if station.isTransfer}
    <circle r="10" fill="white" stroke="#333" stroke-width="2" />
    <circle r="5" fill="#333" />
  {:else}
    <circle r="6" fill="white" stroke="#333" stroke-width="2" />
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
</g>

<style>
  .station-node {
    cursor: pointer;
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
</style>
