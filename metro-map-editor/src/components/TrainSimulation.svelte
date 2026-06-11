<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { getPointOnPath } from '../utils/path'

  export let stations: { x: number; y: number }[]
  export let color: string

  let progress1 = 0
  let progress2 = 0.5
  let animationId: number

  function animate() {
    progress1 = (progress1 + 0.002) % 1
    progress2 = (progress2 + 0.002) % 1
    animationId = requestAnimationFrame(animate)
  }

  function getTrainPosition(progress: number) {
    if (stations.length < 2) return { x: 0, y: 0, angle: 0 }
    return getPointOnPath(stations, progress)
  }

  onMount(() => {
    animationId = requestAnimationFrame(animate)
  })

  onDestroy(() => {
    cancelAnimationFrame(animationId)
  })
</script>

{#if stations.length >= 2}
  <g transform={`translate(${getTrainPosition(progress1).x}, ${getTrainPosition(progress1).y})`}>
    <rect
      x="-8"
      y="-4"
      width="16"
      height="8"
      rx="2"
      fill={color}
      stroke="white"
      stroke-width="1.5"
    />
    <circle cx="-5" cy="0" r="2" fill="white" />
    <circle cx="5" cy="0" r="2" fill="white" />
  </g>

  <g transform={`translate(${getTrainPosition(progress2).x}, ${getTrainPosition(progress2).y})`}>
    <rect
      x="-8"
      y="-4"
      width="16"
      height="8"
      rx="2"
      fill={color}
      stroke="white"
      stroke-width="1.5"
    />
    <circle cx="-5" cy="0" r="2" fill="white" />
    <circle cx="5" cy="0" r="2" fill="white" />
  </g>
{/if}
