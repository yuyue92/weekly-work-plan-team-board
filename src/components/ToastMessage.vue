<template>
  <div class="toast" :class="[{ show: visible }, `toast-${type}`]">{{ message }}</div>
</template>

<script setup>
defineProps({
  message: { type: String,  default: "" },
  visible: { type: Boolean, default: false },
  // 消息类型：success（成功，绿色）| error（失败，红色）| info（普通提示，默认深色）
  type:    { type: String,  default: "info" }
});
</script>
