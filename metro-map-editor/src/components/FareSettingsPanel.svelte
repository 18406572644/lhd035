<script lang="ts">
  import {
    fareConfigStore,
    setFareRuleType,
    updateDistanceFareConfig,
    updateStationCountFareConfig,
    addStationCountTier,
    removeStationCountTier,
    updateStationCountTier,
    updateLineFareConfig,
    setLinePrice,
    updateTransferFareConfig,
    addDiscountPeriod,
    removeDiscountPeriod,
    updateDiscountPeriod,
    resetFareConfig,
    mapStore
  } from '../stores/mapStore'
  import type { FareConfig, FareRuleType, DiscountPeriod, MetroLine } from '../types'
  import { createDiscountPeriod } from '../utils/fare'

  export let show = false

  let fareConfig: FareConfig
  let activeTab: FareRuleType | 'transfer' | 'discount' = 'station_count'
  let lines: MetroLine[] = []

  const unsubscribeFare = fareConfigStore.subscribe(config => {
    fareConfig = config
    activeTab = config.ruleType
  })

  const unsubscribeMap = mapStore.subscribe(data => {
    lines = data.lines
  })

  function closePanel() {
    show = false
  }

  function handleRuleTypeChange(type: FareRuleType) {
    setFareRuleType(type)
    activeTab = type
  }

  function handleReset() {
    if (confirm('确定要重置所有票价配置为默认设置吗？')) {
      resetFareConfig()
    }
  }

  function handleAddTier() {
    const maxStations = fareConfig.stationCountConfig.tiers.length > 0
      ? fareConfig.stationCountConfig.tiers[fareConfig.stationCountConfig.tiers.length - 1].maxStations + 5
      : 5
    addStationCountTier(maxStations, 2)
  }

  function handleAddDiscountPeriod() {
    const period = createDiscountPeriod('新优惠时段', 7, 0, 9, 0, 0.8)
    addDiscountPeriod(period)
  }

  function updateDiscountTime(periodId: string, field: 'start' | 'end', value: string) {
    const [hours, minutes] = value.split(':').map(Number)
    const time = hours * 3600 + minutes * 60

    if (field === 'start') {
      updateDiscountPeriod(periodId, { startTime: time })
    } else {
      updateDiscountPeriod(periodId, { endTime: time })
    }
  }

  function timeToInputValue(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  function handleTierMaxStationsInput(index: number, e: Event) {
    const target = e.target as HTMLInputElement
    updateStationCountTier(index, { maxStations: Number(target.value) })
  }

  function handleTierPriceInput(index: number, e: Event) {
    const target = e.target as HTMLInputElement
    updateStationCountTier(index, { price: Number(target.value) })
  }

  function handleDefaultPriceInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateStationCountFareConfig({ defaultPrice: Number(target.value) })
  }

  function handleBasePriceInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateDistanceFareConfig({ basePrice: Number(target.value) })
  }

  function handleBaseDistanceInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateDistanceFareConfig({ baseDistance: Number(target.value) })
  }

  function handleUnitPriceInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateDistanceFareConfig({ unitPrice: Number(target.value) })
  }

  function handleUnitDistanceInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateDistanceFareConfig({ unitDistance: Number(target.value) })
  }

  function handleLineBasePriceInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateLineFareConfig({ basePrice: Number(target.value) })
  }

  function handleDefaultLinePriceInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateLineFareConfig({ defaultLinePrice: Number(target.value) })
  }

  function handleLinePriceInput(lineId: string, e: Event) {
    const target = e.target as HTMLInputElement
    setLinePrice(lineId, Number(target.value))
  }

  function handleTransferEnabledChange(e: Event) {
    const target = e.target as HTMLInputElement
    updateTransferFareConfig({ enabled: target.checked })
  }

  function handleFeePerTransferInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateTransferFareConfig({ feePerTransfer: Number(target.value) })
  }

  function handleFreeTransferCountInput(e: Event) {
    const target = e.target as HTMLInputElement
    updateTransferFareConfig({ freeTransferCount: Number(target.value) })
  }

  function handleMaxTransferFeeInput(e: Event) {
    const target = e.target as HTMLInputElement
    const val = target.value
    updateTransferFareConfig({ maxTransferFee: val ? Number(val) : undefined })
  }

  function handleDiscountNameInput(periodId: string, e: Event) {
    const target = e.target as HTMLInputElement
    updateDiscountPeriod(periodId, { name: target.value })
  }

  function handleDiscountStartTimeChange(periodId: string, e: Event) {
    const target = e.target as HTMLInputElement
    updateDiscountTime(periodId, 'start', target.value)
  }

  function handleDiscountEndTimeChange(periodId: string, e: Event) {
    const target = e.target as HTMLInputElement
    updateDiscountTime(periodId, 'end', target.value)
  }

  function handleDiscountRateInput(periodId: string, e: Event) {
    const target = e.target as HTMLInputElement
    updateDiscountPeriod(periodId, { discountRate: Number(target.value) })
  }
</script>

{#if show}
  <div class="settings-overlay" on:click={closePanel}>
    <div class="settings-panel" on:click|stopPropagation>
      <div class="settings-header">
        <h3>票价配置</h3>
        <button class="close-btn" on:click={closePanel}>×</button>
      </div>

      <div class="tabs">
        <button
          class="tab-btn"
          class:active={activeTab === 'station_count'}
          on:click={() => activeTab = 'station_count'}
        >
          按站数
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'distance'}
          on:click={() => activeTab = 'distance'}
        >
          按里程
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'by_line'}
          on:click={() => activeTab = 'by_line'}
        >
          按线路
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'transfer'}
          on:click={() => activeTab = 'transfer'}
        >
          换乘
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === 'discount'}
          on:click={() => activeTab = 'discount'}
        >
          优惠时段
        </button>
      </div>

      <div class="settings-content">
        {#if activeTab === 'station_count'}
          <div class="config-section">
            <div class="section-header">
              <h4>按站数计价</h4>
              <label class="switch">
                <input
                  type="radio"
                  checked={fareConfig.ruleType === 'station_count'}
                  on:change={() => handleRuleTypeChange('station_count')}
                />
                <span class="slider" />
              </label>
            </div>
            <p class="section-desc">根据乘坐站数阶梯计价</p>

            <div class="tiers-list">
              {#each fareConfig.stationCountConfig.tiers as tier, index}
                <div class="tier-item">
                  <div class="tier-inputs">
                    <div class="input-group">
                      <label>最多站数</label>
                      <input
                        type="number"
                        min="1"
                        value={tier.maxStations}
                        on:input={(e) => handleTierMaxStationsInput(index, e)}
                      />
                    </div>
                    <div class="input-group">
                      <label>票价(元)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={tier.price}
                        on:input={(e) => handleTierPriceInput(index, e)}
                      />
                    </div>
                    <button class="remove-tier-btn" on:click={() => removeStationCountTier(index)}>
                      删除
                    </button>
                  </div>
                </div>
              {/each}
            </div>

            <button class="add-tier-btn" on:click={handleAddTier}>
              + 添加阶梯
            </button>

            <div class="input-group">
              <label>超出最高阶梯后默认票价(元)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={fareConfig.stationCountConfig.defaultPrice}
                on:input={handleDefaultPriceInput}
              />
            </div>
          </div>
        {/if}

        {#if activeTab === 'distance'}
          <div class="config-section">
            <div class="section-header">
              <h4>按里程计价</h4>
              <label class="switch">
                <input
                  type="radio"
                  checked={fareConfig.ruleType === 'distance'}
                  on:change={() => handleRuleTypeChange('distance')}
                />
                <span class="slider" />
              </label>
            </div>
            <p class="section-desc">起步价 + 超出里程加价</p>

            <div class="input-group">
              <label>起步价(元)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={fareConfig.distanceConfig.basePrice}
                on:input={handleBasePriceInput}
              />
            </div>

            <div class="input-group">
              <label>起步里程(米)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={fareConfig.distanceConfig.baseDistance}
                on:input={handleBaseDistanceInput}
              />
            </div>

            <div class="input-group">
              <label>每单位加价(元)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={fareConfig.distanceConfig.unitPrice}
                on:input={handleUnitPriceInput}
              />
            </div>

            <div class="input-group">
              <label>单位距离(米)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={fareConfig.distanceConfig.unitDistance}
                on:input={handleUnitDistanceInput}
              />
            </div>
          </div>
        {/if}

        {#if activeTab === 'by_line'}
          <div class="config-section">
            <div class="section-header">
              <h4>按线路计价</h4>
              <label class="switch">
                <input
                  type="radio"
                  checked={fareConfig.ruleType === 'by_line'}
                  on:change={() => handleRuleTypeChange('by_line')}
                />
                <span class="slider" />
              </label>
            </div>
            <p class="section-desc">不同线路单价不同，累加计算</p>

            <div class="input-group">
              <label>基础票价(元)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={fareConfig.lineConfig.basePrice}
                on:input={handleLineBasePriceInput}
              />
            </div>

            <div class="input-group">
              <label>默认线路单价(元)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={fareConfig.lineConfig.defaultLinePrice}
                on:input={handleDefaultLinePriceInput}
              />
            </div>

            <div class="lines-price-list">
              <div class="lines-price-title">各线路单价设置</div>
              {#each lines as line}
                <div class="line-price-item">
                  <span class="line-name" style="--line-color: {line.color}">
                    <span class="line-dot" style="background: {line.color}" />
                    {line.name}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={fareConfig.lineConfig.linePrices[line.id] ?? fareConfig.lineConfig.defaultLinePrice}
                    on:input={(e) => handleLinePriceInput(line.id, e)}
                  />
                  <span class="price-unit">元</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if activeTab === 'transfer'}
          <div class="config-section">
            <div class="section-header">
              <h4>换乘加价</h4>
              <label class="switch">
                <input
                  type="checkbox"
                  checked={fareConfig.transferConfig.enabled}
                  on:change={handleTransferEnabledChange}
                />
                <span class="slider" />
              </label>
            </div>
            <p class="section-desc">换乘时是否额外收取费用</p>

            {#if fareConfig.transferConfig.enabled}
              <div class="input-group">
                <label>每次换乘加价(元)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={fareConfig.transferConfig.feePerTransfer}
                  on:input={handleFeePerTransferInput}
                />
              </div>

              <div class="input-group">
                <label>免费换乘次数</label>
                <input
                  type="number"
                  min="0"
                  value={fareConfig.transferConfig.freeTransferCount ?? 0}
                  on:input={handleFreeTransferCountInput}
                />
              </div>

              <div class="input-group">
                <label>最高换乘费用(元，可选)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="不限制"
                  value={fareConfig.transferConfig.maxTransferFee ?? ''}
                  on:input={handleMaxTransferFeeInput}
                />
              </div>
            {/if}
          </div>
        {/if}

        {#if activeTab === 'discount'}
          <div class="config-section">
            <h4>优惠时段</h4>
            <p class="section-desc">在特定时段内乘车可享受折扣</p>

            <div class="discount-list">
              {#each fareConfig.discountPeriods as period}
                <div class="discount-item">
                  <div class="discount-header">
                    <input
                      type="text"
                      class="discount-name"
                      value={period.name}
                      on:input={(e) => handleDiscountNameInput(period.id, e)}
                      placeholder="时段名称"
                    />
                    <button class="remove-btn" on:click={() => removeDiscountPeriod(period.id)}>
                      删除
                    </button>
                  </div>
                  <div class="discount-times">
                    <input
                      type="time"
                      value={timeToInputValue(period.startTime)}
                      on:input={(e) => handleDiscountStartTimeChange(period.id, e)}
                    />
                    <span class="time-sep">至</span>
                    <input
                      type="time"
                      value={timeToInputValue(period.endTime)}
                      on:input={(e) => handleDiscountEndTimeChange(period.id, e)}
                    />
                  </div>
                  <div class="discount-rate">
                    <label>折扣率:</label>
                    <input
                      type="range"
                      min="0.5"
                      max="1"
                      step="0.05"
                      value={period.discountRate}
                      on:input={(e) => handleDiscountRateInput(period.id, e)}
                    />
                    <span class="rate-value">{Math.round(period.discountRate * 100)}%</span>
                  </div>
                </div>
              {/each}
            </div>

            <button class="add-discount-btn" on:click={handleAddDiscountPeriod}>
              + 添加优惠时段
            </button>
          </div>
        {/if}
      </div>

      <div class="settings-footer">
        <button class="reset-btn" on:click={handleReset}>
          恢复默认
        </button>
        <button class="confirm-btn" on:click={closePanel}>
          完成
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .settings-panel {
    background: white;
    border-radius: 12px;
    width: 520px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.2s ease;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e8e8e8;
  }

  .settings-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: #999;
    font-size: 20px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f5f5f5;
    color: #666;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid #e8e8e8;
    background: #fafafa;
  }

  .tab-btn {
    flex: 1;
    padding: 8px 10px;
    border: none;
    background: transparent;
    color: #666;
    font-size: 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    background: #f0f0f0;
  }

  .tab-btn.active {
    background: #0065B3;
    color: white;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .config-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }

  .section-desc {
    margin: 0 0 8px;
    font-size: 12px;
    color: #999;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-group label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }

  .input-group input[type="number"],
  .input-group input[type="text"] {
    padding: 8px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }

  .input-group input:focus {
    border-color: #0065B3;
  }

  .tiers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tier-item {
    background: #fafafa;
    border-radius: 8px;
    padding: 10px;
    border: 1px solid #f0f0f0;
  }

  .tier-inputs {
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }

  .tier-inputs .input-group {
    flex: 1;
  }

  .remove-tier-btn {
    padding: 8px 12px;
    border: 1px solid #ffccc7;
    background: #fff1f0;
    color: #ff4d4f;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .remove-tier-btn:hover {
    background: #ffccc7;
  }

  .add-tier-btn {
    padding: 8px;
    border: 1px dashed #d9d9d9;
    background: transparent;
    color: #666;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .add-tier-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }

  .lines-price-list {
    margin-top: 8px;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    overflow: hidden;
  }

  .lines-price-title {
    padding: 10px 12px;
    background: #fafafa;
    font-size: 12px;
    color: #666;
    font-weight: 500;
    border-bottom: 1px solid #f0f0f0;
  }

  .line-price-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid #f5f5f5;
  }

  .line-price-item:last-child {
    border-bottom: none;
  }

  .line-name {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #333;
  }

  .line-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .line-price-item input {
    width: 80px;
    padding: 6px 8px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 12px;
    text-align: right;
  }

  .price-unit {
    font-size: 12px;
    color: #999;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.3s;
    border-radius: 22px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 16px;
    width: 16px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #0065B3;
  }

  input:checked + .slider:before {
    transform: translateX(18px);
  }

  .discount-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .discount-item {
    background: #fafafa;
    border-radius: 8px;
    padding: 12px;
    border: 1px solid #f0f0f0;
  }

  .discount-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .discount-name {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 13px;
    outline: none;
  }

  .discount-name:focus {
    border-color: #0065B3;
  }

  .remove-btn {
    padding: 6px 10px;
    border: 1px solid #ffccc7;
    background: #fff1f0;
    color: #ff4d4f;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    margin-left: 10px;
  }

  .remove-btn:hover {
    background: #ffccc7;
  }

  .discount-times {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .discount-times input[type="time"] {
    padding: 6px 10px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 13px;
  }

  .time-sep {
    font-size: 12px;
    color: #999;
  }

  .discount-rate {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .discount-rate label {
    font-size: 12px;
    color: #666;
    white-space: nowrap;
  }

  .discount-rate input[type="range"] {
    flex: 1;
    accent-color: #0065B3;
  }

  .rate-value {
    font-size: 13px;
    font-weight: 500;
    color: #0065B3;
    min-width: 45px;
    text-align: right;
  }

  .add-discount-btn {
    width: 100%;
    padding: 10px;
    border: 1px dashed #d9d9d9;
    background: transparent;
    color: #666;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
    margin-top: 4px;
  }

  .add-discount-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }

  .settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 20px;
    border-top: 1px solid #e8e8e8;
  }

  .reset-btn {
    padding: 8px 16px;
    border: 1px solid #d9d9d9;
    background: white;
    color: #666;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .reset-btn:hover {
    border-color: #ff4d4f;
    color: #ff4d4f;
  }

  .confirm-btn {
    padding: 8px 20px;
    background: #0065B3;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
  }

  .confirm-btn:hover {
    background: #005290;
  }
</style>
