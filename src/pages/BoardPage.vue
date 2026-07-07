<template>
  <div class="container">
    <header class="app-header">
      <div class="app-hader-sub">
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

    <AppToolbar
      :teams="teamsData"
      :state="state"
      :week-options="weekOptions"
      :start-date-display="startDateDisplay"
      :end-date-display="endDateDisplay"
      :is-admin="isAdmin"
      @team-change="onTeamChange"
      @year-change="onYearChange"
      @week-change="onWeekChange"
      @export="exportJson"
      @clear-week="clearCurrentWeek"
    />

    <div v-if="boardLoading" class="board-loading">Loading...</div>

    <BoardTable
      v-else
      :board-title="boardTitle"
      :members="currentMembers"
      :get-member-items="getMemberItems"
      :current-user-id="currentUser.id"
      :is-admin="isAdmin"
      @add-item="onAddItem"
      @edit-item="openItemModal"
      @drop-item="handleItemDrop"
    />
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
  boardLoading,
  toastMessage, toastVisible,
  modalOpen, modalContext, modalDraft, modalSaveHint, modalSaving,
  boardTitle, startDateDisplay, endDateDisplay,
  init,
  onTeamChange, onYearChange, onWeekChange,
  getMemberItems,
  addItem, openItemModal, closeModal, updateModalSaveHint,
  saveModalAndClose, deleteCurrentItem,
  addTaskToCurrentItem, deleteTaskFromCurrentItem,
  handleItemDrop, clearCurrentWeek,
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

onMounted(() => init());
</script>
