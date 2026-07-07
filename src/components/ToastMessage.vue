<template>
  <div class="toast" :class="{ show: visible }">{{ message }}</div>
</template>

<script setup>
defineProps({
  message: { type: String,  default: "" },
  visible: { type: Boolean, default: false }
});
</script>
