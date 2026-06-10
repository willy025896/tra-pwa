<script setup lang="ts">
defineProps<{ modelValue: string; placeholder?: string; ariaLabel?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

// 打字即時格式化：只留數字、最多 4 位，採「右兩位＝分鐘」於倒數第 2 位前補冒號
// 123 → 1:23、1230 → 12:30、830 → 8:30（消除部分輸入的歧義）
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  // 滿 4 位即定型並夾限，避免停留在 23:99、9:99 之類的非法顯示
  if (digits.length === 4) return normalizeTime(digits)
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`
}

// 失焦時正規化成合法 24 小時制 HH:mm：右兩位＝分、其餘＝時，超界各自夾到 23 / 59
function normalizeTime(v: string): string {
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  const h = Math.min(23, Number(digits.slice(0, -2) || '0'))
  const m = Math.min(59, Number(digits.slice(-2)))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function onInput(e: Event) {
  emit('update:modelValue', formatTimeInput((e.target as HTMLInputElement).value))
}

function onBlur(e: FocusEvent) {
  emit('update:modelValue', normalizeTime((e.target as HTMLInputElement).value))
}
</script>

<template>
  <input
    :value="modelValue"
    @input="onInput"
    @blur="onBlur"
    type="text"
    inputmode="numeric"
    maxlength="5"
    :placeholder="placeholder"
    :aria-label="ariaLabel"
    class="time-input"
  />
</template>

<style scoped>
.time-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  font-size: 0.92rem;
  color: var(--text);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  outline: none;
}
.time-input::placeholder { color: var(--text-muted); }
</style>
