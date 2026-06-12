<script lang="ts">
  import {
    validationResultStore,
    fixValidationIssue,
    fixAllValidationIssues,
    selectedStationIdStore,
    selectedLineIdStore
  } from '../stores/mapStore'
  import type { ValidationIssue, ValidationSeverity } from '../types'

  let expanded = false
  let filter: 'all' | 'error' | 'warning' | 'info' = 'all'
  let result: any = null

  const unsubscribe = validationResultStore.subscribe(r => {
    result = r
  })

  function toggleExpand() {
    expanded = !expanded
  }

  function getSeverityIcon(severity: ValidationSeverity): string {
    switch (severity) {
      case 'error': return '✕'
      case 'warning': return '⚠'
      case 'info': return 'ℹ'
    }
  }

  function getSeverityLabel(severity: ValidationSeverity): string {
    switch (severity) {
      case 'error': return '错误'
      case 'warning': return '警告'
      case 'info': return '提示'
    }
  }

  function handleFix(issue: ValidationIssue) {
    fixValidationIssue(issue)
  }

  function handleFixAll() {
    if (confirm('确定要自动修复所有可修复的问题吗？')) {
      fixAllValidationIssues()
    }
  }

  function handleLocate(issue: ValidationIssue) {
    if (issue.targetType === 'station' && issue.targetId) {
      selectedStationIdStore.set(issue.targetId)
    } else if (issue.targetType === 'line' && issue.targetId) {
      selectedLineIdStore.set(issue.targetId)
    }
  }

  function getFilteredIssues(): ValidationIssue[] {
    if (!result) return []
    if (filter === 'all') return result.issues
    return result.issues.filter((i: ValidationIssue) => i.severity === filter)
  }

  function getFixableCount(): number {
    if (!result) return 0
    return result.issues.filter((i: ValidationIssue) => i.fixable).length
  }
</script>

<div class="validation-panel" class:expanded={expanded}>
  <div class="panel-header" on:click={toggleExpand}>
    <div class="header-left">
      <span class="icon">🔍</span>
      <span class="title">数据校验</span>
      {#if result && result.issues.length > 0}
        <span class="badge" class:has-error={result.errorCount > 0}>
          {result.issues.length}
        </span>
      {/if}
    </div>
    <span class="expand-icon">{expanded ? '▼' : '▲'}</span>
  </div>

  {#if expanded}
    <div class="panel-content">
      {#if result && result.issues.length > 0}
        <div class="summary">
          <div class="summary-item error">
            <span class="dot"></span>
            <span>错误 {result.errorCount}</span>
          </div>
          <div class="summary-item warning">
            <span class="dot"></span>
            <span>警告 {result.warningCount}</span>
          </div>
          <div class="summary-item info">
            <span class="dot"></span>
            <span>提示 {result.infoCount}</span>
          </div>
        </div>

        <div class="filter-bar">
          <button
            class="filter-btn"
            class:active={filter === 'all'}
            on:click={() => filter = 'all'}
          >
            全部
          </button>
          <button
            class="filter-btn error"
            class:active={filter === 'error'}
            on:click={() => filter = 'error'}
          >
            错误
          </button>
          <button
            class="filter-btn warning"
            class:active={filter === 'warning'}
            on:click={() => filter = 'warning'}
          >
            警告
          </button>
          <button
            class="filter-btn info"
            class:active={filter === 'info'}
            on:click={() => filter = 'info'}
          >
            提示
          </button>
        </div>

        {#if getFixableCount() > 0}
          <button class="fix-all-btn" on:click={handleFixAll}>
            🔧 一键修复所有可修复问题 ({getFixableCount()})
          </button>
        {/if}

        <div class="issue-list">
          {#each getFilteredIssues() as issue (issue.id)}
            <div
              class="issue-item"
              class:error={issue.severity === 'error'}
              class:warning={issue.severity === 'warning'}
              class:info={issue.severity === 'info'}
            >
              <div class="issue-header">
                <span class="severity-icon">{getSeverityIcon(issue.severity)}</span>
                <span class="severity-label">{getSeverityLabel(issue.severity)}</span>
                <button
                  class="locate-btn"
                  on:click={() => handleLocate(issue)}
                  title="定位到问题"
                >
                  📍
                </button>
              </div>
              <div class="issue-message">{issue.message}</div>
              {#if issue.fixable}
                <button class="fix-btn" on:click={() => handleFix(issue)}>
                  快速修复
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <div class="check-icon">✓</div>
          <div class="empty-text">数据校验通过</div>
          <div class="empty-sub">未发现任何问题</div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .validation-panel {
    border-top: 1px solid #e8e8e8;
    background: #fafafa;
    flex-shrink: 0;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.2s;
    user-select: none;
  }

  .panel-header:hover {
    background: #f0f0f0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon {
    font-size: 16px;
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  .badge {
    background: #999;
    color: white;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
  }

  .badge.has-error {
    background: #ff4d4f;
  }

  .expand-icon {
    font-size: 10px;
    color: #999;
  }

  .panel-content {
    padding: 0 12px 12px;
    max-height: 300px;
    overflow-y: auto;
  }

  .validation-panel.expanded .panel-content {
    display: block;
  }

  .summary {
    display: flex;
    gap: 12px;
    padding: 8px;
    background: white;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #666;
  }

  .summary-item .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .summary-item.error .dot {
    background: #ff4d4f;
  }

  .summary-item.warning .dot {
    background: #faad14;
  }

  .summary-item.info .dot {
    background: #1890ff;
  }

  .filter-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }

  .filter-btn {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #d9d9d9;
    background: white;
    color: #666;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    border-color: #0065B3;
    color: #0065B3;
  }

  .filter-btn:active {
    background: #0065B3;
    color: white;
    border-color: #0065B3;
  }

  .filter-btn.error:active {
    background: #ff4d4f;
    border-color: #ff4d4f;
  }

  .filter-btn.warning:active {
    background: #faad14;
    border-color: #faad14;
  }

  .filter-btn.info:active {
    background: #1890ff;
    border-color: #1890ff;
  }

  .fix-all-btn {
    width: 100%;
    padding: 8px;
    background: #52c41a;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    margin-bottom: 10px;
    transition: background 0.2s;
  }

  .fix-all-btn:hover {
    background: #389e0d;
  }

  .issue-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .issue-item {
    background: white;
    border-radius: 6px;
    padding: 10px;
    border-left: 3px solid #d9d9d9;
  }

  .issue-item.error {
    border-left-color: #ff4d4f;
  }

  .issue-item.warning {
    border-left-color: #faad14;
  }

  .issue-item.info {
    border-left-color: #1890ff;
  }

  .issue-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .severity-icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    border-radius: 50%;
    color: white;
    flex-shrink: 0;
  }

  .issue-item.error .severity-icon {
    background: #ff4d4f;
  }

  .issue-item.warning .severity-icon {
    background: #faad14;
  }

  .issue-item.info .severity-icon {
    background: #1890ff;
  }

  .severity-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    flex: 1;
  }

  .issue-item.error .severity-label {
    color: #ff4d4f;
  }

  .issue-item.warning .severity-label {
    color: #faad14;
  }

  .issue-item.info .severity-label {
    color: #1890ff;
  }

  .locate-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 2px;
    border-radius: 3px;
    transition: background 0.2s;
  }

  .locate-btn:hover {
    background: #f0f0f0;
  }

  .issue-message {
    font-size: 12px;
    color: #555;
    line-height: 1.5;
    margin-bottom: 8px;
    word-break: break-all;
  }

  .fix-btn {
    width: 100%;
    padding: 6px;
    background: #f0f5ff;
    color: #0065B3;
    border: 1px solid #0065B3;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
  }

  .fix-btn:hover {
    background: #0065B3;
    color: white;
  }

  .empty-state {
    text-align: center;
    padding: 20px 10px;
  }

  .check-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 10px;
    background: #52c41a;
    color: white;
    font-size: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-text {
    font-size: 14px;
    font-weight: 600;
    color: #52c41a;
    margin-bottom: 4px;
  }

  .empty-sub {
    font-size: 12px;
    color: #999;
  }
</style>
