<template>
  <tr>
    <td class="task-name-col">
      <input
        class="form-control"
        placeholder="Task Name"
        :value="task.task_name"
        @input="updateField('task_name', $event.target.value)"
      />
    </td>
    <td class="task-desc-col">
      <textarea
        class="form-control"
        placeholder="Description"
        :value="task.description"
        @input="updateField('description', $event.target.value)"
      ></textarea>
    </td>
    <td class="date-range-col">
      <div class="date-range-grid">
        <div class="slot-row">
          <div class="slot-row-label">AM</div>
          <label class="slot-check" v-for="(key, i) in amKeys" :key="key">
            <input
              type="checkbox"
              :checked="task.slots?.[key]"
              @change="updateSlot(key, $event.target.checked)"
            />
            <span>{{ WEEKDAY_LABELS[i] }}</span>
          </label>
        </div>
        <div class="slot-row">
          <div class="slot-row-label">PM</div>
          <label class="slot-check" v-for="(key, i) in pmKeys" :key="key">
            <input
              type="checkbox"
              :checked="task.slots?.[key]"
              @change="updateSlot(key, $event.target.checked)"
            />
            <span>{{ WEEKDAY_LABELS[i] }}</span>
          </label>
        </div>
      </div>
    </td>
    <td class="remark-col">
      <textarea
        class="form-control"
        placeholder="Remark / Blocker"
        :value="task.remark_blocker"
        @input="updateField('remark_blocker', $event.target.value)"
      ></textarea>
    </td>
    <td class="task-actions-col">
      <button class="btn btn-outline-danger btn-sm" type="button" @click="$emit('delete', index)">删除</button>
    </td>
  </tr>
</template>

<script setup>
import { computed } from "vue";
import { SLOT_KEYS, WEEKDAY_LABELS } from "../constants/index.js";

const props = defineProps({
  task:  { type: Object, required: true },
  index: { type: Number, required: true }
});
const emit = defineEmits(["update-field", "update-slot", "delete"]);

const amKeys = computed(() => SLOT_KEYS.slice(0, 5));
const pmKeys = computed(() => SLOT_KEYS.slice(5, 10));

function updateField(field, value) { emit("update-field", props.index, field, value); }
function updateSlot(key, checked)  { emit("update-slot",  props.index, key, checked); }
</script>
