<script lang="ts">
  import type { Scene3DConfig, ViewMode3D } from '../types'
  import { DEFAULT_SCENE_3D_CONFIG } from '../types'

  export let config: Scene3DConfig = { ...DEFAULT_SCENE_3D_CONFIG }
  export let isSimulating: boolean = false
  export let onCameraPreset: (mode: ViewMode3D) => void = () => {}
  export let onToggleSimulation: () => void = () => {}

  const viewModes: { mode: ViewMode3D; label: string; icon: string }[] = [
    { mode: 'topdown', label: '俯视图', icon: '⊤' },
    { mode: 'side', label: '侧视图', icon: '⊓' },
    { mode: 'panorama', label: '全景', icon: '◎' },
    { mode: 'firstperson', label: '第一人称', icon: '◉' }
  ]
</script>

<div class="control-panel-3d">
  <div class="panel-section">
    <h3 class="section-title">相机视角</h3>
    <div class="view-mode-grid">
      {#each viewModes as vm}
        <button
          class="view-mode-btn"
          on:click={() => onCameraPreset(vm.mode)}
          title={vm.label}
        >
          <span class="view-icon">{vm.icon}</span>
          <span class="view-label">{vm.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="panel-section">
    <button
      class="sim-btn"
      class:active={isSimulating}
      on:click={onToggleSimulation}
    >
      {#if isSimulating}
        <span class="sim-icon">⏸</span>
        <span>停止模拟</span>
      {:else}
        <span class="sim-icon">▶</span>
        <span>模拟运行</span>
      {/if}
    </button>
  </div>

  <div class="panel-section">
    <h3 class="section-title">显示控制</h3>
    <div class="toggle-list">
      <label class="toggle-item">
        <input type="checkbox" bind:checked={config.showGround} />
        <span>地面</span>
      </label>
      <label class="toggle-item">
        <input type="checkbox" bind:checked={config.showBuildings} />
        <span>建筑剪影</span>
      </label>
      <label class="toggle-item">
        <input type="checkbox" bind:checked={config.showTunnels} />
        <span>隧道</span>
      </label>
      <label class="toggle-item">
        <input type="checkbox" bind:checked={config.showTrains} />
        <span>列车</span>
      </label>
    </div>
  </div>

  <div class="panel-section">
    <h3 class="section-title">列车速度</h3>
    <div class="slider-row">
      <input
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        bind:value={config.trainSpeed}
      />
      <span class="slider-value">{config.trainSpeed.toFixed(1)}x</span>
    </div>
  </div>

  <div class="panel-section">
    <h3 class="section-title">隧道透明度</h3>
    <div class="slider-row">
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.05"
        bind:value={config.tunnelOpacity}
      />
      <span class="slider-value">{config.tunnelOpacity.toFixed(2)}</span>
    </div>
  </div>

  <div class="panel-section">
    <h3 class="section-title">光照</h3>
    <div class="slider-row">
      <span class="slider-label">环境光</span>
      <input
        type="range"
        min="0.1"
        max="2"
        step="0.1"
        bind:value={config.ambientLightIntensity}
      />
    </div>
    <div class="slider-row">
      <span class="slider-label">方向光</span>
      <input
        type="range"
        min="0.1"
        max="2"
        step="0.1"
        bind:value={config.directionalLightIntensity}
      />
    </div>
  </div>

  <div class="panel-section hint-section">
    <h3 class="section-title">操作提示</h3>
    <ul class="hint-list">
      <li>左键拖拽：旋转视角</li>
      <li>右键拖拽：平移</li>
      <li>滚轮：缩放</li>
      <li>拖拽站点：调整深度</li>
    </ul>
  </div>
</div>

<style>
  .control-panel-3d {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    overflow-y: auto;
  }

  .panel-section {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 10px;
  }

  .section-title {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .view-mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .view-mode-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border: 1px solid #e0e0e0;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-mode-btn:hover {
    border-color: #0065B3;
    background: #f0f5ff;
  }

  .view-icon {
    font-size: 18px;
    color: #0065B3;
    line-height: 1;
  }

  .view-label {
    font-size: 11px;
    color: #666;
  }

  .sim-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px;
    border: none;
    background: #009944;
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .sim-btn:hover {
    background: #007a37;
  }

  .sim-btn.active {
    background: #e4002b;
  }

  .sim-btn.active:hover {
    background: #c00024;
  }

  .sim-icon {
    font-size: 14px;
  }

  .toggle-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #333;
    cursor: pointer;
    user-select: none;
  }

  .toggle-item input[type="checkbox"] {
    accent-color: #0065B3;
    cursor: pointer;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .slider-row input[type="range"] {
    flex: 1;
    height: 4px;
    accent-color: #0065B3;
  }

  .slider-value {
    font-size: 12px;
    color: #666;
    min-width: 36px;
    text-align: right;
  }

  .slider-label {
    font-size: 12px;
    color: #666;
    min-width: 48px;
  }

  .hint-section {
    background: #fffbe6;
    border: 1px solid #ffe58f;
  }

  .hint-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: #8c6d00;
    line-height: 1.8;
  }
</style>
