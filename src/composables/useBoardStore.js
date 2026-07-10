import { reactive, ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import { STATUS_KEYS, STATUS_LABELS } from "../constants/index.js";
import {
  buildWorkWeeks, getDefaultWeekKey, normalizeYear, formatTimestampForFile,
  addDays, parseDate, formatDate
} from "../utils/date.js";
import {
  createEmptyItem, createEmptyTask,
  rowToItem, taskToRow, itemToRow, itemToUpdateRow,
  isMeaningfulItem, isMeaningfulTask, cloneItem
} from "../utils/model.js";

// ── 基础状态 ──────────────────────────────────────
const weekOptions   = ref([]);
const teamsData     = ref([]);   // [{ id, name }]
const membersData   = ref([]);   // [{ userId, displayName, role, sortOrder }] for current team

const state = reactive({
  teamId:  null,
  teamName:"",
  year:    new Date().getFullYear(),
  weekKey: ""
});

// board 数据结构：{ [memberId]: { pending:[], processing:[], done:[] } }
const boardData     = ref({});
const boardLoading  = ref(false);

const noTeamMessage = ref("");

const toastMessage   = ref("");
const toastVisible   = ref(false);
let toastTimer       = null;

// ── 成员级编辑弹框：一个弹框管理某成员当周的 Pending / Processing / Done 三段 ──
const memberModalOpen    = ref(false);
const memberModalContext = ref(null);  // { memberId, displayName }
const memberModalDraft   = reactive({ pending: [], processing: [], done: [] });
const memberModalSaveHint = ref("Changes are not saved automatically");
const memberModalSaving   = ref(false);
const deletedItemIds = ref([]); // 弹框编辑期间被删除的 work_item id，保存时才真正落库
const deletedTaskIds = ref([]); // 同上，task 粒度

// 卡片级"复制到上一周/下一周"：记录正在复制中的 item id，避免重复点击
const copyingItemIds = reactive({});

// 管理员按成员复制周数据
const importState = reactive({
  ownerId:       "",
  sourceYear:    state.year,
  sourceWeekKey: ""
});
const importWeekOptions = ref([]);
const importSaving      = ref(false);

export function useBoardStore() {

  // ── 工具 ──────────────────────────────────────────
  function showToast(msg, duration = 1800) {
    toastMessage.value = msg;
    toastVisible.value = true;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible.value = false; }, duration);
  }

  function findWeekByStartDate(startDate, preferredYear) {
    const dateYear = parseDate(startDate).getFullYear();
    const years = [...new Set([
      Number(preferredYear),
      dateYear,
      Number(preferredYear) - 1,
      Number(preferredYear) + 1
    ])];

    for (const year of years) {
      const options = buildWorkWeeks(year);
      const week = options.find(item => item.startDate === startDate);
      if (week) return { year, options, week };
    }

    return null;
  }

  function resetImportDefaults() {
    if (!membersData.value.some(member => member.userId === importState.ownerId)) {
      importState.ownerId = membersData.value[0]?.userId || "";
    }

    const targetWeek = weekOptions.value.find(week => week.key === state.weekKey);

    if (!targetWeek) {
      importState.sourceYear = state.year;
      importWeekOptions.value = buildWorkWeeks(state.year);
      importState.sourceWeekKey = importWeekOptions.value[0]?.key || "";
      return;
    }

    const previousStartDate = formatDate(addDays(parseDate(targetWeek.startDate), -7));
    const matched = findWeekByStartDate(previousStartDate, state.year);

    if (matched) {
      importState.sourceYear = matched.year;
      importWeekOptions.value = matched.options;
      importState.sourceWeekKey = matched.week.key;
      return;
    }

    importState.sourceYear = state.year;
    importWeekOptions.value = buildWorkWeeks(state.year);
    importState.sourceWeekKey = importWeekOptions.value[0]?.key || "";
  }

  function onImportOwnerChange(userId) {
    importState.ownerId = userId;
  }

  function onImportSourceYearChange(rawValue) {
    const previousWeekNo = Number(String(importState.sourceWeekKey).split("-W")[1]);
    const year = normalizeYear(rawValue);
    const options = buildWorkWeeks(year);

    importState.sourceYear = year;
    importWeekOptions.value = options;
    importState.sourceWeekKey =
      options.find(week => week.weekNo === previousWeekNo)?.key ||
      options[0]?.key ||
      "";
  }

  function onImportSourceWeekChange(weekKey) {
    importState.sourceWeekKey = weekKey;
  }

  function calendarDayDiff(fromDate, toDate) {
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toUtc - fromUtc) / 86400000);
  }

  function resetBoardState() {
    state.teamId = null;
    state.teamName = "";
    teamsData.value = [];
    membersData.value = [];
    boardData.value = {};
    weekOptions.value = [];
    importState.ownerId = "";
    importWeekOptions.value = [];
    closeMemberModal();
  }

  // ── 初始化：按角色拉取 teams 列表 ───────────────────
  async function init(authContext = {}) {
    boardLoading.value = true;
    noTeamMessage.value = "";
    resetBoardState();

    const userId = authContext.userId;
    const isAdmin = Boolean(authContext.isAdmin);

    try {
      let teams = [];

      if (isAdmin) {
        const { data, error } = await supabase
          .from("teams").select("id, name").order("name");
        if (error) throw error;
        teams = data || [];
      } else {
        if (!userId) {
          noTeamMessage.value = "Unable to identify the current user. Please log in again.";
          return;
        }

        const { data: memberships, error: membershipErr } = await supabase
          .from("team_users").select("team_id").eq("user_id", userId);
        if (membershipErr) throw membershipErr;

        const teamIds = [...new Set((memberships || []).map(row => row.team_id).filter(Boolean))];

        if (!teamIds.length) {
          noTeamMessage.value = "Your account hasn't been added to any team yet. Please contact an administrator.";
          return;
        }

        const { data, error } = await supabase
          .from("teams").select("id, name").in("id", teamIds).order("name");
        if (error) throw error;
        teams = data || [];
      }

      teamsData.value = teams;

      if (teamsData.value.length) {
        await onTeamChange(teamsData.value[0].id);
      }
    } catch (error) {
      console.error("Failed to initialize teams", error);
      noTeamMessage.value = "Failed to load teams. Please refresh the page or contact an administrator.";
    } finally {
      boardLoading.value = false;
    }
  }

  // ── 切换 team ─────────────────────────────────────
  async function onTeamChange(teamId) {
    const team = teamsData.value.find(t => t.id === teamId);
    if (!team) return;
    state.teamId   = team.id;
    state.teamName = team.name;

    // 切换 team 一开始就清空旧数据 + 进入 loading，避免请求失败/变慢时页面残留上一个 team 的数据
    membersData.value  = [];
    boardData.value    = {};
    boardLoading.value = true;
    closeMemberModal();

    try {
      const { data, error } = await supabase
        .from("team_users")
        .select("user_id, sort_order, profiles(id, display_name, role)")
        .eq("team_id", teamId)
        .order("sort_order");

      if (error) throw error;

      membersData.value = (data || [])
        .filter(row => row.profiles)
        .map(row => ({
          userId:      row.profiles.id,
          displayName: row.profiles.display_name,
          role:        row.profiles.role,
          sortOrder:   row.sort_order
        }));

      const weeks = buildWorkWeeks(state.year);
      weekOptions.value = weeks;

      if (!weeks.some(week => week.key === state.weekKey)) {
        state.weekKey = getDefaultWeekKey(state.year, weeks);
      }

      resetImportDefaults();
      await loadBoard();
    } catch (error) {
      console.error("Failed to switch team", error);
      showToast("Failed to switch team: " + (error.message || String(error)));
      boardLoading.value = false;
    }
  }

  function onYearChange(rawValue) {
    const y = normalizeYear(rawValue);
    state.year = y;
    const weeks = buildWorkWeeks(y);
    weekOptions.value = weeks;
    state.weekKey = getDefaultWeekKey(y, weeks);
    resetImportDefaults();
    loadBoard();
  }

  function onWeekChange(weekKey) {
    state.weekKey = weekKey;
    resetImportDefaults();
    loadBoard();
  }

  // ── 成员排序：和"上一个人"互换 sort_order（只有 admin 会调用）──
  async function moveMemberUp(userId) {
    const list = membersData.value;
    const idx  = list.findIndex(m => m.userId === userId);
    if (idx <= 0) return;

    const current  = list[idx];
    const previous = list[idx - 1];

    const { error } = await supabase.rpc("swap_member_sort_order", {
      p_team_id: state.teamId,
      p_user_a:  current.userId,
      p_user_b:  previous.userId
    });
    if (error) {
      showToast("Sort failed: " + error.message);
      return;
    }

    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    [list[idx - 1].sortOrder, list[idx].sortOrder] = [list[idx].sortOrder, list[idx - 1].sortOrder];
  }

  // ── 加载看板数据 ───────────────────────────────────
  async function loadBoard() {
    if (!state.teamId || !state.weekKey) return;
    boardLoading.value = true;

    const { data: items, error: itemsErr } = await supabase
      .from("work_items")
      .select("*")
      .eq("team_id", state.teamId)
      .eq("year", state.year)
      .eq("week_key", state.weekKey);

    if (itemsErr) {
      console.error("Failed to fetch work_items", itemsErr);
      boardLoading.value = false;
      return;
    }

    const itemIds = (items || []).map(i => i.id);
    let tasksMap = {};
    if (itemIds.length) {
      const { data: tasks, error: tasksErr } = await supabase
        .from("tasks").select("*").in("work_item_id", itemIds).order("sort_order");
      if (tasksErr) console.error("Failed to fetch tasks", tasksErr);
      (tasks || []).forEach(t => {
        if (!tasksMap[t.work_item_id]) tasksMap[t.work_item_id] = [];
        tasksMap[t.work_item_id].push(t);
      });
    }

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

  function getMemberItems(userId, status) {
    return boardData.value[userId]?.[status] || [];
  }

  // ══════════════════ 成员级编辑弹框 ══════════════════

  function openMemberModal(userId) {
    const member = membersData.value.find(m => m.userId === userId);
    if (!member) return;

    memberModalContext.value = { memberId: userId, displayName: member.displayName };
    memberModalDraft.pending    = getMemberItems(userId, "pending").map(cloneItem);
    memberModalDraft.processing = getMemberItems(userId, "processing").map(cloneItem);
    memberModalDraft.done       = getMemberItems(userId, "done").map(cloneItem);
    deletedItemIds.value = [];
    deletedTaskIds.value = [];
    memberModalSaveHint.value = "Changes are not saved automatically";
    memberModalOpen.value = true;
  }

  function closeMemberModal() {
    memberModalOpen.value = false;
    memberModalContext.value = null;
    memberModalDraft.pending = [];
    memberModalDraft.processing = [];
    memberModalDraft.done = [];
    deletedItemIds.value = [];
    deletedTaskIds.value = [];
  }

  function markMemberModalDirty() {
    memberModalSaveHint.value = "Unsaved changes — click \"Save & Close\" to apply them";
  }

  function addDraftItem(status) {
    if (!memberModalContext.value) return;
    const item = createEmptyItem(memberModalContext.value.memberId);
    item.status = status;
    memberModalDraft[status].push(item);
    markMemberModalDirty();
  }

  function deleteDraftItem(status, index) {
    const item = memberModalDraft[status][index];
    if (!item) return;
    const title = item.work_item || `Item ${index + 1}`;
    if (!confirm(`Delete "${title}"? Its tasks will be deleted too.`)) return;
    if (item.id) deletedItemIds.value.push(item.id);
    memberModalDraft[status].splice(index, 1);
    markMemberModalDirty();
  }

  function addDraftTask(status, itemIndex) {
    const item = memberModalDraft[status][itemIndex];
    if (!item) return;
    item.tasks.push(createEmptyTask());
    markMemberModalDirty();
  }

  function deleteDraftTask(status, itemIndex, taskIndex) {
    const item = memberModalDraft[status][itemIndex];
    if (!item) return;
    const task = item.tasks[taskIndex];
    if (!task) return;
    if (task.id) deletedTaskIds.value.push(task.id);
    item.tasks.splice(taskIndex, 1);
    markMemberModalDirty();
  }

  // 弹框内三段之间的拖拽换状态（Pending ⇄ Processing ⇄ Done），纯本地操作，Save & Close 时才真正落库
  function moveDraftItem(fromStatus, fromIndex, toStatus) {
    if (fromStatus === toStatus) return;
    const list = memberModalDraft[fromStatus];
    const item = list[fromIndex];
    if (!item) return;
    list.splice(fromIndex, 1);
    item.status = toStatus;
    memberModalDraft[toStatus].push(item);
    markMemberModalDirty();
  }

  function buildTaskPayload(tasks) {
    return (tasks || [])
      .filter(isMeaningfulTask)
      .map((t, i) => {
        const row = taskToRow(t, null);
        delete row.work_item_id;
        return { ...row, sort_order: i };
      });
  }

  async function saveMemberModalAndClose() {
    if (!memberModalContext.value) return;
    memberModalSaving.value = true;
    try {
      for (const status of STATUS_KEYS) {
        for (const item of memberModalDraft[status]) {
          item.status = status; // 保证和拖拽后所在的段一致

          if (!item.id) {
            if (!isMeaningfulItem(item)) continue; // 新增但仍是空白行，跳过不建
            const { error } = await supabase.rpc("save_work_item_with_tasks", {
              p_work_item: itemToRow(item, state.teamId, state.year, state.weekKey),
              p_tasks:     buildTaskPayload(item.tasks),
              p_is_new:    true,
              p_item_id:   null
            });
            if (error) throw error;
          } else {
            const { error } = await supabase.rpc("save_work_item_with_tasks", {
              p_work_item: itemToUpdateRow(item),
              p_tasks:     buildTaskPayload(item.tasks),
              p_is_new:    false,
              p_item_id:   item.id
            });
            if (error) throw error;
          }
        }
      }

      if (deletedItemIds.value.length) {
        const { error } = await supabase.from("work_items").delete().in("id", deletedItemIds.value);
        if (error) throw error;
      }
      if (deletedTaskIds.value.length) {
        const { error } = await supabase.from("tasks").delete().in("id", deletedTaskIds.value);
        if (error) throw error;
      }

      await loadBoard();
      showToast("Saved");
      closeMemberModal();
    } catch (err) {
      showToast("Save failed: " + (err.message || String(err)), 3000);
    } finally {
      memberModalSaving.value = false;
    }
  }

  // ══════════════════ 主看板：跨成员/跨状态拖拽（保留不变）══════════════════
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
      showToast("Work Item moved", 3000);
    } catch (err) {
      const isRlsDenied = /row-level security/i.test(err.message || "");
      showToast(
        isRlsDenied
          ? "You don't have permission to move this Work Item to another member. Please contact an administrator to reassign it."
          : "Move failed: " + (err.message || String(err)),
        3000
      );
      if (isRlsDenied) await loadBoard();
    }
  }

  // ── 卡片级复制：把某个 Work Item 复制一份到上一周 / 下一周（保留不变）──
  async function copyItemToAdjacentWeek(memberId, status, itemId, direction) {
    if (copyingItemIds[itemId]) return;

    const item = getMemberItems(memberId, status).find(i => i.id === itemId);
    const sourceWeek = weekOptions.value.find(w => w.key === state.weekKey);
    if (!item || !sourceWeek) return;

    const targetStartDate = formatDate(addDays(parseDate(sourceWeek.startDate), direction * 7));
    const matched = findWeekByStartDate(targetStartDate, state.year);

    if (!matched) {
      showToast(direction < 0 ? "No earlier week available." : "No later week available.");
      return;
    }

    const title = item.work_item || "this Work Item";
    const directionLabel = direction < 0 ? "the previous week" : "the next week";
    const confirmMsg =
      `Copy "${title}" to ${directionLabel} (${matched.week.label})?\n` +
      `The original card will stay in the current week.`;
    if (!confirm(confirmMsg)) return;

    copyingItemIds[itemId] = true;
    try {
      const payload = cloneItem(item);
      const { error } = await supabase.rpc("save_work_item_with_tasks", {
        p_work_item: itemToRow(payload, state.teamId, matched.year, matched.week.key),
        p_tasks:     buildTaskPayload(payload.tasks),
        p_is_new:    true,
        p_item_id:   null
      });
      if (error) throw error;

      const yearHint = matched.year !== state.year ? ` (${matched.year})` : "";
      showToast(`Copied to ${matched.week.label}${yearHint}`, 2500);

      if (matched.year === state.year && matched.week.key === state.weekKey) {
        await loadBoard();
      }
    } catch (err) {
      const isRlsDenied = /row-level security/i.test(err.message || "");
      showToast(
        isRlsDenied
          ? "You don't have permission to copy this Work Item. Please contact an administrator."
          : "Copy failed: " + (err.message || String(err)),
        3000
      );
    } finally {
      delete copyingItemIds[itemId];
    }
  }

  // ── 清空当前周（仅 admin）─────────────────────────
  async function clearCurrentWeek() {
    const week = weekOptions.value.find(w => w.key === state.weekKey);
    if (!confirm(`Clear all data for ${state.teamName} in ${week?.label}?`)) return;
    const { error } = await supabase
      .from("work_items")
      .delete()
      .eq("team_id", state.teamId)
      .eq("year", state.year)
      .eq("week_key", state.weekKey);
    if (error) { showToast("Clear failed: " + error.message); return; }
    await loadBoard();
    showToast("Current week cleared");
  }

  // ── 按成员复制某一周到当前周（仅 admin）──────────
  async function copySelectedMemberWeek() {
    if (boardLoading.value || importSaving.value) return;

    const member = membersData.value.find(item => item.userId === importState.ownerId);
    const sourceWeek = importWeekOptions.value.find(item => item.key === importState.sourceWeekKey);
    const targetWeek = weekOptions.value.find(item => item.key === state.weekKey);

    if (!member || !sourceWeek || !targetWeek) {
      showToast("Please select a source week and a member to import.");
      return;
    }

    if (Number(importState.sourceYear) === Number(state.year) && importState.sourceWeekKey === state.weekKey) {
      showToast("The source week can't be the same as the current target week.");
      return;
    }

    const targetItemCount = STATUS_KEYS.reduce(
      (total, status) => total + getMemberItems(member.userId, status).length, 0
    );

    const replaceExisting = targetItemCount > 0;
    const message = replaceExisting
      ? `"${member.displayName}" already has ${targetItemCount} Work Item(s) this week. Continuing will clear this member's current week data first, then import from ${sourceWeek.label}. Continue?`
      : `Copy "${member.displayName}"'s data from ${sourceWeek.label} to the current week?`;

    if (!confirm(message)) return;

    importSaving.value = true;
    try {
      const { data, error } = await supabase.rpc("copy_member_week", {
        p_team_id:          state.teamId,
        p_owner_id:         member.userId,
        p_source_year:      Number(importState.sourceYear),
        p_source_week_key:  importState.sourceWeekKey,
        p_target_year:      Number(state.year),
        p_target_week_key:  state.weekKey,
        p_shift_days:       calendarDayDiff(sourceWeek.startDate, targetWeek.startDate),
        p_replace_existing: replaceExisting
      });
      if (error) throw error;

      await loadBoard();
      showToast(`Imported ${Number(data?.copied_work_items || 0)} Work Item(s) for ${member.displayName}`);
    } catch (err) {
      showToast("Import failed: " + (err.message || String(err)));
    } finally {
      importSaving.value = false;
    }
  }

  // ── JSON 导出（备份）─────────────────────────────
  function exportJson() {
    const exportData = {
      version:     4,
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
    showToast("JSON exported");
  }

  // ── computed ──────────────────────────────────────
  const boardTitle = computed(() => {
    const week = weekOptions.value.find(w => w.key === state.weekKey);
    return week ? `${state.teamName} - ${week.label}` : state.teamName;
  });
  const startDateDisplay = computed(() => weekOptions.value.find(w => w.key === state.weekKey)?.startDate || "");
  const endDateDisplay   = computed(() => weekOptions.value.find(w => w.key === state.weekKey)?.endDate || "");
  const currentMembers   = computed(() => membersData.value);

  // 当前周 Mon~Fri 五天的具体日期（"YYYY-MM-DD"），供成员编辑弹框在工时列标题下面展示
  const currentWeekDays  = computed(() =>
    weekOptions.value.find(w => w.key === state.weekKey)?.days || []
  );

  return {
    STATUS_KEYS, STATUS_LABELS,
    state, weekOptions, teamsData, currentMembers,
    boardData, boardLoading, noTeamMessage,
    toastMessage, toastVisible,
    memberModalOpen, memberModalContext, memberModalDraft,
    memberModalSaveHint, memberModalSaving,
    importState, importWeekOptions, importSaving,
    boardTitle, startDateDisplay, endDateDisplay, currentWeekDays,
    copyingItemIds,
    init,
    onTeamChange, onYearChange, onWeekChange,
    loadBoard,
    getMemberItems,
    moveMemberUp,
    openMemberModal, closeMemberModal, markMemberModalDirty,
    addDraftItem, deleteDraftItem, addDraftTask, deleteDraftTask, moveDraftItem,
    saveMemberModalAndClose,
    handleItemDrop, copyItemToAdjacentWeek,
    clearCurrentWeek,
    onImportOwnerChange, onImportSourceYearChange, onImportSourceWeekChange,
    copySelectedMemberWeek,
    exportJson,
    showToast
  };
}