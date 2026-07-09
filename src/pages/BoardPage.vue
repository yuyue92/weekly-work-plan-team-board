<template>
  <div class="container">
    <header class="app-header">
      <div class="app-hader-sub">
        <div class="logo">
          <span class="logo-pccw">PCCW</span>
          <span class="logo-solutions">Solutions</span>
          <span class="logo-registered">®</span>
        </div>
        <h1 class="app-title">Weekly Work Plan</h1>
        <p class="app-subtitle">Team board version: Pending / Processing / Done, task-level half-day schedule.</p>
      </div>
      <div class="header-right">
        <span class="badge">{{ currentUser.displayName || currentUser.email }}</span>
        <span class="badge badge-role" :class="isAdmin ? 'badge-admin' : 'badge-staff'">
          {{ isAdmin ? 'Admin' : 'Staff' }}
        </span>
        <button v-if="isAdmin" class="btn btn-outline-primary btn-sm" @click="$router.push('/admin')">
          成员管理
        </button>
        <button class="btn btn-light btn-sm" @click="doSignOut">退出</button>
      </div>
    </header>

    <div v-if="noTeamMessage" class="card no-team-card">
      <div class="card-body">
        <h2 class="no-team-title">暂无可用 Team</h2>
        <p class="no-team-message">{{ noTeamMessage }}</p>
        <button class="btn btn-light btn-sm" type="button" @click="doSignOut">
          退出登录
        </button>
      </div>
    </div>

    <template v-else>
      <AppToolbar
        :teams="teamsData"
        :state="state"
        :week-options="weekOptions"
        :members="currentMembers"
        :import-state="importState"
        :import-week-options="importWeekOptions"
        :import-saving="importSaving"
        :start-date-display="startDateDisplay"
        :end-date-display="endDateDisplay"
        :is-admin="isAdmin"
        @team-change="onTeamChange"
        @year-change="onYearChange"
        @week-change="onWeekChange"
        @export="exportJson"
        @clear-week="clearCurrentWeek"
        @import-owner-change="onImportOwnerChange"
        @import-source-year-change="onImportSourceYearChange"
        @import-source-week-change="onImportSourceWeekChange"
        @copy-member-week="copySelectedMemberWeek"
      />
      <div v-if="boardLoading" class="board-loading">Loading...</div>
  
      <BoardTable
        v-else
        :board-title="boardTitle"
        :members="currentMembers"
        :get-member-items="getMemberItems"
        :current-user-id="currentUser.id"
        :is-admin="isAdmin"
        :copying-item-ids="copyingItemIds"
        @add-item="onAddItem"
        @edit-item="openItemModal"
        @drop-item="handleItemDrop"
        @move-member-up="moveMemberUp"
        @copy-item-week="copyItemToAdjacentWeek"
      />
    </template>


  </div>

  <ItemModal
    :open="modalOpen"
    :draft="modalDraft"
    :context="modalContext"
    :team="state.teamName"
    :status-labels="STATUS_LABELS"
    :save-hint="modalSaveHint"
    :saving="modalSaving"
    @close="closeModal"
    @save="saveModalAndClose"
    @add-task="addTaskToCurrentItem"
    @delete-task="deleteTaskFromCurrentItem"
    @delete-item="deleteCurrentItem"
    @input-change="() => updateModalSaveHint(true)"
    @task-field-change="onTaskFieldChange"
    @task-slot-change="onTaskSlotChange"
  />

  <ToastMessage :message="toastMessage" :visible="toastVisible" />
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import AppToolbar  from "../components/AppToolbar.vue";
import BoardTable  from "../components/BoardTable.vue";
import ItemModal   from "../components/ItemModal.vue";
import ToastMessage from "../components/ToastMessage.vue";
import { useAuth }        from "../composables/useAuth.js";
import { useBoardStore }  from "../composables/useBoardStore.js";

const router = useRouter();
const { currentUser, isAdmin, signOut } = useAuth();

const {
  STATUS_LABELS,
  state, weekOptions, teamsData, currentMembers,
  boardLoading, noTeamMessage,
  toastMessage, toastVisible,
  modalOpen, modalContext, modalDraft, modalSaveHint, modalSaving,
  importState, importWeekOptions, importSaving,
  boardTitle, startDateDisplay, endDateDisplay,
  init,
  onTeamChange, onYearChange, onWeekChange,
  getMemberItems,
  moveMemberUp,
  addItem, openItemModal, closeModal, updateModalSaveHint,
  saveModalAndClose, deleteCurrentItem,
  addTaskToCurrentItem, deleteTaskFromCurrentItem,
  handleItemDrop, clearCurrentWeek,
  onImportOwnerChange,
  onImportSourceYearChange,
  onImportSourceWeekChange,
  copySelectedMemberWeek,
  copyingItemIds, copyItemToAdjacentWeek,
  exportJson
} = useBoardStore();

async function doSignOut() {
  await signOut();
  router.push({ name: "Login" });
}

// 新增 item 时，把 displayName 也传过去
function onAddItem(userId, status) {
  const member = currentMembers.value.find(m => m.userId === userId);
  addItem(userId, member?.displayName || "", status);
}

function onTaskFieldChange(index, field, value) {
  if (!modalDraft.value) return;
  const task = modalDraft.value.tasks[index];
  if (!task) return;
  task[field] = value;
  updateModalSaveHint(true);
}

function onTaskSlotChange(index, slotKey, checked) {
  if (!modalDraft.value) return;
  const task = modalDraft.value.tasks[index];
  if (!task) return;
  task.slots[slotKey] = checked;
  updateModalSaveHint(true);
}

onMounted(() => init({
  userId: currentUser.value.id,
  isAdmin: isAdmin.value
}));
</script>
