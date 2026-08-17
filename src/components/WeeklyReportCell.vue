<template>
  <div
    class="weekly-report-editor"
    :class="{ 'is-readonly': !editable }"
  >
    <textarea
      v-model="draft"
      class="form-control weekly-report-textarea"
      :readonly="!editable"
      :placeholder="
        editable
          ? 'Enter weekly report...'
          : 'No weekly report'
      "
    ></textarea>

    <div
      v-if="editable"
      class="weekly-report-actions"
    >
      <button
        type="button"
        class="btn btn-outline-primary btn-sm weekly-report-action-btn"
        :disabled="saving"
        title="Import current Pending / Processing / Done items"
        @click="importItems"
      >
        Import Items
      </button>

      <button
        type="button"
        class="btn btn-primary btn-sm weekly-report-action-btn"
        :disabled="saving"
        @click="submitReport"
      >
        {{ saving ? "Submitting..." : "Save" }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { totalWeeklyHours } from "../utils/model.js";

const props = defineProps({
  reportText: {
    type: String,
    default: ""
  },

  editable: {
    type: Boolean,
    default: false
  },

  saving: {
    type: Boolean,
    default: false
  },

  pendingItems: {
    type: Array,
    default: () => []
  },

  processingItems: {
    type: Array,
    default: () => []
  },

  doneItems: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["submit"]);

const draft = ref(props.reportText || "");

watch(
  () => props.reportText,
  value => {
    draft.value = value || "";
  }
);


/**
 * 一个 Work Item 一行。
 *
 * 正常情况下使用 Work Item Name。
 * 如果历史数据没有 Work Item Name，则依次使用：
 * Project -> 第一个 Task -> Untitled Work Item
 */
function getItemText(item) {
  const workItem = String(item?.work_item || "").trim();
  if (workItem) return workItem;

  const project = String(item?.project_name || "").trim();
  if (project) return project;

  const taskName = (item?.tasks || [])
    .map(task => String(task?.task_name || "").trim())
    .find(Boolean);

  if (taskName) return taskName;

  return "(Untitled Work Item)";
}

function getItemReportLine(item) {
  const hours = Number(totalWeeklyHours(item)) || 0;
  return `${getItemText(item)} (${hours}h)`;
}


function buildSection(label, items) {
  if (!items?.length) return "";

  return [
    label,
    ...items.map(item => `  • ${getItemReportLine(item)}`)
  ].join("\n");
}


/**
 * 固定顺序：
 * Pending -> Processing -> Done
 *
 * 空状态不输出。
 */
function buildImportedText() {
  return [
    buildSection("Pending", props.pendingItems),
    buildSection("Processing", props.processingItems),
    buildSection("Done", props.doneItems)
  ]
    .filter(Boolean)
    .join("\n\n");
}


function importItems() {
  if (!props.editable || props.saving) return;

  const importedText = buildImportedText();

  // 当前三列完全没有 Item，不修改 textarea
  if (!importedText) return;

  /*
   * 无论是数据库中已有正文，
   * 还是当前 textarea 中已经手工输入了正文，
   * 再次导入都必须确认，避免覆盖。
   */
  if (draft.value.trim()) {
    const confirmed = confirm(
      "Weekly Report already contains content.\n\n" +
      "Importing the current Pending / Processing / Done items " +
      "will overwrite the existing text.\n\n" +
      "Continue?"
    );

    if (!confirmed) return;
  }

  draft.value = importedText;
}


function submitReport() {
  if (!props.editable || props.saving) return;

  emit("submit", String(draft.value ?? ""));
}
</script>