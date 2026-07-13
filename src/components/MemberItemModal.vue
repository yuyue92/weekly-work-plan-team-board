<template>
  <Transition name="modal-fade">
  <div
    class="modal-backdrop"
    v-if="open && context"
    role="dialog" aria-modal="true" aria-labelledby="memberModalTitle"
  >
    <div class="modal member-modal">
      <div class="modal-header">
        <h3 id="memberModalTitle" class="modal-title">{{ context.displayName }}</h3>
        <div class="modal-subtitle">{{ team }} · {{ weekLabel }}</div>
        <div class="modal-hour-summary">
          <span
            v-for="(key, idx) in hourKeys"
            :key="key"
            class="tag hour-tag"
            :class="hourTagClass(weeklyHours[key])"
          >{{ weekdayLabels[idx] }}: {{ weeklyHours[key] }}</span>
        </div>
        <button class="btn btn-light" type="button" :disabled="saving" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body member-modal-body">
        <section
          v-for="status in STATUS_KEYS"
          :key="status"
          class="member-section"
          :class="{ 'drag-over': dragOverStatus === status }"
          @dragover.prevent="dragOverStatus = status"
          @dragleave="onSectionDragLeave(status, $event)"
          @drop.prevent="onSectionDrop(status)"
        >
          <div class="member-section-header">
            <span class="status-pill" :class="status">{{ statusLabels[status] }}</span>
            <span class="member-section-count">{{ draft[status].length }} item(s)</span>
            <button class="btn btn-outline-primary btn-sm" type="button" @click="$emit('add-item', status)">＋ Work Item</button>
          </div>

          <div v-if="!draft[status].length" class="empty-note">
            Drag a Work Item here, or click "＋ Work Item".
          </div>

          <div
            v-for="(item, itemIndex) in draft[status]"
            :key="item.id || ('new-' + status + '-' + itemIndex)"
            class="member-item-row"
          >
            <div class="member-item-row-main">
                <span
                    class="member-item-drag-handle"
                    draggable="true"
                    title="Drag to move to another status"
                    aria-label="Drag to move to another status"
                    @dragstart="onItemDragStart($event, status, itemIndex)"
                    @dragend="onItemDragEnd"
                >⠿</span>
                <div class="member-item-fields">
                  <div class="form-group">
                    <label>Project</label>
                    <select class="form-select" v-model="item.project_name" @change="$emit('dirty')">
                      <option value="">-</option>
                      <option v-for="p in projectNames" :key="p" :value="p">{{ p }}</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Item Name</label>
                    <input class="form-control" type="text" placeholder="Enter work item" v-model="item.work_item" @input="$emit('dirty')" />
                  </div>
                  <div class="form-group">
                    <label>Ref ID</label>
                    <input class="form-control" type="text" placeholder="Ref ID" v-model="item.ref_id" @input="$emit('dirty')" />
                  </div>
                  <div class="form-group">
                    <label>Expect Complete Date</label>
                    <input class="form-control" type="date" v-model="item.expect_complete_date" @change="$emit('dirty')" />
                  </div>
                  <div class="form-group">
                    <label>Priority</label>
                    <select class="form-select" v-model="item.priority" @change="$emit('dirty')">
                      <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
                    </select>
                  </div>
                  <div class="form-group hours-group" v-for="(key, idx) in hourKeys" :key="key">
                    <!-- <label>{{ weekdayLabels[idx] }}</label> -->
                     <label>
                        {{ weekdayLabels[idx] }}
                        <span class="hours-date">{{ formatMonthDayLabel(weekdayDates[idx]) }}</span>
                    </label>
                    <select class="form-select" v-model.number="item.hours[key]" @change="$emit('dirty')">
                      <option v-for="h in hourOptions" :key="h" :value="h">{{ h }}</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label></label>
                    <button
                      class="btn btn-outline-danger member-item-delete"
                      type="button"
                      :disabled="saving"
                      @click="$emit('delete-item', status, itemIndex)"
                    >Delete Work Item</button>
                  </div>
                </div>
            </div>

            <div class="member-item-tasks">
              <div class="member-tasks-header">
                <span>Tasks</span>
                <button class="btn btn-outline-primary btn-sm" type="button" @click="$emit('add-task', status, itemIndex)">＋ Add Task</button>
              </div>
              <div v-if="!item.tasks.length" class="empty-note small">No tasks yet.</div>
              <div v-for="(task, taskIndex) in item.tasks" :key="task.id || taskIndex" class="member-task-row">
                <input class="form-control" type="text" placeholder="Task Name" v-model="task.task_name" @input="$emit('dirty')" />
                <input class="form-control" type="text" placeholder="Description" v-model="task.description" @input="$emit('dirty')" />
                <input class="form-control" type="text" placeholder="Remark / Blocker" v-model="task.remark_blocker" @input="$emit('dirty')" />
                <button
                  class="btn-icon-danger"
                  type="button"
                  title="Delete task"
                  aria-label="Delete task"
                  @click="$emit('delete-task', status, itemIndex, taskIndex)"
                >🗑</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="modal-footer">
        <span class="save-status">{{ saveHint }}</span>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="$emit('save')">Save &amp; Close</button>
      </div>
      <LoadingOverlay :active="saving" message="Saving..." inline />
    </div>
  </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { STATUS_KEYS } from "../constants/index.js";
import { formatMonthDayLabel } from "../utils/date.js";

import LoadingOverlay from "./LoadingOverlay.vue";

const props = defineProps({
  open:          { type: Boolean, default: false },
  context:       { type: Object,  default: null },   // { memberId, displayName }
  draft:         { type: Object,  required: true },  // { pending:[], processing:[], done:[] }
  team:          { type: String,  default: "" },
  weekLabel:     { type: String,  default: "" },
  statusLabels:  { type: Object,  required: true },
  priorities:    { type: Array,   required: true },
  projectNames:  { type: Array,   required: true },
  hourKeys:      { type: Array,   required: true },
  hourOptions:   { type: Array,   required: true },
  weekdayLabels: { type: Array,   required: true },
  weekdayDates:  { type: Array,   default: () => [] },
  saveHint:      { type: String,  default: "" },
  saving:        { type: Boolean, default: false }
});

const emit = defineEmits([
  "close", "save", "dirty",
  "add-item", "delete-item",
  "add-task", "delete-task",
  "move-item"
]);

// 弹框顶部的 Mon~Fri 工时汇总：基于当前草稿（三个状态段）实时计算，跟着编辑同步刷新
const weeklyHours = computed(() => {
  const totals = Object.fromEntries(props.hourKeys.map(k => [k, 0]));
  STATUS_KEYS.forEach(status => {
    (props.draft[status] || []).forEach(item => {
      props.hourKeys.forEach(k => {
        totals[k] += Number(item.hours?.[k]) || 0;
      });
    });
  });
  return totals;
});
function hourTagClass(value) {
  if (value > 8) return "hour-over";
  if (value === 8) return "hour-full";
  return "";
}

const dragSource     = ref(null); // { status, index }
const dragOverStatus = ref("");

// 弹框打开期间锁住 body 滚动，避免弹框内部滚到顶/底时把滚动"传导"给背后的主页面
let scrolledLocked = false;
function lockBodyScroll() {
  if (scrolledLocked) return;
  scrolledLocked = true;
  document.body.classList.add("body-scroll-locked");
}
function unlockBodyScroll() {
  if (!scrolledLocked) return;
  scrolledLocked = false;
  document.body.classList.remove("body-scroll-locked");
}

watch(() => props.open, (isOpen) => {
  if (isOpen) lockBodyScroll();
  else unlockBodyScroll();
}, { immediate: true });

onBeforeUnmount(unlockBodyScroll); // 组件被卸载时兜底恢复，防止锁死整个页面

function onItemDragStart(event, status, index) {
  dragSource.value = { status, index };
  // 让拖拽时的"影子"是整行卡片，而不是只有一个小手柄图标
  const row = event.currentTarget.closest(".member-item-row");
  if (row && event.dataTransfer.setDragImage) {
    event.dataTransfer.setDragImage(row, 16, 16);
  }
}

function onItemDragEnd() { dragSource.value = null; dragOverStatus.value = ""; }

function onSectionDragLeave(status, event) {
  if (dragOverStatus.value !== status) return;
  if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
  dragOverStatus.value = "";
}
function onSectionDrop(status) {
  dragOverStatus.value = "";
  if (!dragSource.value) return;
  emit("move-item", dragSource.value.status, dragSource.value.index, status);
  dragSource.value = null;
}
</script>