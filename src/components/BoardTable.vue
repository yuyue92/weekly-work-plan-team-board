<template>
  <section class="card board-card">
    <div class="board-header">
      <div>
        <h2 class="board-title">{{ boardTitle }}</h2>
      </div>
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
                    title="上移"
                    @click="$emit('move-member-up', member.userId)">↑</button>
                </div>
              </td>
              <td
                v-for="status in STATUS_KEYS"
                :key="status"
                class="status-col"
              >
                <div
                  class="drop-zone"
                  :class="{ 'drag-over': dragOverKey === member.userId + '|' + status }"
                  @dragover.prevent="onDragOver(member.userId, status)"
                  @dragleave="onDragLeave(member.userId, status, $event)"
                  @drop.prevent="onDrop(member.userId, status)"
                >
                  <!-- 只有自己那行或 admin 才能新增 -->
                  <div
                    v-if="isAdmin || member.userId === currentUserId"
                    class="zone-actions"
                  >
                    <button
                      class="btn btn-outline-primary btn-sm"
                      type="button"
                      @click="$emit('add-item', member.userId, status)"
                    >＋ Work Item</button>
                  </div>

                  <ItemCard
                    v-for="item in getMemberItems(member.userId, status)"
                    :key="item.id"
                    :item="item"
                    :member-id="member.userId"
                    :status="status"
                    :can-edit="isAdmin || member.userId === currentUserId"
                    :draggable-item="isAdmin || member.userId === currentUserId"
                    @edit="(uid, s, id) => $emit('edit-item', uid, s, id)"
                    @drag-start="onItemDragStart"
                    @drag-end="onItemDragEnd"
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
  members:        { type: Array,    required: true },  // [{ userId, displayName }]
  getMemberItems: { type: Function, required: true },
  currentUserId:  { type: String,   default: "" },
  isAdmin:        { type: Boolean,  default: false }
});

const emit = defineEmits(["add-item", "edit-item", "drop-item", "move-member-up"]);

const dragPayload = ref(null);
const dragOverKey = ref("");

// 和 ItemCard 的 draggableItem 权限保持一致：非 admin 不能把卡片拖给别的成员。
// 后端 RLS 已经会拦截，这里提前判断只是为了避免误操作、给出更友好的反馈。
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
