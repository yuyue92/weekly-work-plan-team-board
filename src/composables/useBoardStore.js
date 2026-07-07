import { reactive, ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import {
  STATUS_KEYS, STATUS_LABELS, SLOT_KEYS
} from "../constants/index.js";
import {
  buildWorkWeeks, getDefaultWeekKey, normalizeYear, formatTimestampForFile
} from "../utils/date.js";
import {
  createEmptyItem, createEmptyTask,
  rowToItem, rowToTask, itemToRow, taskToRow,
  isMeaningfulItem, isMeaningfulTask, cloneItem, countCheckedSlots
} from "../utils/model.js";

export function useBoardStore() {
  // ── 基础状态 ──────────────────────────────────────
  const weekOptions   = ref([]);
  const teamsData     = ref([]);   // [{ id, name }]
  const membersData   = ref([]);   // [{ user_id, display_name, profile }] for current team

  const state = reactive({
    teamId:  null,   // 当前选中 team 的 uuid
    teamName:"",
    year:    new Date().getFullYear(),
    weekKey: ""
  });

  // board 数据结构：{ [memberId]: { pending:[], processing:[], done:[] } }
  const boardData     = ref({});
  const boardLoading  = ref(false);

  const toastMessage   = ref("");
  const toastVisible   = ref(false);
  let toastTimer       = null;

  // 模态框
  const modalOpen     = ref(false);
  const modalContext  = ref(null);   // { ownerId, ownerName, status, itemId, isNew }
  const modalDraft    = ref(null);
  const modalSaveHint = ref("编辑内容不会自动保存");
  const modalSaving   = ref(false);

  // ── 工具 ──────────────────────────────────────────
  function showToast(msg) {
    toastMessage.value = msg;
    toastVisible.value = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible.value = false; }, 1800);
  }

  // ── 初始化：拉取 teams 列表 ───────────────────────
  async function init() {
    const { data, error } = await supabase.from("teams").select("id, name").order("name");
    if (error) { console.error("拉取 teams 失败", error); return; }
    teamsData.value = data || [];
    if (teamsData.value.length) {
      await onTeamChange(teamsData.value[0].id);
    }
  }

  // ── 切换 team ─────────────────────────────────────
  async function onTeamChange(teamId) {
    const team = teamsData.value.find(t => t.id === teamId);
    if (!team) return;
    state.teamId   = team.id;
    state.teamName = team.name;

    // 拉取该 team 的成员列表
    const { data, error } = await supabase
      .from("team_users")
      .select("user_id, profiles(id, display_name, role)")
      .eq("team_id", teamId);

    if (error) { console.error("拉取成员失败", error); return; }
    membersData.value = (data || []).map(row => ({
      userId:      row.profiles.id,
      displayName: row.profiles.display_name,
      role:        row.profiles.role
    }));

    // 年/周重新初始化
    const weeks = buildWorkWeeks(state.year);
    weekOptions.value = weeks;
    if (!state.weekKey) state.weekKey = getDefaultWeekKey(state.year, weeks);
    await loadBoard();
  }

  function onYearChange(rawValue) {
    const y = normalizeYear(rawValue);
    state.year = y;
    const weeks = buildWorkWeeks(y);
    weekOptions.value = weeks;
    state.weekKey = getDefaultWeekKey(y, weeks);
    loadBoard();
  }

  function onWeekChange(weekKey) {
    state.weekKey = weekKey;
    loadBoard();
  }

  // ── 加载看板数据 ───────────────────────────────────
  async function loadBoard() {
    if (!state.teamId || !state.weekKey) return;
    boardLoading.value = true;

    // 1. 拉取当前 team + year + weekKey 的所有 work_items
    const { data: items, error: itemsErr } = await supabase
      .from("work_items")
      .select("*")
      .eq("team_id", state.teamId)
      .eq("year", state.year)
      .eq("week_key", state.weekKey);

    if (itemsErr) {
      console.error("拉取 work_items 失败", itemsErr);
      boardLoading.value = false;
      return;
    }

    // 2. 拉取这些 work_items 的所有 tasks
    const itemIds = (items || []).map(i => i.id);
    let tasksMap = {};   // { [work_item_id]: task[] }
    if (itemIds.length) {
      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks")
        .select("*")
        .in("work_item_id", itemIds)
        .order("sort_order");
      if (tasksErr) console.error("拉取 tasks 失败", tasksErr);
      (tasks || []).forEach(t => {
        if (!tasksMap[t.work_item_id]) tasksMap[t.work_item_id] = [];
        tasksMap[t.work_item_id].push(t);
      });
    }

    // 3. 组装 boardData
    const newBoard = {};
    membersData.value.forEach(m => {
      newBoard[m.userId] = { pending: [], processing: [], done: [] };
    });
    (items || []).forEach(row => {
      const tasks = tasksMap[row.id] || [];
      const item  = rowToItem(row, tasks);
      if (newBoard[row.owner_id]) {
        newBoard[row.owner_id][row.status].push(item);
      }
    });
    boardData.value = newBoard;
    boardLoading.value = false;
  }

  // ── 获取某成员某状态的 items（供模板调用）────────
  function getMemberItems(userId, status) {
    return boardData.value[userId]?.[status] || [];
  }

  // ── 新增 WorkItem（打开空白模态框）────────────────
  function addItem(userId, ownerName, status) {
    modalContext.value = { ownerId: userId, ownerName, status, itemId: null, isNew: true };
    modalDraft.value   = createEmptyItem(userId);
    modalDraft.value.status = status;
    modalSaveHint.value = "编辑内容不会自动保存";
    modalOpen.value = true;
  }

  // ── 编辑 WorkItem（打开已有数据的模态框）──────────
  function openItemModal(userId, status, itemId) {
    const item = getMemberItems(userId, status).find(i => i.id === itemId);
    if (!item) return;
    const member = membersData.value.find(m => m.userId === userId);
    modalContext.value = {
      ownerId:   userId,
      ownerName: member?.displayName || "",
      status,
      itemId,
      isNew:     false
    };
    modalDraft.value    = cloneItem(item);
    modalSaveHint.value = "编辑内容不会自动保存";
    modalOpen.value     = true;
  }

  function closeModal() {
    modalOpen.value    = false;
    modalContext.value = null;
    modalDraft.value   = null;
  }

  function updateModalSaveHint(hasChange = false) {
    modalSaveHint.value = hasChange
      ? "有未保存修改，点击「保存并关闭」后生效"
      : "编辑内容不会自动保存";
  }

  // ── 保存并关闭模态框 ───────────────────────────────
  async function saveModalAndClose() {
    if (!modalDraft.value || !modalContext.value) return;
    const item = modalDraft.value;

    if (!isMeaningfulItem(item)) {
      alert("请至少填写 Work Item 或一条有效 Task 内容。");
      return;
    }

    modalSaving.value = true;
    try {
      if (modalContext.value.isNew) {
        await insertItem(item);
      } else {
        await updateItem(item);
      }
      await loadBoard();
      showToast(modalContext.value.isNew ? "Work Item 已新增" : "Work Item 已保存");
      closeModal();
    } catch (err) {
      alert("保存失败：" + (err.message || String(err)));
    } finally {
      modalSaving.value = false;
    }
  }

  async function insertItem(item) {
    // 1. 插入 work_item
    const { data: wiData, error: wiErr } = await supabase
      .from("work_items")
      .insert(itemToRow(item, state.teamId, state.year, state.weekKey))
      .select()
      .single();
    if (wiErr) throw wiErr;

    // 2. 批量插入 tasks（过滤空白）
    const meaningfulTasks = (item.tasks || []).filter(isMeaningfulTask);
    if (meaningfulTasks.length) {
      const taskRows = meaningfulTasks.map((t, i) => ({
        ...taskToRow(t, wiData.id),
        sort_order: i
      }));
      const { error: tErr } = await supabase.from("tasks").insert(taskRows);
      if (tErr) throw tErr;
    }
  }

  async function updateItem(item) {
    // 1. 更新 work_item 基本字段
    const { error: wiErr } = await supabase
      .from("work_items")
      .update({
        work_item:            item.work_item || "",
        priority:             item.priority  || "Low",
        status:               item.status    || "pending",
        expect_complete_date: item.expect_complete_date || null,
        create_date:          item.create_date          || null
      })
      .eq("id", item.id);
    if (wiErr) throw wiErr;

    // 2. tasks：删除全部旧 tasks，再批量重新插入
    //    （简单可靠，避免逐条 diff 对比）
    const { error: delErr } = await supabase
      .from("tasks")
      .delete()
      .eq("work_item_id", item.id);
    if (delErr) throw delErr;

    const meaningfulTasks = (item.tasks || []).filter(isMeaningfulTask);
    if (meaningfulTasks.length) {
      const taskRows = meaningfulTasks.map((t, i) => ({
        ...taskToRow(t, item.id),
        sort_order: i
      }));
      const { error: tErr } = await supabase.from("tasks").insert(taskRows);
      if (tErr) throw tErr;
    }
  }

  // ── 删除 WorkItem ──────────────────────────────────
  async function deleteCurrentItem() {
    if (!modalContext.value) return;
    if (modalContext.value.isNew) {
      closeModal();
      showToast("已取消");
      return;
    }
    const title = modalDraft.value?.work_item || "当前 Work Item";
    if (!confirm(`确定删除「${title}」吗？`)) return;

    modalSaving.value = true;
    try {
      // tasks 会由数据库 cascade 自动删除
      const { error } = await supabase
        .from("work_items")
        .delete()
        .eq("id", modalContext.value.itemId);
      if (error) throw error;
      await loadBoard();
      showToast("Work Item 已删除");
      closeModal();
    } catch (err) {
      alert("删除失败：" + (err.message || String(err)));
    } finally {
      modalSaving.value = false;
    }
  }

  // ── 新增 Task（在模态框内）────────────────────────
  function addTaskToCurrentItem() {
    if (!modalDraft.value) return;
    modalDraft.value.tasks.push(createEmptyTask());
    updateModalSaveHint(true);
  }

  // ── 删除 Task（在模态框内）────────────────────────
  function deleteTaskFromCurrentItem(index) {
    if (!modalDraft.value) return;
    const task = modalDraft.value.tasks[index];
    const name = task?.task_name || `第 ${index + 1} 条 task`;
    if (!confirm(`确定删除「${name}」吗？`)) return;
    modalDraft.value.tasks.splice(index, 1);
    updateModalSaveHint(true);
  }

  // ── 拖拽移动 WorkItem ─────────────────────────────
  async function handleItemDrop(dragPayload, targetOwnerId, targetStatus) {
    if (!dragPayload) return;
    const { ownerId: srcOwnerId, status: srcStatus, itemId } = dragPayload;
    if (srcOwnerId === targetOwnerId && srcStatus === targetStatus) return;

    try {
      const { error } = await supabase
        .from("work_items")
        .update({ owner_id: targetOwnerId, status: targetStatus })
        .eq("id", itemId);
      if (error) throw error;
      await loadBoard();
      showToast("Work Item 已移动");
    } catch (err) {
      alert("移动失败：" + (err.message || String(err)));
    }
  }

  // ── 清空当前周（仅 admin）─────────────────────────
  async function clearCurrentWeek() {
    const week = weekOptions.value.find(w => w.key === state.weekKey);
    if (!confirm(`确定清空 ${state.teamName} 的 ${week?.label} 所有数据吗？`)) return;
    const { error } = await supabase
      .from("work_items")
      .delete()
      .eq("team_id", state.teamId)
      .eq("year", state.year)
      .eq("week_key", state.weekKey);
    if (error) { alert("清空失败：" + error.message); return; }
    await loadBoard();
    showToast("当前周已清空");
  }

  // ── JSON 导出（备份）─────────────────────────────
  function exportJson() {
    const exportData = {
      version:     3,
      app:         "Weekly Work Plan Team Board",
      exportedAt:  new Date().toISOString(),
      team:        state.teamName,
      year:        state.year,
      weekKey:     state.weekKey,
      boardData:   boardData.value,
      members:     membersData.value
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `weekly_board_${formatTimestampForFile(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("JSON 已导出");
  }

  // ── computed ──────────────────────────────────────
  const boardTitle = computed(() => {
    const week = weekOptions.value.find(w => w.key === state.weekKey);
    return week ? `${state.teamName} - ${week.label}` : state.teamName;
  });
  const startDateDisplay = computed(() =>
    weekOptions.value.find(w => w.key === state.weekKey)?.startDate || ""
  );
  const endDateDisplay = computed(() =>
    weekOptions.value.find(w => w.key === state.weekKey)?.endDate || ""
  );
  const currentMembers = computed(() => membersData.value);

  return {
    // 常量
    STATUS_KEYS, STATUS_LABELS,
    // 状态
    state, weekOptions, teamsData, currentMembers,
    boardData, boardLoading,
    toastMessage, toastVisible,
    modalOpen, modalContext, modalDraft, modalSaveHint, modalSaving,
    boardTitle, startDateDisplay, endDateDisplay,
    // 方法
    init,
    onTeamChange, onYearChange, onWeekChange,
    loadBoard,
    getMemberItems,
    addItem, openItemModal, closeModal, updateModalSaveHint,
    saveModalAndClose, deleteCurrentItem,
    addTaskToCurrentItem, deleteTaskFromCurrentItem,
    handleItemDrop, clearCurrentWeek,
    exportJson,
    showToast
  };
}
