<script lang="ts">
  import { get } from 'svelte/store'
  import { mapStore, validationResultStore } from '../stores/mapStore'
  import { getSampleData, mockFetchMapData, clearMapData, saveMapData } from '../utils/storage'

  let showExport = false
  let showImport = false
  let importError = ''

  function checkExportErrors(): boolean {
    const result = get(validationResultStore)
    if (result.errorCount > 0) {
      return confirm(
        `当前存在 ${result.errorCount} 个错误级别的数据问题，导出的导出可能导致异常。\n\n确定要继续导出吗？`
      )
    }
    return true
  }

  async function exportAsSVG() {
    if (!checkExportErrors()) return
    const svg = document.querySelector('.metro-svg') as SVGSVGElement
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `metro-map-${Date.now()}.svg`
    a.click()
    URL.revokeObjectURL(url)
    showExport = false
  }

  function exportAsJSON() {
    if (!checkExportErrors()) return
    const data = get(mapStore)
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `metro-map-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showExport = false
  }

  function exportAsPNG() {
    if (!checkExportErrors()) return
    const svg = document.querySelector('.metro-svg') as SVGSVGElement
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx?.scale(2, 2)
      ctx?.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      canvas.toBlob(blob => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = `metro-map-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(pngUrl)
      }, 'image/png')
    }

    img.src = url
    showExport = false
  }

  function handleImportFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (data.lines && data.stations) {
          mapStore.set(data)
          showImport = false
          importError = ''
        } else {
          importError = '无效的地铁线路图数据文件'
        }
      } catch (err) {
        importError = '文件解析失败，请确保是有效的 JSON 文件'
      }
    }
    reader.readAsText(file)
  }

  async function loadSampleData() {
    if (confirm('加载示例数据将覆盖当前线路图，确定吗？')) {
      const data = await mockFetchMapData()
      mapStore.set(data)
    }
  }

  function resetAllData() {
    if (confirm('确定要清空所有线路数据吗？此操作不可撤销。')) {
      clearMapData()
      mapStore.set({
        mapName: '新地铁线路图',
        lines: [],
        stations: []
      })
    }
  }
</script>

<div class="export-panel">
  <div class="export-group">
    <button class="export-btn primary" on:click={() => showExport = !showExport}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      导出
    </button>

    {#if showExport}
      <div class="export-dropdown">
        <button class="dropdown-item" on:click={exportAsSVG}>
          <span class="icon">📄</span>
          <div>
            <div class="item-title">SVG 矢量图</div>
            <div class="item-desc">无损缩放，适合印刷</div>
          </div>
        </button>
        <button class="dropdown-item" on:click={exportAsPNG}>
          <span class="icon">🖼️</span>
          <div>
            <div class="item-title">PNG 图片</div>
            <div class="item-desc">高清位图，方便分享</div>
          </div>
        </button>
        <button class="dropdown-item" on:click={exportAsJSON}>
          <span class="icon">📋</span>
          <div>
            <div class="item-title">JSON 数据</div>
            <div class="item-desc">可重新导入编辑</div>
          </div>
        </button>
      </div>
    {/if}
  </div>

  <div class="export-group">
    <button class="export-btn" on:click={() => showImport = !showImport}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      导入
    </button>

    {#if showImport}
      <div class="export-dropdown">
        <label class="dropdown-item file-input-label">
          <span class="icon">📁</span>
          <div>
            <div class="item-title">从文件导入</div>
            <div class="item-desc">支持 JSON 格式</div>
          </div>
          <input
            type="file"
            accept=".json"
            on:change={handleImportFile}
            style="display: none"
          />
        </label>
        <button class="dropdown-item" on:click={loadSampleData}>
          <span class="icon">🚇</span>
          <div>
            <div class="item-title">加载示例数据</div>
            <div class="item-desc">模拟接口加载</div>
          </div>
        </button>
        {#if importError}
          <div class="import-error">{importError}</div>
        {/if}
      </div>
    {/if}
  </div>

  <button class="export-btn danger" on:click={resetAllData}>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
    清空
  </button>
</div>

<style>
  .export-panel {
    display: flex;
    gap: 8px;
  }

  .export-group {
    position: relative;
  }

  .export-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid #d9d9d9;
    background: white;
    color: #333;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .export-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }

  .export-btn.primary {
    background: #0065B3;
    border-color: #0065B3;
    color: white;
  }

  .export-btn.primary:hover {
    background: #005290;
    border-color: #005290;
  }

  .export-btn.danger:hover {
    border-color: #ff4d4f;
    color: #ff4d4f;
  }

  .export-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 4px;
    min-width: 220px;
    z-index: 100;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s;
  }

  .dropdown-item:hover {
    background: #f5f5f5;
  }

  .file-input-label {
    cursor: pointer;
  }

  .icon {
    font-size: 20px;
  }

  .item-title {
    font-size: 13px;
    font-weight: 500;
    color: #333;
  }

  .item-desc {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
  }

  .import-error {
    padding: 8px 12px;
    color: #ff4d4f;
    font-size: 12px;
    background: #fff1f0;
    border-radius: 4px;
    margin: 4px;
  }
</style>
