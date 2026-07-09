<template>
  <Transition name="modal-fade">
    <div
      class="modal-backdrop"
      v-if="open && draft"
      role="dialog" aria-modal="true" aria-labelledby="itemModalTitle"
    >
      <div class="modal">
        <div class="modal-header">
          <h3 id="itemModalTitle" class="modal-title">Edit Work Item</h3>
          <span class="modal-subtitle">{{ subtitle }}</span>
          <button class="btn btn-light" type="button" :disabled="saving" @click="$emit('close')">Close</button>
        </div>
  
        <div class="modal-body">
          <div class="workitem-grid">
            <div class="form-group">
              <label for="modalWorkItem">Work Item</label>
              <input
                id="modalWorkItem"
                ref="workItemInput"
                class="form-control"
                type="text"
                placeholder="Enter work item"
                v-model="draft.work_item"
                @input="$emit('input-change')"
              />
            </div>
            <div class="form-group">
              <label for="modalExpectDate">Expect Complete Date</label>
              <input
                id="modalExpectDate"
                class="form-control"
                type="date"
                v-model="draft.expect_complete_date"
                @change="$emit('input-change')"
              />
            </div>
            <div class="form-group">
              <label for="modalCreateDate">Create Date</label>
              <input
                id="modalCreateDate"
                class="form-control"
                type="date"
                v-model="draft.create_date"
                @change="$emit('input-change')"
              />
            </div>
            <div class="form-group">
              <label for="modalPriority">Priority</label>
              <select
                id="modalPriority"
                class="form-select"
                v-model="draft.priority"
                @change="$emit('input-change')"
              >
                <option v-for="p in PRIORITIES" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div class="form-group">
              <label for="modalStatus">Status</label>
              <select
                id="modalStatus"
                class="form-select"
                v-model="draft.status"
                @change="$emit('input-change')"
              >
                <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
          </div>
  
          <div class="tasks-header">
            <div class="tasks-title">Tasks</div>
            <button class="btn btn-outline-primary btn-sm" type="button" @click="$emit('add-task')">＋ Add Task</button>
          </div>
  
          <div class="tasks-table-wrap">
            <table class="tasks-table" aria-label="Work item tasks table">
              <thead>
                <tr>
                  <th class="task-name-col">Task Name</th>
                  <th class="task-desc-col">Description</th>
                  <th class="date-range-col">Date Range</th>
                  <th class="remark-col">Remark/Blocker</th>
                  <th class="task-actions-col">Action</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="draft.tasks.length">
                  <TaskRow
                    v-for="(task, index) in draft.tasks"
                    :key="task.id || index"
                    :task="task"
                    :index="index"
                    @update-field="onTaskFieldUpdate"
                    @update-slot="onTaskSlotUpdate"
                    @delete="(idx) => $emit('delete-task', idx)"
                  />
                </template>
                <tr v-else>
                  <td colspan="5" style="text-align:center;color:#94a3b8;padding:18px;">
                    No tasks yet. Click “＋ Add Task” in the upper-right corner.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
  
        <div class="modal-footer">
          <button
            class="btn btn-outline-danger"
            type="button"
            :disabled="saving"
            @click="$emit('delete-item')"
          >Delete Work Item</button>
          <div class="actions">
            <span class="save-status">{{ saving ? "Saving..." : saveHint }}</span>
            <button
              class="btn btn-primary"
              type="button"
              :disabled="saving"
              @click="$emit('save')"
            >Save &amp; Close</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import TaskRow from "./TaskRow.vue";
import { PRIORITIES } from "../constants/index.js";

const props = defineProps({
  open:        { type: Boolean, default: false },
  draft:       { type: Object,  default: null },
  context:     { type: Object,  default: null },
  team:        { type: String,  default: "" },
  statusLabels:{ type: Object,  required: true },
  saveHint:    { type: String,  default: "" },
  saving:      { type: Boolean, default: false }
});

const emit = defineEmits([
  "close", "save", "add-task", "delete-task", "delete-item",
  "input-change", "task-field-change", "task-slot-change"
]);

const workItemInput = ref(null);

const subtitle = computed(() => {
  if (!props.context) return "";
  return `${props.team} / ${props.context.ownerName} / ${props.statusLabels[props.context.status]}`;
});

function onTaskFieldUpdate(index, field, value) {
  emit("task-field-change", index, field, value);
}
function onTaskSlotUpdate(index, slotKey, checked) {
  emit("task-slot-change", index, slotKey, checked);
}

watch(() => props.open, isOpen => {
  if (isOpen) nextTick(() => workItemInput.value?.focus());
});
</script>
