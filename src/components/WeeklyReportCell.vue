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

    <div class="weekly-report-actions">

      <button
        type="button"
        class="btn btn-outline-secondary btn-sm weekly-report-copy-btn"
        :class="{ copied: copyState === 'success', failed: copyState === 'error' }"
        :disabled="!draft.trim() || (editable && saving)"
        :title="
          copyState === 'success'
            ? 'Copied!'
            : copyState === 'error'
              ? 'Copy failed, please copy manually'
              : 'Copy report text'
        "
        @click="copyReport"
      >
        <svg
          v-if="copyState !== 'success'"
          class="copy-icon"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="3.2" y="3.2" width="10.6" height="10.6" rx="2" stroke="currentColor" stroke-width="1.4" opacity="0.55" />
          <rect x="6.2" y="6.2" width="10.6" height="10.6" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.4" />
        </svg>
        <svg
          v-else
          class="copy-icon"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M4.5 10.5L8.2 14L15.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <template v-if="editable">
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
      </template>
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

// ── 快捷复制（参考 copy-widget-demo.html 的场景5：输入框）──
// 复制的是 textarea 里当前的实时内容（draft），而不是进入组件时的初始 props.reportText
const copyState = ref("idle"); // idle | success | error
let copyStateTimer = null;

async function copyPlainText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // 兼容不支持 Clipboard API 的环境（例如非 HTTPS 或旧浏览器）
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}

async function copyReport() {
  const text = String(draft.value || "");
  if (!text.trim()) return;

  const ok = await copyPlainText(text);

  clearTimeout(copyStateTimer);
  copyState.value = ok ? "success" : "error";
  copyStateTimer = setTimeout(() => { copyState.value = "idle"; }, 1400);
}

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