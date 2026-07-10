<template>
  <Transition name="loading-fade">
    <div
      v-if="active"
      class="loading-overlay"
      :class="{ 'loading-overlay-inline': inline }"
      role="status"
      aria-live="polite"
    >
      <div class="loading-spinner">
        <span class="spinner-circle"></span>
        <span v-if="message" class="loading-message">{{ message }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
defineProps({
  active:  { type: Boolean, default: false },
  message: { type: String,  default: "" },
  // true：absolute 定位，铺满最近的 position:relative 祖先（比如弹框内部）
  // false（默认）：fixed 定位，铺满整个视口（比如切换周/Team 时）
  inline:  { type: Boolean, default: false }
});
</script>