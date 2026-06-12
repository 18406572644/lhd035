<script lang="ts">
  import {
    validationRulesStore,
    toggleValidationRule,
    setValidationRuleSeverity,
    resetValidationRules
  } from '../stores/mapStore'
  import type { ValidationRuleConfig, ValidationSeverity } from '../types'

  export let show = false

  let rules: ValidationRuleConfig[] = []

  const unsubscribe = validationRulesStore.subscribe(r => {
    rules = r
  })

  function handleToggle(ruleId: string) {
    toggleValidationRule(ruleId)
  }

  function handleSeverityChange(ruleId: string, severity: ValidationSeverity) {
    setValidationRuleSeverity(ruleId, severity)
  }

  function onSeverityChange(e: Event, ruleId: string) {
    const target = e.target as HTMLSelectElement
    handleSeverityChange(ruleId, target.value as ValidationSeverity)
  }

  function handleReset() {
    if (confirm('确定要重置所有校验规则为默认设置吗？')) {
      resetValidationRules()
    }
  }

  function closePanel() {
    show = false
  }

  function getSeverityLabel(severity: ValidationSeverity): string {
    switch (severity) {
      case 'error': return '错误'
      case 'warning': return '警告'
      case 'info': return '提示'
    }
  }
</script>

{#if show}
  <div class="settings-overlay" on:click={closePanel}>
    <div class="settings-panel" on:click|stopPropagation>
      <div class="settings-header">
        <h3>校验规则设置</h3>
        <button class="close-btn" on:click={closePanel}>×</button>
      </div>

      <div class="settings-content">
        <div class="rules-list">
          {#each rules as rule (rule.id)}
            <div class="rule-item" class:disabled={!rule.enabled}>
              <div class="rule-header">
                <label class="rule-toggle">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    on:change={() => handleToggle(rule.id)}
                  />
                  <span class="rule-name">{rule.name}</span>
                </label>
                <select
                  class="severity-select"
                  class:error={rule.severity === 'error'}
                  class:warning={rule.severity === 'warning'}
                  class:info={rule.severity === 'info'}
                  value={rule.severity}
                  disabled={!rule.enabled}
                  on:change={(e) => onSeverityChange(e, rule.id)}
                >
                  <option value="error">错误</option>
                  <option value="warning">警告</option>
                  <option value="info">提示</option>
                </select>
              </div>
              <p class="rule-desc">{rule.description}</p>
            </div>
          {/each}
        </div>
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
    width: 480px;
    max-height: 80vh;
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

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px;
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rule-item {
    padding: 12px;
    background: #fafafa;
    border-radius: 8px;
    border: 1px solid #f0f0f0;
    transition: all 0.2s;
  }

  .rule-item.disabled {
    opacity: 0.6;
  }

  .rule-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .rule-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }

  .rule-toggle input {
    cursor: pointer;
    accent-color: #0065B3;
    width: 16px;
    height: 16px;
  }

  .rule-name {
    font-size: 14px;
    font-weight: 500;
    color: #333;
  }

  .severity-select {
    padding: 4px 8px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 12px;
    color: #666;
    background: white;
    outline: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .severity-select:hover:not(:disabled) {
    border-color: #0065B3;
  }

  .severity-select:disabled {
    cursor: not-allowed;
    background: #f5f5f5;
  }

  .severity-select.error {
    color: #ff4d4f;
    border-color: #ffccc7;
  }

  .severity-select.warning {
    color: #faad14;
    border-color: #ffe58f;
  }

  .severity-select.info {
    color: #1890ff;
    border-color: #91d5ff;
  }

  .rule-desc {
    margin: 0;
    font-size: 12px;
    color: #999;
    padding-left: 24px;
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
