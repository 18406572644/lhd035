<script lang="ts">
  import { simulationStore } from '../stores/simulationStore'
  import { mapStore } from '../stores/mapStore'
  import { formatTime, parseTimetableCSV } from '../utils/simulation'
  import type { SimulationState, DispatchMode, LiveTrain, MetroLine } from '../types'

  let isRunning = false
  let currentTime = 0
  let speed = 1
  let config: any = null
  let stats: any = null
  let selectedTrain: LiveTrain | null = null
  let trains: LiveTrain[] = []
  let brokenTrainIds: string[] = []
  let showSettings = false
  let showAdvancedStats = false
  let showLineIntervals = false
  let showAnomalyPanel = false
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
  let safetyDistance = 0.02
  let anomalyTargetLineId: string = ''
  let anomalyDelayMinutes = 3
  let anomalyTrainsCount = 1
  let showWaitTimeDist = false
  let showCapacityStats = false
  let expressSkipCount = 2
  let csvTemplateContent = ''
  let startTimeStr = '06:00'
  let endTimeStr = '23:00'
  let peakStartStr = '07:00'
  let peakEndStr = '09:00'

  function timeToSeconds(t: string): number {
    if (!t) return 0
    const parts = t.split(':')
    return parseInt(parts[0] || '0') * 3600 + parseInt(parts[1] || '0') * 60
  }

  function secondsToTime(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  $: mapLines = $mapStore.lines || []
  $: totalCapacity = (trains || []).reduce((sum, t) => sum + t.config.capacity, 0)
  $: totalActualPassengers = (trains || []).reduce((sum, t) => sum + t.passengers, 0)
  $: overallLoadFactor = totalCapacity > 0 ? (totalActualPassengers / totalCapacity) * 100 : 0
  $: dailyTrafficEstimate = (stats?.totalPassengers || 0) * 4 + (trains?.length || 0) * 800
  $: lineMap = {}
  $: {
    lineMap = {}
    ;(mapLines || []).forEach(l => lineMap[l.id] = l)
  }
  $: lineTrainCount = {}
  $: {
    lineTrainCount = {}
    ;(onlineTrains || []).forEach(t => {
      lineTrainCount[t.config.lineId] = (lineTrainCount[t.config.lineId] || 0) + 1
    })
  }
  $: avgWaitTimes = {}
  $: {
    avgWaitTimes = {}
    Object.entries(stats?.stationWaitTimes || {}).forEach(([sid, times]) => {
      if (times && (times as number[]).length > 0) {
        avgWaitTimes[sid] = (times as number[]).reduce((a: number, b: number) => a + b, 0) / (times as number[]).length
      }
    })
  }
  $: topWaitTimeStations = Object.entries(avgWaitTimes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

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
    safetyDistance = state.config.safetyDistance
    peakStart = state.config.peakConfig.peakStart
    peakEnd = state.config.peakConfig.peakEnd
    peakInterval = state.config.peakConfig.peakInterval
    offpeakInterval = state.config.peakConfig.offpeakInterval
    startTimeStr = secondsToTime(state.config.startTime)
    endTimeStr = secondsToTime(state.config.endTime)
    peakStartStr = secondsToTime(state.config.peakConfig.peakStart)
    peakEndStr = secondsToTime(state.config.peakConfig.peakEnd)
    if ((mapLines?.length || 0) > 0 && anomalyTargetLineId === '') {
      anomalyTargetLineId = mapLines[0].id
    }
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
      safetyDistance,
      startTime: timeToSeconds(startTimeStr),
      endTime: timeToSeconds(endTimeStr),
      peakConfig: {
        peakStart: timeToSeconds(peakStartStr),
        peakEnd: timeToSeconds(peakEndStr),
        peakInterval,
        offpeakInterval
      },
      expressConfig: selectedDispatchMode === 'express_local' ? {
        skipStationCount: expressSkipCount,
        expressIntervalMultiplier: 2
      } : undefined
    })
    showSettings = false
  }

  function formatTimeLabel(seconds: number): string {
    return formatTime(seconds)
  }

  function formatInterval(seconds: number): string {
    if (!seconds || seconds < 0) return '--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    if (mins > 0) return `${mins}分${secs}秒`
    return `${secs}秒`
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
          alert(`✅ 成功导入 ${timetables.length} 条时刻表`)
        } else {
          alert('⚠ 未找到有效的时刻表数据')
        }
      } catch (err) {
        alert('❌ 导入失败：' + (err as Error).message)
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

  function applyAnomalyToLine() {
    const targets = onlineTrains
      .filter(t => t.config.lineId === anomalyTargetLineId)
      .slice(0, anomalyTrainsCount)
    if (targets.length === 0) {
      alert('该线路当前无在线列车')
      return
    }
    targets.forEach(t => {
      simulationStore.breakTrain(t.id, anomalyDelayMinutes * 60)
    })
    alert(`✅ 已对 ${targets.length} 辆列车模拟故障 +${anomalyDelayMinutes} 分钟`)
  }

  function fixAllAnomalies() {
    if (brokenTrainIds.length === 0) return
    brokenTrainIds.forEach(id => simulationStore.fixTrain(id))
    alert(`✅ 已修复 ${brokenTrainIds.length} 辆故障列车`)
  }

  function downloadCSVTemplate() {
    const template = [
      '车次,线路,方向,发车时间,站点,到达,发车,站点,到达,发车',
      'Y001,line1,up,06:00,站A,06:00,06:00:30,站B,06:02:30,06:03:00,站C,06:05:30,06:06:00',
      'Y002,line1,up,06:05,站A,06:05,06:05:30,站B,06:07:30,06:08:00,站C,06:10:30,06:11:00',
      'X001,line2,down,06:02,站D,06:02,06:02:30,站E,06:04:00,06:04:30,站F,06:07:00,06:07:30'
    ].join('\n')
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '时刻表模板.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function getDispatchModeLabel(mode: DispatchMode): string {
    const labels: Record<DispatchMode, string> = {
      'fixed_interval': '固定间隔发车',
      'peak_offpeak': '高峰/平峰调度',
      'express_local': '快慢车模式',
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

  function getLoadFactorColor(ratio: number): string {
    if (ratio < 0.5) return '#4CAF50'
    if (ratio < 0.8) return '#FFC107'
    if (ratio < 1.0) return '#FF9800'
    return '#F44336'
  }

  $: onlineTrains = (trains || [])
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

  function getLineName(lineId: string): string {
    return lineMap[lineId]?.name || lineId
  }

  function getLineColor(lineId: string): string {
    return lineMap[lineId]?.color || '#888'
  }

  function getLineInterval(lineId: string): number {
    return stats?.lineIntervals?.[lineId] || 0
  }

  function getLineTrainCount(lineId: string): number {
    return lineTrainCount[lineId] || 0
  }

  function getStationName(stationId: string): string {
    const stations = ($mapStore?.stations as any[]) || []
    return stations.find(s => s.id === stationId)?.name || stationId
  }

  function getWaitTimeBarWidth(avgTime: number): number {
    const max = topWaitTimeStations[0]?.[1] || 1
    return Math.min((avgTime / max) * 100, 100)
  }

  function getLineCapacityData(lineId: string) {
    const lineTrains = onlineTrains.filter(t => t.config.lineId === lineId)
    const lineCap = lineTrains.reduce((s, t) => s + t.config.capacity, 0)
    const linePass = lineTrains.reduce((s, t) => s + t.passengers, 0)
    const ratio = lineCap > 0 ? linePass / lineCap : 0
    return { lineTrains, lineCap, linePass, ratio }
  }
</script>

<div class="simulation-panel">
  <div class="panel-header">
    <h3>仿真控制</h3>
    <button class="settings-btn" on:click={() => showSettings = !showSettings}>
      ⚙ 设置
    </button>
  </div>

  <div class="panel-body-scroll">

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

  <div class="quick-actions">
    <button class="qa-btn interval-btn" on:click={() => showLineIntervals = !showLineIntervals}>
      🕒 发车间隔
    </button>
    <button class="qa-btn anomaly-btn" on:click={() => showAnomalyPanel = !showAnomalyPanel} class:active={showAnomalyPanel}>
      ⚠ 故障仿真
    </button>
    <button class="qa-btn stats-btn" on:click={() => showAdvancedStats = !showAdvancedStats} class:active={showAdvancedStats}>
      📊 高级统计
    </button>
  </div>

  {#if brokenTrainIds.length > 0}
    <div class="anomaly-warning">
      <span class="warning-icon">🚨</span>
      <span class="warning-text">{brokenTrainIds.length} 辆列车故障</span>
      <button class="warning-fix" on:click={fixAllAnomalies}>一键修复</button>
    </div>
  {/if}

  {#if showLineIntervals}
    <div class="sub-panel">
      <h4 class="sub-title">🕒 各线路监控</h4>
      <div class="interval-list">
        {#each mapLines as line}
          <div class="interval-item">
            <div class="interval-left">
              <span class="line-dot" style="background: {line.color}" />
              <span class="interval-line-name">{line.name}</span>
            </div>
            <div class="interval-right">
              <span class="train-count-badge">{getLineTrainCount(line.id)}辆</span>
              <span class="interval-value">{formatInterval(getLineInterval(line.id))}</span>
            </div>
          </div>
        {/each}
      </div>
      <div class="safety-info">
        <span class="safety-label">安全追踪间隔:</span>
        <span class="safety-value">{(safetyDistance * 100).toFixed(1)}%</span>
        <span class="safety-hint">(保持安全距离)</span>
      </div>
    </div>
  {/if}

  {#if showAnomalyPanel}
    <div class="sub-panel anomaly-subpanel">
      <h4 class="sub-title">⚠ 异常仿真控制</h4>
      <p class="anomaly-desc">
        模拟列车故障晚点，观察对后续列车的连锁影响
      </p>
      <div class="anomaly-config">
        <div class="setting-group">
          <label>目标线路</label>
          <select bind:value={anomalyTargetLineId}>
            {#each mapLines as line}
              <option value={line.id}>{line.name}</option>
            {/each}
          </select>
        </div>
        <div class="setting-row">
          <div class="setting-group">
            <label>影响车辆数</label>
            <input type="number" bind:value={anomalyTrainsCount} min={1} max={20} />
          </div>
          <div class="setting-group">
            <label>晚点（分钟）</label>
            <input type="number" bind:value={anomalyDelayMinutes} min={1} max={60} />
          </div>
        </div>
        <button class="apply-btn anomaly-apply" on:click={applyAnomalyToLine}>
          🚨 模拟故障
        </button>
      </div>
    </div>
  {/if}

  {#if showAdvancedStats}
    <div class="sub-panel">
      <h4 class="sub-title">📊 数据统计分析</h4>

      <div class="stat-tabs">
        <button
          class="stat-tab"
          class:active={showCapacityStats}
          on:click={() => { showCapacityStats = true; showWaitTimeDist = false }}
        >
          🚇 运量与满载
        </button>
        <button
          class="stat-tab"
          class:active={showWaitTimeDist}
          on:click={() => { showWaitTimeDist = true; showCapacityStats = false }}
        >
          ⏱ 候车分布
        </button>
      </div>

      {#if showCapacityStats || (!showCapacityStats && !showWaitTimeDist)}
        <div class="capacity-section">
          <div class="capacity-stats">
            <div class="cap-item">
              <span class="cap-label">全天预估运量</span>
              <span class="cap-value">{dailyTrafficEstimate.toLocaleString()}</span>
              <span class="cap-unit">人次</span>
            </div>
            <div class="cap-item">
              <span class="cap-label">系统整体满载率</span>
              <span class="cap-value" style="color: {getLoadFactorColor(overallLoadFactor / 100)}">
                {overallLoadFactor.toFixed(1)}%
              </span>
            </div>
            <div class="cap-item">
              <span class="cap-label">累计延误时间</span>
              <span class="cap-value" class:delay-color={stats?.totalDelays > 0}>
                {formatInterval(stats?.totalDelays || 0)}
              </span>
            </div>
          </div>

          <h5 class="section-h5">各线路运力情况</h5>
          <div class="line-capacity-list">
            {#each mapLines as line}
              <div class="line-capacity-item">
                <div class="lc-header">
                  <span class="line-dot" style="background: {line.color}" />
                  <span class="lc-name">{line.name}</span>
                  <span class="lc-count">{getLineCapacityData(line.id).lineTrains.length}辆</span>
                </div>
                <div class="lc-bar-container">
                  <div
                    class="lc-bar-fill"
                    style="width: {Math.min(getLineCapacityData(line.id).ratio * 100, 100)}%; background: {getLoadFactorColor(getLineCapacityData(line.id).ratio)}"
                  />
                </div>
                <div class="lc-footer">
                  <span>{getLineCapacityData(line.id).linePass}/{getLineCapacityData(line.id).lineCap} 人</span>
                  <span style="color: {getLoadFactorColor(getLineCapacityData(line.id).ratio)}">{(getLineCapacityData(line.id).ratio * 100).toFixed(0)}%</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if showWaitTimeDist}
        <div class="wait-time-section">
          <h5 class="section-h5">各站点平均候车时间 TOP 5</h5>
          {#if topWaitTimeStations.length > 0}
            <div class="wait-time-list">
              {#each topWaitTimeStations as [stationId, avgTime], i}
                <div class="wait-time-item">
                  <div class="wt-header">
                    <span class="wt-rank">#{i + 1}</span>
                    <span class="wt-name">{getStationName(stationId)}</span>
                    <span class="wt-time">{formatInterval(avgTime)}</span>
                  </div>
                  <div class="wt-bar-container">
                    <div
                      class="wt-bar-fill"
                      style="width: {getWaitTimeBarWidth(avgTime)}%"
                    />
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-msg">数据采集中...运行仿真后可查看候车时间</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

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
          <input type="time" bind:value={peakStartStr} />
        </div>
        <div class="setting-group">
          <label>高峰结束</label>
          <input type="time" bind:value={peakEndStr} />
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

      {#if selectedDispatchMode === 'express_local'}
        <div class="setting-group">
          <label>快车跳过站点数</label>
          <input type="number" bind:value={expressSkipCount} min={1} max={10} />
          <p class="hint">快车每隔N站停1次（默认：2站停1次）</p>
        </div>
      {/if}

      <div class="setting-group">
        <label>安全追踪间隔（%）</label>
        <input type="number" bind:value={safetyDistance} min={0.005} max={0.1} step={0.005} />
        <p class="hint">两列车之间需保持的最小距离比例（防止追尾）</p>
      </div>

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
          <input type="time" bind:value={startTimeStr} />
        </div>
        <div class="setting-group">
          <label>运营结束</label>
          <input type="time" bind:value={endTimeStr} />
        </div>
      </div>

      {#if selectedDispatchMode === 'custom_timetable'}
        <div class="setting-group">
          <label>自定义时刻表</label>
          <div class="csv-actions">
            <button class="template-btn" on:click={downloadCSVTemplate} type="button">
              📥 下载 CSV 模板
            </button>
            <input type="file" accept=".csv" on:change={handleFileUpload} />
          </div>
          <p class="hint">格式：车次,线路,方向(up/down),发车时间,站点1,到达,发车,站点2,到达,发车...</p>
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
            {#each mapLines as line}
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
</div>

<style>
  .simulation-panel {
    position: absolute;
    top: 16px;
    right: 120px;
    bottom: 60px;
    width: 400px;
    max-height: calc(100vh - 100px);
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1000;
    font-family: 'Segoe UI', system-ui, 'Microsoft YaHei', sans-serif;
  }

  .panel-body-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
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

  .quick-actions {
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #eee;
    background: #fff;
  }

  .qa-btn {
    flex: 1;
    padding: 8px 4px;
    font-size: 11px;
    border: 1px solid #e0e0e0;
    background: #fafafa;
    border-radius: 6px;
    cursor: pointer;
    color: #555;
    transition: all 0.2s;
    font-weight: 500;
  }

  .qa-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
    background: #f0f7fc;
  }

  .qa-btn.active {
    background: #0065B3;
    color: white;
    border-color: #0065B3;
  }

  .qa-btn.interval-btn.active { background: #2196F3; border-color: #2196F3; }
  .qa-btn.anomaly-btn.active { background: #FF9800; border-color: #FF9800; }
  .qa-btn.stats-btn.active { background: #9C27B0; border-color: #9C27B0; }

  .anomaly-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: linear-gradient(90deg, #ffebee, #fff3e0);
    border-bottom: 1px solid #ffccbc;
    margin: 0;
  }

  .warning-icon {
    font-size: 16px;
  }

  .warning-text {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: #d32f2f;
  }

  .warning-fix {
    padding: 5px 12px;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    font-weight: 500;
  }

  .warning-fix:hover {
    background: #43A047;
  }

  .sub-panel {
    padding: 14px;
    border-bottom: 1px solid #e0e0e0;
    background: #fafcff;
  }

  .sub-title {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: #333;
    font-weight: 600;
  }

  .interval-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .interval-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: white;
    border-radius: 6px;
    border: 1px solid #f0f0f0;
  }

  .interval-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .line-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }

  .interval-line-name {
    font-size: 12px;
    font-weight: 500;
    color: #333;
  }

  .interval-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .train-count-badge {
    font-size: 10px;
    padding: 2px 7px;
    background: #e3f2fd;
    color: #1976D2;
    border-radius: 10px;
    font-weight: 600;
  }

  .interval-value {
    font-size: 12px;
    font-weight: 600;
    color: #0065B3;
    font-family: 'Courier New', monospace;
  }

  .safety-info {
    margin-top: 10px;
    padding: 8px 10px;
    background: #e8f5e9;
    border-radius: 6px;
    font-size: 11px;
    color: #2e7d32;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .safety-label {
    color: #558b2f;
    font-weight: 500;
  }

  .safety-value {
    font-weight: 700;
    font-family: 'Courier New', monospace;
  }

  .safety-hint {
    color: #7cb342;
    font-size: 10px;
  }

  .anomaly-subpanel {
    background: #fffbf5;
    border-top: 1px solid #ffe0b2;
    border-bottom: 1px solid #ffe0b2;
  }

  .anomaly-desc {
    margin: 0 0 10px 0;
    font-size: 11px;
    color: #795548;
    padding: 8px 10px;
    background: #fff3e0;
    border-radius: 4px;
  }

  .anomaly-config {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .anomaly-apply {
    background: #F44336;
  }

  .anomaly-apply:hover {
    background: #d32f2f;
  }

  .stat-tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }

  .stat-tab {
    flex: 1;
    padding: 7px;
    font-size: 11px;
    border: 1px solid #e0e0e0;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    color: #666;
    transition: all 0.2s;
    font-weight: 500;
  }

  .stat-tab:hover {
    border-color: #9C27B0;
    color: #9C27B0;
  }

  .stat-tab.active {
    background: #9C27B0;
    color: white;
    border-color: #9C27B0;
  }

  .capacity-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-bottom: 14px;
  }

  .cap-item {
    background: white;
    padding: 10px 8px;
    border-radius: 6px;
    text-align: center;
    border: 1px solid #f0f0f0;
  }

  .cap-label {
    display: block;
    font-size: 10px;
    color: #888;
    margin-bottom: 4px;
  }

  .cap-value {
    display: block;
    font-size: 15px;
    font-weight: 700;
    color: #333;
    font-family: 'Segoe UI', sans-serif;
  }

  .cap-unit {
    display: block;
    font-size: 10px;
    color: #aaa;
    margin-top: 2px;
  }

  .cap-value.delay-color {
    color: #ff9800 !important;
  }

  .section-h5 {
    margin: 0 0 10px 0;
    font-size: 12px;
    color: #555;
    font-weight: 600;
    padding-left: 8px;
    border-left: 3px solid #9C27B0;
  }

  .line-capacity-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .line-capacity-item {
    background: white;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid #f0f0f0;
  }

  .lc-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .lc-name {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: #333;
  }

  .lc-count {
    font-size: 10px;
    padding: 2px 7px;
    background: #f3e5f5;
    color: #7B1FA2;
    border-radius: 10px;
    font-weight: 600;
  }

  .lc-bar-container {
    height: 8px;
    background: #f5f5f5;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 4px;
  }

  .lc-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s, background 0.3s;
  }

  .lc-footer {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: #888;
  }

  .wait-time-section {
    margin-top: 4px;
  }

  .wait-time-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .wait-time-item {
    background: white;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid #f0f0f0;
  }

  .wt-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .wt-rank {
    width: 22px;
    height: 22px;
    background: #f44336;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
  }

  .wt-rank:nth-child(2) { background: #ff9800; }
  .wt-rank:nth-child(3) { background: #ffc107; color: #333; }
  .wt-rank:nth-child(4) { background: #8bc34a; }
  .wt-rank:nth-child(5) { background: #4caf50; }

  .wt-name {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: #333;
  }

  .wt-time {
    font-size: 12px;
    font-weight: 700;
    color: #f44336;
    font-family: 'Courier New', monospace;
  }

  .wt-bar-container {
    height: 6px;
    background: #f5f5f5;
    border-radius: 3px;
    overflow: hidden;
  }

  .wt-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #4caf50, #ff9800, #f44336);
    border-radius: 3px;
    transition: width 0.5s;
  }

  .empty-msg {
    text-align: center;
    color: #aaa;
    font-size: 11px;
    padding: 20px;
    background: #fafafa;
    border-radius: 6px;
  }

  .csv-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .template-btn {
    padding: 8px;
    background: #e8eaf6;
    color: #3f51b5;
    border: 1px solid #c5cae9;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;
  }

  .template-btn:hover {
    background: #c5cae9;
  }
</style>
