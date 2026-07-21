<template>
  <div
    class="item-card"
    :class="{ dragging: isDragging }"
    :draggable="draggableItem"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @mouseenter="showPreview"
    @mouseleave="hidePreview"
  >
    <div class="item-top">
      <div class="item-title"><span class="project-title">{{ item.project_name || "" }} - </span><span class="work_item-title">{{ item.work_item || "" }}</span></div>
      <div v-if="canEdit" class="item-actions">
        <button
          class="btn btn-light btn-sm icon-btn"
          type="button"
          title="Copy to previous week"
          aria-label="Copy to previous week"
          :disabled="isCopying"
          @click.stop="$emit('copy-week', memberId, status, item.id, -1)"
        >‹</button>
        <button
          class="btn btn-light btn-sm icon-btn"
          type="button"
          title="Copy to next week"
          aria-label="Copy to next week"
          :disabled="isCopying"
          @click.stop="$emit('copy-week', memberId, status, item.id, 1)"
        >›</button>
      </div>
      <span v-else class="tag">Readonly</span>
    </div>

    <div class="item-meta">
      <span class="tag" :class="priorityClass">{{ item.priority || "Low" }}</span>
      <span v-if="item.project_name" class="tag">{{ item.project_name }}</span>
      <span class="tag">Create: {{ item.create_date || "-" }}</span>
      <span class="tag">Expect: {{ item.expect_complete_date || "-" }}</span>
      <span class="tag">Tasks: {{ item.tasks.length }}</span>
    </div>

    <div v-if="hourTags.length" class="item-hours">
      <span v-for="tag in hourTags" :key="tag.label" class="tag hour-tag">{{ tag.label }}: {{ tag.value }}</span>
    </div>

    <Teleport to="body">
      <div
        ref="previewEl"
        class="item-preview"
        :class="{ 'is-preview-visible': previewVisible, 'is-flipped': arrowFlipped }"
        :style="{ ...previewStyle, '--arrow-left': arrowLeft + 'px' }">
        <div class="item-preview-scroll">
          <div class="preview-title">{{ item.work_item || "Untitled Work Item" }}</div>
          <template v-if="!item.tasks.length">
            <div class="preview-task">No tasks yet.</div>
          </template>
          <template v-else>
            <div class="preview-task" v-for="task in item.tasks.slice(0, 4)" :key="task.id || task.task_name">
              <b>{{ task.task_name || "Untitled Task" }}</b>
              <div>{{ truncate(task.description || task.remark_blocker || "", 80) }}</div>
            </div>
            <div class="preview-task" v-if="item.tasks.length > 4">
              {{ item.tasks.length - 4 }} more task(s)...
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, reactive, nextTick } from "vue";
import { HOUR_KEYS, WEEKDAY_LABELS } from "../constants/index.js";
import { truncate } from "../utils/helpers.js";

const props = defineProps({
  item:          { type: Object,  required: true },
  memberId:      { type: String,  required: true },
  status:        { type: String,  required: true },
  canEdit:       { type: Boolean, default: false },
  draggableItem: { type: Boolean, default: false },
  isCopying:     { type: Boolean, default: false }
});
const emit = defineEmits(["drag-start", "drag-end", "copy-week"]);

const isDragging      = ref(false);
const previewVisible  = ref(false);
const previewEl       = ref(null);
const previewStyle    = reactive({ top: "0px", left: "0px" });

const priorityClass = computed(() => `priority-${String(props.item.priority || "low").toLowerCase()}`);

// 每天工时 tag，只展示 > 0 的天，避免卡片信息过密
const hourTags = computed(() =>
  HOUR_KEYS
    .map((key, idx) => ({ label: WEEKDAY_LABELS[idx], value: Number(props.item.hours?.[key]) || 0 }))
    .filter(tag => tag.value > 0)
);

const arrowLeft = ref(22);
const arrowFlipped = ref(false);

async function showPreview(event) {
  previewVisible.value = true;
  await nextTick();

  const card    = event.currentTarget.getBoundingClientRect();
  const preview = previewEl.value?.getBoundingClientRect();
  if (!preview) return;

  const GAP = 8;
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const pw  = preview.width  || 420;
  const ph  = preview.height || 200;

  let top  = card.bottom + GAP;
  let left = card.left;

  const flipped = top + ph > vh - 8;
  if (flipped) top = card.top - ph - GAP;
  if (top < 8) top = 8;

  if (left + pw > vw - 8) left = vw - pw - 8;
  if (left < 8) left = 8;

  previewStyle.top  = `${Math.round(top)}px`;
  previewStyle.left = `${Math.round(left)}px`;
  const cardCenterX = card.left + card.width / 2;
  arrowLeft.value = Math.round(Math.min(Math.max(cardCenterX - left, 16), pw - 24));
  arrowFlipped.value = flipped;
}

function hidePreview() {
  previewVisible.value = false;
}

function onDragStart(event) {
  if (!props.draggableItem) return;
  hidePreview();
  isDragging.value = true;
  const payload = { ownerId: props.memberId, status: props.status, itemId: props.item.id };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  emit("drag-start", payload);
}
function onDragEnd() {
  isDragging.value = false;
  emit("drag-end");
}
</script>