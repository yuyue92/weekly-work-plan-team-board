<template>
  <section class="card board-card">
    <div class="board-header">
      <div><h2 class="board-title">{{ boardTitle }}</h2></div>
    </div>
    <div class="card-body">
      <div class="table-responsive">
        <table class="board-table" aria-label="Weekly team work board">
          <thead>
            <tr>
              <th>Member</th>
              <th><span class="status-pill pending">Pending</span></th>
              <th><span class="status-pill processing">Processing</span></th>
              <th><span class="status-pill done">Done</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(member, idx) in members" :key="member.userId">
              <td class="member-cell">
                <div class="member-cell-inner">
                  <span class="member-name">{{ member.displayName }}</span>
                  <button
                    v-if="isAdmin && idx > 0"
                    type="button"
                    class="member-move-up"
                    title="Move up"
                    @click="$emit('move-member-up', member.userId)">↑</button>
                </div>
                <button
                  v-if="isAdmin || member.userId === currentUserId"
                  class="btn btn-outline-primary btn-sm member-edit-btn"
                  type="button"
                  @click="$emit('edit-member', member.userId)"
                >Edit</button>
              </td>
              <td v-for="status in STATUS_KEYS" :key="status" class="status-col">
                <div
                  class="drop-zone"
                  :class="{ 'drag-over': dragOverKey === member.userId + '|' + status }"
                  @dragover.prevent="onDragOver(member.userId, status)"
                  @dragleave="onDragLeave(member.userId, status, $event)"
                  @drop.prevent="onDrop(member.userId, status)"
                >
                  <ItemCard
                    v-for="item in getMemberItems(member.userId, status)"
                    :key="item.id"
                    :item="item"
                    :member-id="member.userId"
                    :status="status"
                    :can-edit="isAdmin || member.userId === currentUserId"
                    :draggable-item="isAdmin || member.userId === currentUserId"
                    :is-copying="Boolean(copyingItemIds[item.id])"
                    @drag-start="onItemDragStart"
                    @drag-end="onItemDragEnd"
                    @copy-week="(uid, s, id, dir) => $emit('copy-item-week', uid, s, id, dir)"
                  />
                  <div v-if="!getMemberItems(member.userId, status).length" class="empty-note">
                    No {{ STATUS_LABELS[status] }} items
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import ItemCard from "./ItemCard.vue";
import { STATUS_KEYS, STATUS_LABELS } from "../constants/index.js";

const props = defineProps({
  boardTitle:     { type: String,   default: "" },
  members:        { type: Array,    required: true },
  getMemberItems: { type: Function, required: true },
  currentUserId:  { type: String,   default: "" },
  isAdmin:        { type: Boolean,  default: false },
  copyingItemIds: { type: Object,   default: () => ({}) }
});

const emit = defineEmits(["edit-member", "drop-item", "move-member-up", "copy-item-week"]);

const dragPayload = ref(null);
const dragOverKey = ref("");

function canDropTo(userId) {
  return props.isAdmin || userId === props.currentUserId;
}

function onItemDragStart(payload) { dragPayload.value = payload; }
function onItemDragEnd()          { dragPayload.value = null; dragOverKey.value = ""; }

function onDragOver(userId, status) {
  if (!dragPayload.value || !canDropTo(userId)) return;
  dragOverKey.value = userId + "|" + status;
}

function onDragLeave(userId, status, event) {
  const key = userId + "|" + status;
  if (dragOverKey.value !== key) return;
  if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
  dragOverKey.value = "";
}

function onDrop(userId, status) {
  dragOverKey.value = "";
  if (!dragPayload.value) return;
  emit("drop-item", dragPayload.value, userId, status);
  dragPayload.value = null;
}
</script>