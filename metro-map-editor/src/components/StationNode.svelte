<script lang="ts">
  import { selectedStationIdStore, toolModeStore, mapStore } from '../stores/mapStore'
  import type { Station } from '../types'

  export let station: Station

  let isSelected = false
  let toolMode: string = 'select'

  const unsubscribeSelected = selectedStationIdStore.subscribe(id => {
    isSelected = id === station.id
  })

  const unsubscribeTool = toolModeStore.subscribe(v => {
    toolMode = v
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
</style>
