<script lang="ts">
  import { fly } from 'svelte/transition'
  import { selectedStationIdStore, mapStore } from '../stores/mapStore'
  import type { StationDetail as StationDetailType, ExitInfo } from '../types'

  let detail: StationDetailType | null = null
  let isEditing = false
  let editName = ''
  let editDescription = ''
  let editExits: ExitInfo[] = []
  let mapData: any = null
  let selectedStationId: string | null = null

  const unsubscribeMap = mapStore.subscribe(data => {
    mapData = data
    if (selectedStationId) {
      updateDetail(selectedStationId)
    }
  })

  const unsubscribeSelected = selectedStationIdStore.subscribe(id => {
    selectedStationId = id
    if (id && mapData) {
      updateDetail(id)
    } else {
      detail = null
    }
  })

  function updateDetail(stationId: string) {
    const station = mapData?.stations?.find((s: any) => s.id === stationId)
    if (station) {
      const lines = mapData?.lines?.filter((l: any) => l.stationIds.includes(stationId)) || []
      detail = { station, lines }
      isEditing = false
    }
  }

  function close() {
    selectedStationIdStore.set(null)
  }

  function startEdit() {
    if (!detail) return
    editName = detail.station.name
    editDescription = detail.station.description || ''
    editExits = [...(detail.station.exits || [])]
    isEditing = true
  }

  function cancelEdit() {
    isEditing = false
  }

  function saveEdit() {
    if (!detail || !editName.trim()) return
    mapStore.updateStation(detail.station.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      exits: editExits.length > 0 ? editExits : undefined
    })
    isEditing = false
  }

  function addExit() {
    editExits.push({
      name: String.fromCharCode(65 + editExits.length) + '口',
      description: ''
    })
  }

  function removeExit(index: number) {
    editExits.splice(index, 1)
  }

  function updateExitName(index: number, name: string) {
    editExits[index].name = name
  }

  function updateExitDesc(index: number, desc: string) {
    editExits[index].description = desc
  }

  function toggleTransfer() {
    if (!detail) return
    const isTransfer = !detail.station.isTransfer
    const transferLines = isTransfer ? detail.lines.map(l => l.id) : undefined
    mapStore.updateStation(detail.station.id, {
      isTransfer,
      transferLines: transferLines?.length > 1 ? transferLines : undefined
    })
  }
</script>

{#if detail}
  <div class="station-detail" transition:fly={{ x: 300, duration: 200 }}>
    <div class="detail-header">
      <div class="station-title">
        <h2>{detail.station.name}</h2>
        {#if detail.station.isTransfer}
          <span class="transfer-badge">换乘站</span>
        {/if}
      </div>
      <button class="close-btn" on:click={close}>×</button>
    </div>

    <div class="detail-body">
      <div class="section">
        <div class="section-title">途经线路</div>
        <div class="line-tags">
          {#each detail.lines as line}
            <span class="line-tag" style="--line-color: {line.color}">
              <span class="line-dot" style="background: {line.color}" />
              {line.name}
            </span>
          {/each}
        </div>
      </div>

      {#if !isEditing}
        {#if detail.station.description}
          <div class="section">
            <div class="section-title">站点简介</div>
            <p class="description">{detail.station.description}</p>
          </div>
        {/if}

        {#if detail.station.exits && detail.station.exits.length > 0}
          <div class="section">
            <div class="section-title">出入口信息</div>
            <div class="exit-list">
              {#each detail.station.exits as exit}
                <div class="exit-item">
                  <span class="exit-name">{exit.name}</span>
                  {#if exit.description}
                    <span class="exit-desc">{exit.description}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="section">
          <div class="section-title">坐标信息</div>
          <div class="coord-info">
            X: {Math.round(detail.station.x)} · Y: {Math.round(detail.station.y)}
          </div>
        </div>
      {:else}
        <div class="edit-form">
          <div class="form-item">
            <label for="stationName">站点名称</label>
            <input id="stationName" type="text" bind:value={editName} maxlength="20" />
          </div>

          <div class="form-item">
            <label for="stationDesc">站点简介</label>
            <textarea id="stationDesc" bind:value={editDescription} rows="3" maxlength="200" />
          </div>

          <div class="form-item">
            <div class="form-label-row">
              <label for="transferToggle">换乘站</label>
              <label class="switch">
                <input
                  id="transferToggle"
                  type="checkbox"
                  checked={detail.station.isTransfer}
                  on:change={toggleTransfer}
                />
                <span class="slider" />
              </label>
            </div>
          </div>

          <div class="form-item">
            <div class="form-label-row">
              <span class="section-label">出入口</span>
              <button class="add-exit-btn" on:click={addExit}>+ 添加</button>
            </div>
            <div class="exit-edit-list">
              {#each editExits as exit, index}
                <div class="exit-edit-item">
                  <input
                    type="text"
                    value={exit.name}
                    on:input={(e) => updateExitName(index, e.target.value)}
                    placeholder="出口名称"
                    class="exit-name-input"
                  />
                  <input
                    type="text"
                    value={exit.description}
                    on:input={(e) => updateExitDesc(index, e.target.value)}
                    placeholder="描述（可选）"
                    class="exit-desc-input"
                  />
                  <button class="remove-btn" on:click={() => removeExit(index)} aria-label="删除出口">×</button>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="detail-footer">
      {#if !isEditing}
        <button class="edit-btn" on:click={startEdit}>
          编辑站点
        </button>
      {:else}
        <button class="cancel-btn" on:click={cancelEdit}>取消</button>
        <button class="save-btn" on:click={saveEdit} disabled={!editName.trim()}>
          保存
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .station-detail {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 320px;
    max-height: calc(100% - 32px);
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 20;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px;
    border-bottom: 1px solid #f0f0f0;
    background: linear-gradient(135deg, #0065B3 0%, #0099CC 100%);
    color: white;
  }

  .station-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .station-title h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .transfer-badge {
    padding: 2px 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    font-size: 12px;
    backdrop-filter: blur(4px);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 50%;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .detail-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .section {
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 12px;
    color: #999;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .line-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .line-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--line-color) 10%, white);
    border-radius: 12px;
    font-size: 13px;
    color: var(--line-color);
  }

  .line-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .description {
    margin: 0;
    font-size: 13px;
    color: #555;
    line-height: 1.6;
  }

  .exit-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .exit-item {
    padding: 8px 12px;
    background: #f5f5f5;
    border-radius: 6px;
    font-size: 13px;
  }

  .exit-name {
    font-weight: 500;
    color: #333;
  }

  .exit-desc {
    margin-left: 8px;
    color: #999;
  }

  .coord-info {
    font-size: 13px;
    color: #666;
    font-family: monospace;
    padding: 8px 12px;
    background: #f5f5f5;
    border-radius: 6px;
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-item label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }

  .form-item input,
  .form-item textarea {
    padding: 8px 10px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
  }

  .form-item input:focus,
  .form-item textarea:focus {
    border-color: #0065B3;
  }

  .form-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
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
    border-radius: 20px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
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
    transform: translateX(16px);
  }

  .add-exit-btn {
    padding: 2px 8px;
    border: 1px dashed #d9d9d9;
    background: transparent;
    color: #999;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .add-exit-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }

  .exit-edit-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .exit-edit-item {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .exit-name-input {
    width: 70px;
    flex-shrink: 0;
  }

  .exit-desc-input {
    flex: 1;
  }

  .remove-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: #fff1f0;
    color: #ff4d4f;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    background: #ffccc7;
  }

  .detail-footer {
    padding: 12px 16px;
    border-top: 1px solid #f0f0f0;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .edit-btn {
    flex: 1;
    padding: 10px;
    background: #0065B3;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
  }

  .edit-btn:hover {
    background: #005290;
  }

  .cancel-btn {
    padding: 8px 16px;
    border: 1px solid #d9d9d9;
    background: white;
    color: #666;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .cancel-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }

  .save-btn {
    padding: 8px 20px;
    background: #0065B3;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
  }

  .save-btn:hover:not(:disabled) {
    background: #005290;
  }

  .save-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
</style>
