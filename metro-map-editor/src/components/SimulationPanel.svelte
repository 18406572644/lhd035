<script lang="ts">
  import { simulationStore } from '../stores/simulationStore'
  import { mapStore } from '../stores/mapStore'
  import { formatTime, parseTimetableCSV } from '../utils/simulation'
  import type { SimulationState, DispatchMode, LiveTrain } from '../types'

  let isRunning = false
  let currentTime = 0
  let speed = 1
  let config: any = null
  let stats: any = null
  let selectedTrain: LiveTrain | null = null
  let trains: LiveTrain[] = []
  let brokenTrainIds: string[] = []
  let showSettings = false
  let selectedDispatchMode: DispatchMode = 'fixed_interval'
  let fixedInterval = 300
  let defaultStopDuration = 30
  let transferStopDuration = 45
  let startTime = 6 * 3600
  let endTime = 23 * 3600
  let peakStart = 7 * 3600
  let peakEnd = 9 * 3600
  let peakInterval = 180
  let offpeakInterval = 420

  const unsub = simulationStore.subscribe((state: SimulationState) => {
    isRunning = state.isRunning
    currentTime = state.currentTime
    speed = state.speed
    config = state.config
    stats = state.stats
    trains = state.trains
    brokenTrainIds = state.brokenTrainIds
    selectedTrain = state.selectedTrainId
      ? state.trains.find(t => t.id === state.selectedTrainId) || null
      : null
    selectedDispatchMode = state.config.dispatchMode
    fixedInterval = state.config.fixedInterval
    defaultStopDuration = state.config.defaultStopDuration
    transferStopDuration = state.config.transferStopDuration
    startTime = state.config.startTime
    endTime = state.config.endTime
    peakStart = state.config.peakConfig.peakStart
    peakEnd = state.config.peakConfig.peakEnd
    peakInterval = state.config.peakConfig.peakInterval
    offpeakInterval = state.config.peakConfig.offpeakInterval
  })

  function togglePlay() {
    simulationStore.toggle()
  }

  function setSpeed(newSpeed: number) {
    simulationStore.setSpeed(newSpeed)
  }

  function handleTimeChange(e: Event) {
    const target = e.target as HTMLInputElement
    const time = parseFloat(target.value)
    simulationStore.jumpToTime(time)
  }

  function resetSimulation() {
    simulationStore.reset()
  }

  function applySettings() {
    simulationStore.updateConfig({
      dispatchMode: selectedDispatchMode,
      fixedInterval,
      defaultStopDuration,
      transferStopDuration,
      startTime,
      endTime,
      peakConfig: {
        peakStart,
        peakEnd,
        peakInterval,
        offpeakInterval
      }
    })
    showSettings = false
  }

  function formatTimeLabel(seconds: number): string {
    return formatTime(seconds)
  }

  function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      try {
        const timetables = parseTimetableCSV(content)
        if (timetables.length > 0) {
          simulationStore.updateConfig({
            dispatchMode: 'custom_timetable',
            timetables
          })
          alert(`成功导入 ${timetables.length} 条时刻表`)
        } else {
          alert('未找到有效的时刻表数据')
        }
      } catch (err) {
        alert('导入失败：' + (err as Error).message)
      }
    }
    reader.readAsText(file)
  }

  function breakSelectedTrain() {
    if (selectedTrain) {
      simulationStore.breakTrain(selectedTrain.id, 180)
    }
  }

  function fixSelectedTrain() {
    if (selectedTrain) {
      simulationStore.fixTrain(selectedTrain.id)
    }
  }

  function getDispatchModeLabel(mode: DispatchMode): string {
    const labels: Record<DispatchMode, string> = {
      'fixed_interval': '固定间隔',
      'peak_offpeak': '高峰/平峰',
      'express_local': '快慢车',
      'custom_timetable': '自定义时刻表'
    }
    return labels[mode]
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'waiting': '待发',
      'running': '运行中',
      'stopped': '停靠',
      'finished': '已完成',
      'delayed': '晚点',
      'broken': '故障'
    }
    return labels[status] || status
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'waiting': '#888',
      'running': '#4CAF50',
      'stopped': '#2196F3',
      'finished': '#9E9E9E',
      'delayed': '#FF9800',
      'broken': '#F44336'
    }
    return colors[status] || '#888'
  }

  $: onlineTrains = trains
    .filter(t =>
      t.status === 'running' || t.status === 'stopped' || t.status === 'delayed' || t.status === 'broken'
    )
    .sort((a, b) => {
      if (a.config.lineId !== b.config.lineId) return a.config.lineId.localeCompare(b.config.lineId)
      return a.progress - b.progress
    })

  function selectTrain(train: LiveTrain) {
    simulationStore.selectTrain(selectedTrain?.id === train.id ? null : train.id)
  }
</script>

<div class="simulation-panel">
  <div class="panel-header">
    <h3>仿真控制</h3>
    <button class="settings-btn" on:click={() => showSettings = !showSettings}>
      ⚙ 设置
    </button>
  </div>

  <div class="time-display">
    <span class="time-label">当前时间</span>
    <span class="time-value">{formatTimeLabel(currentTime)}</span>
    <span class="speed-badge">{speed.toFixed(1)}x</span>
  </div>

  <div class="time-slider-container">
    <input
      type="range"
      min={startTime}
      max={endTime}
      value={currentTime}
      step={60}
      class="time-slider"
      on:input={handleTimeChange}
      disabled={isRunning}
    />
    <div class="time-labels">
      <span>{formatTimeLabel(startTime)}</span>
      <span>{formatTimeLabel(endTime)}</span>
    </div>
  </div>

  <div class="control-buttons">
    <button class="ctrl-btn" on:click={togglePlay} class:running={isRunning}>
      {isRunning ? '⏸ 暂停' : '▶ 开始'}
    </button>
    <button class="ctrl-btn" on:click={resetSimulation} disabled={isRunning}>
      ↺ 重置
    </button>
  </div>

  <div class="speed-controls">
    <span class="speed-label">速度：</span>
    {#each [0.5, 1, 2, 5, 10] as s}
      <button
        class="speed-btn"
        class:active={speed === s}
        on:click={() => setSpeed(s)}
      >
        {s}x
      </button>
    {/each}
  </div>

  <div class="stats-summary">
    <div class="stat-item">
      <span class="stat-value">{stats?.onlineTrainCount || 0}</span>
      <span class="stat-label">在线列车</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{((stats?.onTimeRate || 0) * 100).toFixed(1)}%</span>
      <span class="stat-label">准点率</span>
    </div>
    <div class="stat-item">
      <span class="stat-value">{stats?.totalPassengers?.toLocaleString() || 0}</span>
      <span class="stat-label">客流量</span>
    </div>
  </div>

  {#if showSettings}
    <div class="settings-panel">
      <h4>调度设置</h4>

      <div class="setting-group">
        <label>调度模式</label>
        <select bind:value={selectedDispatchMode}>
          <option value="fixed_interval">固定间隔发车</option>
          <option value="peak_offpeak">高峰/平峰时段</option>
          <option value="express_local">快慢车模式</option>
          <option value="custom_timetable">自定义时刻表</option>
        </select>
      </div>

      {#if selectedDispatchMode === 'fixed_interval' || selectedDispatchMode === 'express_local'}
        <div class="setting-group">
          <label>发车间隔（秒）</label>
          <input type="number" bind:value={fixedInterval} min={60} max={3600} />
        </div>
      {/if}

      {#if selectedDispatchMode === 'peak_offpeak'}
        <div class="setting-group">
          <label>高峰开始</label>
          <input type="time" bind:value={peakStart} />
        </div>
        <div class="setting-group">
          <label>高峰结束</label>
          <input type="time" bind:value={peakEnd} />
        </div>
        <div class="setting-group">
          <label>高峰间隔（秒）</label>
          <input type="number" bind:value={peakInterval} min={30} />
        </div>
        <div class="setting-group">
          <label>平峰间隔（秒）</label>
          <input type="number" bind:value={offpeakInterval} min={60} />
        </div>
      {/if}

      <div class="setting-row">
        <div class="setting-group">
          <label>默认停靠（秒）</label>
          <input type="number" bind:value={defaultStopDuration} min={5} max={300} />
        </div>
        <div class="setting-group">
          <label>换乘站停靠（秒）</label>
          <input type="number" bind:value={transferStopDuration} min={10} max={600} />
        </div>
      </div>

      <div class="setting-row">
        <div class="setting-group">
          <label>运营开始</label>
          <input type="time" bind:value={startTime} />
        </div>
        <div class="setting-group">
          <label>运营结束</label>
          <input type="time" bind:value={endTime} />
        </div>
      </div>

      {#if selectedDispatchMode === 'custom_timetable'}
        <div class="setting-group">
          <label>导入 CSV 时刻表</label>
          <input type="file" accept=".csv" on:change={handleFileUpload} />
          <p class="hint">格式：车次,线路,方向,发车时间,站点1,到达,发车,站点2,到达,发车...</p>
        </div>
      {/if}

      <button class="apply-btn" on:click={applySettings}>
        应用设置
      </button>
    </div>
  {/if}

  <div class="train-list-section">
    <h4>在线列车</h4>
    <div class="train-list">
      {#each onlineTrains as train (train.id)}
        <div
          class="train-item"
          class:selected={selectedTrain?.id === train.id}
          on:click={() => selectTrain(train)}
        >
          <div class="train-info">
            <span class="train-number">{train.config.trainNumber}</span>
            <span
              class="train-status"
              style="background-color: {getStatusColor(train.status)}"
            >
              {getStatusLabel(train.status)}
            </span>
          </div>
          <div class="train-detail">
            <span class="train-dir">
              {train.config.direction === 'up' ? '↑ 上行' : '↓ 下行'}
            </span>
            {#if train.config.isExpress}
              <span class="express-badge">快车</span>
            {/if}
            {#if train.delaySeconds > 60}
              <span class="delay-badge">晚点 {Math.floor(train.delaySeconds / 60)}分</span>
            {/if}
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {(train.progress * 100).toFixed(1)}%"
            />
          </div>
        </div>
      {/each}
      {#if onlineTrains.length === 0}
        <p class="empty-train">暂无在线列车</p>
      {/if}
    </div>
  </div>

  {#if selectedTrain}
    <div class="selected-train-panel">
      <h4>
        列车详情 - {selectedTrain.config.trainNumber}
        <span
          class="status-badge"
          style="background-color: {getStatusColor(selectedTrain.status)}"
        >
          {getStatusLabel(selectedTrain.status)}
        </span>
      </h4>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">线路</span>
          <span class="detail-value">
            {#each $mapStore.lines as line}
              {#if line.id === selectedTrain.config.lineId}
                <span
                  class="line-color-dot"
                  style="background: {line.color}"
                />
                {line.name}
              {/if}
            {/each}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">方向</span>
          <span class="detail-value">
            {selectedTrain.config.direction === 'up' ? '上行' : '下行'}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">发车时间</span>
          <span class="detail-value">
            {formatTime(selectedTrain.config.startTime)}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">平均速度</span>
          <span class="detail-value">
            {selectedTrain.config.averageSpeed.toFixed(1)} km/h
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">乘客数</span>
          <span class="detail-value">
            {selectedTrain.passengers} / {selectedTrain.config.capacity}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">满载率</span>
          <span class="detail-value">
            {((selectedTrain.passengers / selectedTrain.config.capacity) * 100).toFixed(1)}%
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">当前速度</span>
          <span class="detail-value">
            {selectedTrain.speed.toFixed(1)} km/h
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">晚点时间</span>
          <span class="detail-value" class:delay={selectedTrain.delaySeconds > 0}>
            {selectedTrain.delaySeconds > 0
              ? `+${Math.floor(selectedTrain.delaySeconds / 60)}分${selectedTrain.delaySeconds % 60}秒`
              : '正点'}
          </span>
        </div>
      </div>

      <div class="action-buttons">
        {#if brokenTrainIds.includes(selectedTrain.id)}
          <button class="action-btn fix-btn" on:click={fixSelectedTrain}>
            🔧 修复列车
          </button>
        {:else}
          <button class="action-btn break-btn" on:click={breakSelectedTrain}>
            ⚠ 模拟故障（+3分钟）
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .simulation-panel {
    width: 320px;
    background: #fff;
    border-left: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    font-family: 'Segoe UI', system-ui, 'Microsoft YaHei', sans-serif;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    background: #f8f9fa;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  .settings-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .settings-btn:hover {
    background: #e8e8e8;
  }

  .time-display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .time-label {
    font-size: 12px;
    opacity: 0.8;
  }

  .time-value {
    font-size: 24px;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    flex: 1;
  }

  .speed-badge {
    background: rgba(255, 255, 255, 0.25);
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .time-slider-container {
    padding: 0 16px 8px;
    background: #f8f9fa;
  }

  .time-slider {
    width: 100%;
    height: 6px;
    cursor: pointer;
  }

  .time-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #888;
    margin-top: 4px;
  }

  .control-buttons {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
  }

  .ctrl-btn {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
    background: #e8e8e8;
    color: #333;
  }

  .ctrl-btn:hover:not(:disabled) {
    background: #ddd;
  }

  .ctrl-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ctrl-btn.running {
    background: #ff9800;
    color: white;
  }

  .ctrl-btn.running:hover {
    background: #f57c00;
  }

  .speed-controls {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    border-bottom: 1px solid #eee;
    flex-wrap: wrap;
  }

  .speed-label {
    font-size: 12px;
    color: #666;
    margin-right: 4px;
  }

  .speed-btn {
    padding: 4px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .speed-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }

  .speed-btn.active {
    background: #0065B3;
    color: white;
    border-color: #0065B3;
  }

  .stats-summary {
    display: flex;
    justify-content: space-around;
    padding: 12px;
    background: #f8f9fa;
    border-bottom: 1px solid #eee;
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 18px;
    font-weight: bold;
    color: #333;
  }

  .stat-label {
    font-size: 11px;
    color: #888;
  }

  .settings-panel {
    padding: 16px;
    border-bottom: 1px solid #eee;
    background: #fafafa;
  }

  .settings-panel h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: #333;
  }

  .setting-group {
    margin-bottom: 10px;
  }

  .setting-group label {
    display: block;
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
  }

  .setting-group select,
  .setting-group input[type="number"],
  .setting-group input[type="time"] {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    box-sizing: border-box;
  }

  .setting-row {
    display: flex;
    gap: 8px;
  }

  .setting-row .setting-group {
    flex: 1;
  }

  .hint {
    font-size: 10px;
    color: #999;
    margin: 4px 0 0 0;
  }

  .apply-btn {
    width: 100%;
    padding: 8px;
    background: #0065B3;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    margin-top: 8px;
  }

  .apply-btn:hover {
    background: #005699;
  }

  .train-list-section {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .train-list-section h4 {
    margin: 0 0 10px 0;
    font-size: 13px;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .train-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .train-item {
    padding: 10px;
    background: #f8f9fa;
    border-radius: 6px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  .train-item:hover {
    background: #eef3f7;
  }

  .train-item.selected {
    border-color: #0065B3;
    background: #e3f0fa;
  }

  .train-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .train-number {
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }

  .train-status {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
  }

  .train-detail {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .train-dir {
    font-size: 11px;
    color: #666;
  }

  .express-badge {
    font-size: 10px;
    padding: 1px 5px;
    background: #ff6b6b;
    color: white;
    border-radius: 3px;
    font-weight: 500;
  }

  .delay-badge {
    font-size: 10px;
    padding: 1px 5px;
    background: #ff9800;
    color: white;
    border-radius: 3px;
    font-weight: 500;
  }

  .progress-bar {
    height: 4px;
    background: #e0e0e0;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50, #8BC34A);
    border-radius: 2px;
    transition: width 0.3s;
  }

  .empty-train {
    text-align: center;
    color: #999;
    font-size: 12px;
    padding: 20px;
  }

  .selected-train-panel {
    padding: 16px;
    border-top: 2px solid #0065B3;
    background: #f0f7fc;
  }

  .selected-train-panel h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #333;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    color: white;
    font-weight: 500;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }

  .detail-item {
    background: white;
    padding: 8px 10px;
    border-radius: 4px;
  }

  .detail-label {
    display: block;
    font-size: 11px;
    color: #888;
    margin-bottom: 2px;
  }

  .detail-value {
    font-size: 13px;
    font-weight: 500;
    color: #333;
  }

  .detail-value.delay {
    color: #ff9800;
    font-weight: 600;
  }

  .line-color-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .break-btn {
    background: #ff9800;
    color: white;
  }

  .break-btn:hover {
    background: #f57c00;
  }

  .fix-btn {
    background: #4CAF50;
    color: white;
  }

  .fix-btn:hover {
    background: #43A047;
  }
</style>
