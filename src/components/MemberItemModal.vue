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
                    <label>Item Name</label>
                    <input class="form-control" type="text" placeholder="Enter work item" v-model="item.work_item" @input="$emit('dirty')" />
                  </div>
                  <div class="form-group">
                    <label>Project</label>
                    <select class="form-select" v-model="item.project_name" @change="$emit('dirty')">
                      <option value="">-</option>
                      <option v-for="p in projectNames" :key="p" :value="p">{{ p }}</option>
                    </select>
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
                    <label>{{ weekdayLabels[idx] }}</label>
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
import { ref } from "vue";
import { STATUS_KEYS } from "../constants/index.js";
import LoadingOverlay from "./LoadingOverlay.vue";

defineProps({
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
  saveHint:      { type: String,  default: "" },
  saving:        { type: Boolean, default: false }
});

const emit = defineEmits([
  "close", "save", "dirty",
  "add-item", "delete-item",
  "add-task", "delete-task",
  "move-item"
]);

const dragSource     = ref(null); // { status, index }
const dragOverStatus = ref("");

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