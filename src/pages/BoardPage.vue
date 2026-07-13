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
        <p class="app-subtitle">Team board version: Pending / Processing / Done.</p>
      </div>
      <div class="header-right">
        <span class="badge">{{ currentUser.displayName || currentUser.email }}</span>
        <span class="badge badge-role" :class="isAdmin ? 'badge-admin' : 'badge-staff'">
          {{ isAdmin ? 'Admin' : 'Staff' }}
        </span>
        <button v-if="isAdmin" class="btn btn-outline-primary btn-sm" @click="$router.push('/admin')">Admin Settings</button>
        <button class="btn btn-light btn-sm" @click="doSignOut">Sign Out</button>
      </div>
    </header>

    <div v-if="noTeamMessage" class="card no-team-card">
      <div class="card-body">
        <h2 class="no-team-title">No Team Available</h2>
        <p class="no-team-message">{{ noTeamMessage }}</p>
        <button class="btn btn-light btn-sm" type="button" @click="doSignOut">Log Out</button>
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
      <div class="board-area">
        <BoardTable
          :board-title="boardTitle"
          :members="currentMembers"
          :get-member-items="getMemberItems"
          :current-user-id="currentUser.id"
          :is-admin="isAdmin"
          :copying-item-ids="copyingItemIds"
          @edit-member="openMemberModal"
          @drop-item="handleItemDrop"
          @move-member-up="moveMemberUp"
          @copy-item-week="copyItemToAdjacentWeek"
        />
        <LoadingOverlay :active="boardLoading" message="Loading..." />
      </div>
    </template>
  </div>

  <MemberItemModal
    :open="memberModalOpen"
    :context="memberModalContext"
    :draft="memberModalDraft"
    :team="state.teamName"
    :week-label="boardTitle"
    :status-labels="STATUS_LABELS"
    :priorities="priorities"
    :project-names="projectNames"
    :hour-keys="HOUR_KEYS"
    :hour-options="hourOptions"
    :weekday-labels="WEEKDAY_LABELS"
    :weekday-dates="currentWeekDays"
    :save-hint="memberModalSaveHint"
    :saving="memberModalSaving"
    @close="closeMemberModal"
    @save="saveMemberModalAndClose"
    @dirty="markMemberModalDirty"
    @add-item="addDraftItem"
    @delete-item="deleteDraftItem"
    @add-task="addDraftTask"
    @delete-task="deleteDraftTask"
    @move-item="moveDraftItem"
  />

  <ToastMessage :message="toastMessage" :visible="toastVisible" />
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import AppToolbar  from "../components/AppToolbar.vue";
import BoardTable  from "../components/BoardTable.vue";
import MemberItemModal from "../components/MemberItemModal.vue";
import LoadingOverlay from "../components/LoadingOverlay.vue";

import ToastMessage from "../components/ToastMessage.vue";
import { useAuth }        from "../composables/useAuth.js";
import { useBoardStore }  from "../composables/useBoardStore.js";
import { STATUS_LABELS, HOUR_KEYS, WEEKDAY_LABELS } from "../constants/index.js";

const router = useRouter();
const { currentUser, isAdmin, signOut } = useAuth();

const {
  state, weekOptions, teamsData, currentMembers,
  boardLoading, noTeamMessage,
  toastMessage, toastVisible,
  projectNames, priorities, hourOptions,
  memberModalOpen, memberModalContext, memberModalDraft, memberModalSaveHint, memberModalSaving,
  importState, importWeekOptions, importSaving,
  boardTitle, startDateDisplay, endDateDisplay, currentWeekDays,
  copyingItemIds, copyItemToAdjacentWeek,
  init,
  onTeamChange, onYearChange, onWeekChange,
  getMemberItems,
  moveMemberUp,
  openMemberModal, closeMemberModal, markMemberModalDirty,
  addDraftItem, deleteDraftItem, addDraftTask, deleteDraftTask, moveDraftItem,
  saveMemberModalAndClose,
  handleItemDrop, clearCurrentWeek,
  onImportOwnerChange,
  onImportSourceYearChange,
  onImportSourceWeekChange,
  copySelectedMemberWeek,
  exportJson
} = useBoardStore();

async function doSignOut() {
  await signOut();
  router.push({ name: "Login" });
}

onMounted(() => init({
  userId: currentUser.value.id,
  isAdmin: isAdmin.value
}));
</script>