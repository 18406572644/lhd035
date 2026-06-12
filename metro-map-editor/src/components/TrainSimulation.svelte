<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { simulationStore } from '../stores/simulationStore'
  import { mapStore } from '../stores/mapStore'
  import { getTrainPosition, formatTime } from '../utils/simulation'
  import type { LiveTrain, MetroLine, MetroMapData } from '../types'

  export let lineId: string

  let trains: LiveTrain[] = []
  let line: MetroLine | null = null
  let mapData: MetroMapData | null = null
  let isRunning = false
  let currentTime = 0
  let selectedTrainId: string | null = null

  const unsubSim = simulationStore.subscribe(state => {
    trains = state.trains.filter(t => t.config.lineId === lineId)
    isRunning = state.isRunning
    currentTime = state.currentTime
    selectedTrainId = state.selectedTrainId
  })

  const unsubMap = mapStore.subscribe(data => {
    mapData = data
    line = data.lines.find(l => l.id === lineId) || null
  })

  function getPosition(train: LiveTrain) {
    if (!line || !mapData) return { x: 0, y: 0, angle: 0 }
    return getTrainPosition(train, line, mapData)
  }

  function getTrainColor(train: LiveTrain): string {
    if (!line) return '#888'
    if (train.status === 'broken') return '#ff0000'
    if (train.status === 'delayed') return '#ff9500'
    if (train.status === 'stopped') return adjustBrightness(line.color, -30)
    if (train.config.isExpress) return adjustBrightness(line.color, 30)
    return line.color
  }

  function adjustBrightness(color: string, amount: number): string {
    const hex = color.replace('#', '')
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount))
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount))
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount))
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  function handleTrainClick(train: LiveTrain) {
    simulationStore.selectTrain(selectedTrainId === train.id ? null : train.id)
  }

  function getStatusIcon(train: LiveTrain): string {
    switch (train.status) {
      case 'running': return '▶'
      case 'stopped': return '●'
      case 'waiting': return '⏳'
      case 'finished': return '✓'
      case 'delayed': return '⚠'
      case 'broken': return '✕'
      default: return ''
    }
  }

  function getDirectionLabel(train: LiveTrain): string {
    if (!line) return ''
    const stations = line.stationIds
      .map(id => mapData?.stations.find(s => s.id === id)?.name || '')
      .filter(Boolean)
    if (stations.length < 2) return ''
    return train.config.direction === 'up'
      ? `${stations[0]} → ${stations[stations.length - 1]}`
      : `${stations[stations.length - 1]} → ${stations[0]}`
  }

  onMount(() => {
    simulationStore.init()
  })

  onDestroy(() => {
    unsubSim()
    unsubMap()
  })
</script>

{#if line && mapData && trains.length > 0}
  {#each trains as train (train.id)}
    {#if train.status === 'running' || train.status === 'stopped' || train.status === 'delayed' || train.status === 'broken'}
      {#each [getPosition(train)] as pos}
        {#each [selectedTrainId === train.id] as isSelected}
          <g
            transform={`translate(${pos.x}, ${pos.y})`}
            class="train-group"
            class:selected={isSelected}
            on:click|stopPropagation={() => handleTrainClick(train)}
          >
            <g transform={`rotate(${pos.angle})`}>
              <rect
                x="-14"
                y="-6"
                width="28"
                height="12"
                rx="3"
                fill={getTrainColor(train)}
                stroke={isSelected ? '#fff' : '#333'}
                stroke-width={isSelected ? 2 : 1}
                class="train-body"
              />

          <rect
            x="-12"
            y="-4"
            width="24"
            height="4"
            rx="1"
            fill="rgba(255,255,255,0.3)"
          />

          <circle cx="-9" cy="3" r="2" fill="#333" />
          <circle cx="9" cy="3" r="2" fill="#333" />

          {#if train.config.isExpress}
            <text
              x="0"
              y="-8"
              text-anchor="middle"
              font-size="9"
              font-weight="bold"
              fill="#fff"
              stroke="#000"
              stroke-width="0.5"
            >
              快
            </text>
          {/if}

          {#if train.status === 'stopped'}
            <circle
              cx="0"
              cy="0"
              r="18"
              fill="none"
              stroke="#fff"
              stroke-width="2"
              stroke-dasharray="3 3"
              opacity="0.6"
              class="stopped-indicator"
            />
          {/if}

          {#if train.status === 'broken'}
            <g>
              <circle cx="0" cy="0" r="20" fill="rgba(255,0,0,0.2)" />
              <text
                x="0"
                y="4"
                text-anchor="middle"
                font-size="14"
                font-weight="bold"
                fill="#ff0000"
              >
                ✕
              </text>
            </g>
          {/if}

          {#if train.status === 'delayed' && train.delaySeconds > 60}
            <text
              x="0"
              y="-10"
              text-anchor="middle"
              font-size="8"
              font-weight="bold"
              fill="#ff9500"
            >
              +{Math.floor(train.delaySeconds / 60)}m
            </text>
          {/if}
        </g>

        {#if isSelected}
          <g transform="translate(0, -28)">
            <rect
              x="-80"
              y="-18"
              width="160"
              height="32"
              rx="4"
              fill="rgba(0,0,0,0.85)"
            />
            <text
              x="0"
              y="-6"
              text-anchor="middle"
              font-size="10"
              font-weight="bold"
              fill="#fff"
            >
              {train.config.trainNumber} {getStatusIcon(train)}
            </text>
            <text
              x="0"
              y="6"
              text-anchor="middle"
              font-size="8"
              fill="#ccc"
            >
              {getDirectionLabel(train)}
            </text>
          </g>
        {/if}
      </g>
        {/each}
      {/each}
    {/if}
  {/each}
{/if}

<style>
  .train-group {
    cursor: pointer;
    transition: transform 0.1s;
  }

  .train-group:hover {
    filter: brightness(1.2);
  }

  .train-group.selected {
    filter: drop-shadow(0 0 6px rgba(255,255,255,0.8));
  }

  .train-body {
    transition: fill 0.3s;
  }

  .stopped-indicator {
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; r: 18; }
    50% { opacity: 0.3; r: 22; }
  }
</style>
