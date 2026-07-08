<template>
  <div
    class="item-card"
    :class="{ dragging: isDragging }"
    :draggable="draggableItem"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="canEdit && $emit('edit', memberId, status, item.id)"
    @mouseenter="showPreview"
    @mouseleave="hidePreview"
  >
    <div class="item-top">
      <div class="item-title">{{ item.work_item || "Untitled Work Item" }}</div>
      <button
        v-if="canEdit"
        class="btn btn-light btn-sm"
        type="button"
        @click.stop="$emit('edit', memberId, status, item.id)"
      >Edit</button>
      <span v-else class="tag">Readonly</span>
    </div>
    <div class="item-meta">
      <span class="tag" :class="priorityClass">{{ item.priority || "Low" }}</span>
      <span class="tag">Create: {{ item.create_date || "-" }}</span>
      <span class="tag">Expect: {{ item.expect_complete_date || "-" }}</span>
      <span class="tag">Tasks: {{ item.tasks.length }}</span>
      <span class="tag">Slots: {{ checkedCount }}/10</span>
    </div>

    <!-- 预览框：fixed 定位，top/left 由 JS 写入 style -->
     <Teleport to="body">
      <div
        ref="previewEl"
        class="item-preview"
        :class="{ 'is-preview-visible': previewVisible, 'is-flipped': arrowFlipped }"
        :style="{ ...previewStyle, '--arrow-left': arrowLeft + 'px' }">
        <div class="item-preview-scroll">
          <div class="preview-title">{{ item.work_item || "Untitled Work Item" }}</div>
          <template v-if="!item.tasks.length">
            <div class="preview-task">暂无 task，点击卡片可新增。</div>
          </template>
          <template v-else>
            <div class="preview-task" v-for="task in item.tasks.slice(0, 4)" :key="task.id || task.task_name">
              <b>{{ task.task_name || "Untitled Task" }}</b>
              <div>{{ truncate(task.description || task.remark_blocker || "", 80) }}</div>
              <div class="preview-slots">
                <span
                  v-for="(key, idx) in PREVIEW_SLOT_KEYS"
                  :key="key"
                  class="preview-slot"
                  :class="{ checked: task.slots?.[key] }"
                >{{ PREVIEW_SLOT_LABELS[idx] }}</span>
              </div>
            </div>
            <div class="preview-task" v-if="item.tasks.length > 4">
              还有 {{ item.tasks.length - 4 }} 条 task...
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, reactive, nextTick } from "vue";
import { PREVIEW_SLOT_KEYS, PREVIEW_SLOT_LABELS } from "../constants/index.js";
import { countCheckedSlots } from "../utils/model.js";
import { truncate } from "../utils/helpers.js";

const props = defineProps({
  item:          { type: Object,  required: true },
  memberId:      { type: String,  required: true },
  status:        { type: String,  required: true },
  canEdit:       { type: Boolean, default: false },
  draggableItem: { type: Boolean, default: false }
});
const emit = defineEmits(["edit", "drag-start", "drag-end"]);

const isDragging    = ref(false);
const previewVisible = ref(false);
const previewEl     = ref(null);
const previewStyle  = reactive({ top: "0px", left: "0px" });

const priorityClass = computed(() =>
  `priority-${String(props.item.priority || "low").toLowerCase()}`
);
const checkedCount = computed(() => countCheckedSlots(props.item));

const arrowLeft = ref(22);
const arrowFlipped = ref(false);  // true = 预览在卡片上方，三角在底部

// 计算预览框 fixed 坐标，确保不超出视口
async function showPreview(event) {
  previewVisible.value = true;
  await nextTick();

  const card    = event.currentTarget.getBoundingClientRect();
  const preview = previewEl.value?.getBoundingClientRect();
  if (!preview) return;

  const GAP      = 8;
  const vw       = window.innerWidth;
  const vh       = window.innerHeight;
  const pw       = preview.width  || 420;
  const ph       = preview.height || 200;

  // 默认：卡片正下方，左对齐卡片左边
  let top  = card.bottom + GAP;
  let left = card.left;

  // 底部放不下 → 改为卡片上方
  const flipped = top + ph > vh - 8;
  if (flipped) top = card.top - ph - GAP;
  // 顶部也放不下 → 贴视口顶部
  if (top < 8) top = 8;

  // 右侧超出 → 向左推
  if (left + pw > vw - 8) left = vw - pw - 8;
  // 左侧超出 → 贴左边
  if (left < 8) left = 8;

  previewStyle.top  = `${Math.round(top)}px`;
  previewStyle.left = `${Math.round(left)}px`;
  // 三角指向卡片水平中心
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
