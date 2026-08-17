<template>
  <div class="container">
    <header class="app-header no-print">
      <div class="app-hader-sub">
        <h1 class="app-title">结果汇总</h1>
        <p class="app-subtitle">基于各成员 Weekly Report 归并整理，导出给领导汇报</p>
      </div>
      <div class="header-right">
        <button class="btn btn-outline-primary btn-sm" :disabled="!summaryLoaded" @click="doPrint">导出 PDF（打印）</button>
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
            <input class="form-control" type="number" min="2000" max="2100" :value="state.year" @change="onYearChange($event.target.value)" />
          </div>
          <div class="form-group week-group">
            <label>Week</label>
            <select class="form-select" :value="state.weekKey" @change="onWeekChange($event.target.value)">
              <option v-for="week in weekOptions" :key="week.key" :value="week.key">{{ week.label }}</option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <LoadingOverlay :active="loading" message="Loading..." />

    <div v-if="!loading" class="summary-layout no-print">
      <section class="card summary-source">
        <div class="card-body">
          <div class="summary-source-header">
            <h2 class="section-title">成员 Weekly Report</h2>
            <button class="btn btn-outline-primary btn-sm" :disabled="!members.length" @click="insertAllMembers">
              一键插入全部成员
            </button>
          </div>
          <div v-if="!members.length" class="empty-note">该 Team 本周暂无成员数据</div>
          <div v-for="member in members" :key="member.userId" class="source-member-card">
            <div class="source-member-head">
              <span class="member-name">{{ member.displayName }}</span>
              <button class="btn btn-light btn-sm" @click="insertMember(member)">插入到汇总</button>
            </div>
            <pre class="source-member-text">{{ member.reportText || '(未填写 Weekly Report)' }}</pre>
          </div>
        </div>
      </section>

      <section class="card summary-editor">
        <div class="card-body">
          <div class="summary-editor-header">
            <h2 class="section-title">汇总编辑</h2>
            <span class="save-status">{{ saveHint }}</span>
          </div>
          <TiptapEditor ref="editorRef" v-model="draftHtml" @update:modelValue="onDraftChange" />
          <div class="summary-editor-actions">
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
        <div class="print-logo">PCCW <span>Solutions</span><sup>®</sup></div>
        <div class="print-meta">
          <div class="print-title">{{ state.teamName }} · {{ weekLabel }} 工作结果汇总</div>
          <div class="print-sub">导出时间：{{ exportedAtText }}</div>
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
  state, teamsData, weekOptions, members, loading,
  summaryRecord, summarySaving,
  initTeams, onTeamChange, onYearChange, onWeekChange,
  saveSummary, weekLabel
} = useWeeklySummary();

const editorRef  = ref(null);
const draftHtml  = ref("");
const saveHint   = ref("");
const summaryLoaded = computed(() => !loading.value);

const toastMsg = ref(""), toastType = ref("info"), toastVisible = ref(false);
let toastTimer = null;
function showToast(msg, type = "info") {
  toastMsg.value = msg; toastType.value = type; toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible.value = false; }, type === "error" ? 3200 : 1800);
}

const exportedAtText = computed(() => {
  const now = new Date();
  return `${formatDate(now)} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
});

watch(summaryRecord, (record) => {
  draftHtml.value = record?.content_html || "";
  saveHint.value = record?.updated_at
    ? `已保存 · ${String(record.updated_at).slice(0, 16).replace("T", " ")}`
    : "尚未保存";
}, { immediate: true });

function onDraftChange() { saveHint.value = "有未保存的修改"; }

function reportToHtml(member) {
  const lines = String(member.reportText || "").split("\n").filter(Boolean);
  const body = lines.length
    ? lines.map(line => `<p>${escapeHtml(line)}</p>`).join("")
    : `<p>(未填写 Weekly Report)</p>`;
  return `<h3>${escapeHtml(member.displayName)}</h3>${body}`;
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function insertMember(member) { editorRef.value?.insertHtmlAtCursor(reportToHtml(member)); onDraftChange(); }
function insertAllMembers() {
  const html = members.value.map(reportToHtml).join("");
  editorRef.value?.insertHtmlAtCursor(html);
  onDraftChange();
}

async function doSave() {
  const { error } = await saveSummary(draftHtml.value, currentUser.value.id);
  if (error) { showToast("保存失败：" + (error.message || String(error)), "error"); return; }
  saveHint.value = "已保存 · 刚刚";
  showToast("已保存", "success");
}

function doPrint() { window.print(); }

onMounted(initTeams);
</script>

<style scoped>
.summary-layout { display: grid; grid-template-columns: 1fr 1.3fr; gap: 16px; align-items: start; }
.summary-source-header, .summary-editor-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.source-member-card { border: 1px solid var(--border-color, #e2e8f0); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
.source-member-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.source-member-text { white-space: pre-wrap; font-family: inherit; font-size: 13px; color: #475569; margin: 0; max-height: 160px; overflow-y: auto; }
.summary-editor-actions { margin-top: 12px; display: flex; justify-content: flex-end; }
.save-status { font-size: 12px; color: #94a3b8; }
.print-only { display: none; }
</style>