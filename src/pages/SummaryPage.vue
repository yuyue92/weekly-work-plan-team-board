<template>
  <div class="container">
    <header class="app-header no-print">
      <div class="app-hader-sub">
        <h1 class="app-title">Summary Report</h1>
        <p class="app-subtitle">Compiled from each member's Weekly Report, ready to export for management</p>
      </div>
      <div class="header-right">
        <button class="btn btn-outline-primary btn-sm" :disabled="!summaryLoaded" @click="doPrint">
          Export PDF (Print)
        </button>
        <button class="btn btn-light btn-sm" @click="$router.push('/')">← Back to Board</button>
      </div>
    </header>

    <section class="card no-print">
      <div class="card-body">
        <div class="toolbar">
          <div class="form-group team-group">
            <label>Team</label>
            <select class="form-select" :value="state.teamId" @change="onTeamChange($event.target.value)">
              <option v-for="team in teamsData" :key="team.id" :value="team.id">{{ team.name }}</option>
            </select>
          </div>
          <div class="form-group year-group">
            <label>Year</label>
            <input
              class="form-control"
              type="number"
              min="2000"
              max="2100"
              :value="state.year"
              @change="onYearChange($event.target.value)"
            />
          </div>
          <div class="form-group week-group">
            <label>Week</label>
            <div class="week-switcher">
              <button
                class="week-nav-btn"
                type="button"
                title="Previous Week"
                aria-label="Switch to previous week"
                :disabled="!canGoPreviousWeek"
                @click="switchWeek(-1)"
              >
                ‹
              </button>
              <select class="form-select" :value="state.weekKey" @change="onWeekChange($event.target.value)">
                <option v-for="week in weekOptions" :key="week.key" :value="week.key">{{ week.label }}</option>
              </select>
              <button
                class="week-nav-btn"
                type="button"
                title="Next Week"
                aria-label="Switch to next week"
                :disabled="!canGoNextWeek"
                @click="switchWeek(1)"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <LoadingOverlay :active="loading" message="Loading..." />

    <div v-if="!loading" class="summary-layout no-print">
      <section class="card summary-source">
        <div class="card-body">
          <div class="summary-source-header">
            <h2 class="section-title">Member Weekly Reports</h2>
            <button class="btn btn-outline-primary btn-sm" :disabled="!members.length" @click="insertAllMembers">
              Insert All Members
            </button>
          </div>
          <div v-if="!members.length" class="empty-note">No member data for this team this week</div>
          <div v-for="member in members" :key="member.userId" class="source-member-card">
            <div class="source-member-head">
              <span class="member-name">{{ member.displayName }}</span>
              <button class="btn btn-light btn-sm" @click="insertMember(member)">Insert into Summary</button>
            </div>
            <pre class="source-member-text">{{ member.reportText || "(No Weekly Report submitted)" }}</pre>
          </div>
        </div>
      </section>

      <section class="card summary-editor">
        <div class="card-body">
          <div class="summary-editor-header">
            <h2 class="section-title">Summary Editor</h2>
            <span class="save-status">{{ saveHint }}</span>
          </div>
          <TiptapEditor ref="editorRef" v-model="draftHtml" @update:modelValue="onDraftChange" />
          <div class="summary-editor-actions">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm summary-copy-btn"
              :class="{ copied: copyState === 'success', failed: copyState === 'error' }"
              :disabled="!summaryPlainText.trim()"
              :title="
                copyState === 'success'
                  ? 'Copied!'
                  : copyState === 'error'
                    ? 'Copy failed, please copy manually'
                    : 'Copy summary text'
              "
              @mousedown.prevent
              @click="copySummary"
            >
              <svg
                v-if="copyState !== 'success'"
                class="copy-icon"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect
                  x="3.2"
                  y="3.2"
                  width="10.6"
                  height="10.6"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="1.4"
                  opacity="0.55"
                />
                <rect
                  x="6.2"
                  y="6.2"
                  width="10.6"
                  height="10.6"
                  rx="2"
                  fill="#fff"
                  stroke="currentColor"
                  stroke-width="1.4"
                />
              </svg>
              <svg
                v-else
                class="copy-icon"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M4.5 10.5L8.2 14L15.5 6"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button class="btn btn-primary btn-sm" :disabled="summarySaving" @click="doSave">
              {{ summarySaving ? "Saving..." : "Save" }}
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- 打印专用区域：只在打印时可见，样式独立于编辑态 UI -->
    <div class="print-only print-summary">
      <div class="print-summary-header">
        <div class="print-meta">
          <div class="print-title">{{ state.teamName }} · {{ weekLabel }} Work Summary</div>
          <div class="print-sub">Exported：{{ exportedAtText }}</div>
        </div>
      </div>
      <div class="print-summary-body" v-html="draftHtml"></div>
      <div class="print-summary-footer">PCCW Solutions · Weekly Work Plan</div>
    </div>

    <ToastMessage :message="toastMsg" :type="toastType" :visible="toastVisible" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useAuth } from "../composables/useAuth.js";
import { useWeeklySummary } from "../composables/useWeeklySummary.js";
import { formatDate } from "../utils/date.js";
import LoadingOverlay from "../components/LoadingOverlay.vue";
import TiptapEditor from "../components/TiptapEditor.vue";
import ToastMessage from "../components/ToastMessage.vue";

const { currentUser } = useAuth();
const {
  state,
  teamsData,
  weekOptions,
  members,
  loading,
  summaryRecord,
  summarySaving,
  initTeams,
  onTeamChange,
  onYearChange,
  onWeekChange,
  saveSummary,
  weekLabel,
} = useWeeklySummary();

// ── 上一周 / 下一周 切换（逻辑与 AppToolbar.vue 保持一致）──
const selectedWeekIndex = computed(() => weekOptions.value.findIndex((week) => week.key === state.weekKey));
const canGoPreviousWeek = computed(() => selectedWeekIndex.value > 0);
const canGoNextWeek = computed(
  () => selectedWeekIndex.value >= 0 && selectedWeekIndex.value < weekOptions.value.length - 1
);
function switchWeek(offset) {
  const targetWeek = weekOptions.value[selectedWeekIndex.value + offset];
  if (targetWeek) onWeekChange(targetWeek.key);
}

const editorRef = ref(null);
const draftHtml = ref("");
const saveHint = ref("");
const summaryLoaded = computed(() => !loading.value);

// ── 快捷复制（Summary Editor 内容，HTML 转纯文本后复制）──
const copyState = ref("idle"); // idle | success | error
let copyStateTimer = null;

function htmlToPlainText(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  // p / h2 / h3 / li 等块级标签结束后补一个换行，避免所有文字挤在一行
  container.querySelectorAll("p, h1, h2, h3, h4, li, br").forEach((el) => {
    el.insertAdjacentText("afterend", "\n");
  });
  return (container.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

const summaryPlainText = computed(() => htmlToPlainText(draftHtml.value));

async function copyPlainText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

async function copySummary() {
  const text = summaryPlainText.value;
  if (!text) return;

  const ok = await copyPlainText(text);
  clearTimeout(copyStateTimer);
  copyState.value = ok ? "success" : "error";
  copyStateTimer = setTimeout(() => {
    copyState.value = "idle";
  }, 1400);
}

const toastMsg = ref(""),
  toastType = ref("info"),
  toastVisible = ref(false);
let toastTimer = null;
function showToast(msg, type = "info") {
  toastMsg.value = msg;
  toastType.value = type;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      toastVisible.value = false;
    },
    type === "error" ? 3200 : 1800
  );
}

const exportedAtText = computed(() => {
  const now = new Date();
  return `${formatDate(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
});

watch(
  summaryRecord,
  (record) => {
    draftHtml.value = record?.content_html || "";
    saveHint.value = record?.updated_at
      ? `Saved · ${String(record.updated_at).slice(0, 16).replace("T", " ")}`
      : "Not saved ye";
  },
  { immediate: true }
);

function onDraftChange() {
  saveHint.value = "Unsaved changes";
}

function reportToHtml(member) {
  const lines = String(member.reportText || "")
    .split("\n")
    .filter(Boolean);
  const body = lines.length
    ? lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
    : `<p>(No Weekly Report submitted)</p>`;
  return `<h3>${escapeHtml(member.displayName)}</h3>${body}`;
}
function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

function insertMember(member) {
  editorRef.value?.insertHtmlAtCursor(reportToHtml(member));
  onDraftChange();
}
function insertAllMembers() {
  const html = members.value.map(reportToHtml).join("");
  editorRef.value?.insertHtmlAtCursor(html);
  onDraftChange();
}

async function doSave() {
  const { error } = await saveSummary(draftHtml.value, currentUser.value.id);
  if (error) {
    showToast("Save failed:" + (error.message || String(error)), "error");
    return;
  }
  saveHint.value = "Saved · just now";
  showToast("Saved", "success");
}

function doPrint() {
  window.print();
}

onMounted(initTeams);
</script>

<style scoped>
.summary-layout {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 16px;
  align-items: start;
}
.summary-source-header,
.summary-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.source-member-card {
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.source-member-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 15px;
}
.source-member-text {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 13px;
  color: #475569;
  margin: 0;
  max-height: 160px;
  overflow-y: auto;
}
.summary-editor-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
.save-status {
  font-size: 12px;
  color: #94a3b8;
}
.summary-editor {
  overflow: visible;
}
.print-only {
  display: none;
}
</style>
