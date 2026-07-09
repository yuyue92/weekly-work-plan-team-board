import { reactive, ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import {
  STATUS_KEYS, STATUS_LABELS, SLOT_KEYS
} from "../constants/index.js";
import {
  buildWorkWeeks, getDefaultWeekKey, normalizeYear, formatTimestampForFile,
  addDays, parseDate, formatDate
} from "../utils/date.js";
import {
  createEmptyItem, createEmptyTask,
  rowToItem, rowToTask, itemToRow, taskToRow,
  isMeaningfulItem, isMeaningfulTask, cloneItem, countCheckedSlots
} from "../utils/model.js";

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

// 当前登录用户没有可用 Team 时的提示
const noTeamMessage = ref("");

const toastMessage   = ref("");
const toastVisible   = ref(false);
let toastTimer       = null;

// 模态框
const modalOpen     = ref(false);
const modalContext  = ref(null);   // { ownerId, ownerName, status, itemId, isNew }
const modalDraft    = ref(null);
const modalSaveHint = ref("Changes are not saved automatically");
const modalSaving   = ref(false);

// 管理员按成员复制周数据
const importState = reactive({
  ownerId:       "",
  sourceYear:    state.year,
  sourceWeekKey: ""
});
const importWeekOptions = ref([]);
const importSaving      = ref(false);

// 卡片级"复制到上一周/下一周"：记录正在复制中的 item id，避免重复点击
const copyingItemIds = reactive({});

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

  // 当前目标周变化后，默认把来源周定位到上一自然工作周
  function resetImportDefaults() {
    if (!membersData.value.some(member => member.userId === importState.ownerId)) {
      importState.ownerId = membersData.value[0]?.userId || "";
    }

    const targetWeek = weekOptions.value.find(
      week => week.key === state.weekKey
    );

    if (!targetWeek) {
      importState.sourceYear = state.year;
      importWeekOptions.value = buildWorkWeeks(state.year);
      importState.sourceWeekKey = importWeekOptions.value[0]?.key || "";
      return;
    }

    const previousStartDate = formatDate(
      addDays(parseDate(targetWeek.startDate), -7)
    );
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
    const previousWeekNo = Number(
      String(importState.sourceWeekKey).split("-W")[1]
    );
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
    const fromUtc = Date.UTC(
      from.getFullYear(),
      from.getMonth(),
      from.getDate()
    );
    const toUtc = Date.UTC(
      to.getFullYear(),
      to.getMonth(),
      to.getDate()
    );

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
  }

  // ── 初始化：按角色拉取 teams 列表 ───────────────────────
  // admin：可看全部 team
  // staff：只看自己加入的 team；未加入任何 team 时给出提示

  // ── 初始化：拉取 teams 列表 ───────────────────────
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
          .from("teams")
          .select("id, name")
          .order("name");

        if (error) throw error;
        teams = data || [];
      } else {
        if (!userId) {
          noTeamMessage.value = "Unable to identify the current user. Please log in again.";
          return;
        }

        const { data: memberships, error: membershipErr } = await supabase
          .from("team_users")
          .select("team_id")
          .eq("user_id", userId);

        if (membershipErr) throw membershipErr;

        const teamIds = [...new Set((memberships || []).map(row => row.team_id).filter(Boolean))];

        if (!teamIds.length) {
          noTeamMessage.value = "Your account hasn't been added to any team yet. Please contact an administrator.";
          return;
        }

        const { data, error } = await supabase
          .from("teams")
          .select("id, name")
          .in("id", teamIds)
          .order("name");

        if (error) throw error;
        teams = data || [];
      }

      teamsData.value = teams;

      if (teamsData.value.length) {
        await onTeamChange(teamsData.value[0].id);
      }
    } catch (error) {
      console.error("初始化 Team 失败", error);
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

    // 拉取该 team 的成员列表
    const { data, error } = await supabase
      .from("team_users")
      .select("user_id, sort_order, profiles(id, display_name, role)")
      .eq("team_id", teamId)
      .order("sort_order");

    if (error) { console.error("拉取成员失败", error); return; }
    membersData.value = (data || []).map(row => ({
      userId:      row.profiles.id,
      displayName: row.profiles.display_name,
      role:        row.profiles.role,
      sortOrder:   row.sort_order
    }));

    // 年/周重新初始化
    const weeks = buildWorkWeeks(state.year);
    weekOptions.value = weeks;
    
    if (!weeks.some(week => week.key === state.weekKey)) {
      state.weekKey = getDefaultWeekKey(state.year, weeks);
    }

    resetImportDefaults();
    await loadBoard();
    if (data.length === 0) showToast('No Member Data', 5000)
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

  // ── 成员排序：和"上一个人"互换 sort_order（只有 admin 会调用这个方法）──
  async function moveMemberUp(userId) {
    const list = membersData.value; // 已按 sort_order 排好序
    const idx  = list.findIndex(m => m.userId === userId);
    if (idx <= 0) return; // 已经是第一个，或找不到，什么都不做

    const current  = list[idx];
    const previous = list[idx - 1];

    const { error } = await supabase.rpc("swap_member_sort_order", {
      p_team_id: state.teamId,
      p_user_a:  current.userId,
      p_user_b:  previous.userId
    });
    if (error) {
      showToast("Sort failed:" + error.message);
      return;
    }

    // 本地直接交换两条数据的位置，避免重新拉一次成员列表的等待感
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    [list[idx - 1].sortOrder, list[idx].sortOrder] = [list[idx].sortOrder, list[idx - 1].sortOrder];
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
    modalSaveHint.value = "Changes are not saved automatically";
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
    modalSaveHint.value = "Changes are not saved automatically";
    modalOpen.value     = true;
  }

  function closeModal() {
    modalOpen.value    = false;
    modalContext.value = null;
    modalDraft.value   = null;
  }

  function updateModalSaveHint(hasChange = false) {
    modalSaveHint.value = hasChange
      ? 'You have unsaved changes. Click "Save & Close" to apply them.'
      : "Changes are not saved automatically";
  }

  // ── 保存并关闭模态框 ───────────────────────────────
  async function saveModalAndClose() {
    if (!modalDraft.value || !modalContext.value) return;
    const item = modalDraft.value;

    if (!isMeaningfulItem(item)) {
      showToast("Please fill in the Work Item or at least one valid Task.");
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
      showToast(modalContext.value.isNew ? "Work Item added" : "Work Item saved");
      closeModal();
    } catch (err) {
      showToast("Save failed:" + (err.message || String(err)));
    } finally {
      modalSaving.value = false;
    }
  }

  async function insertItem(item) {
    // work_item + tasks 合并为一次事务性 RPC，避免中途失败导致 task 丢失
    const { error } = await supabase.rpc("save_work_item_with_tasks", {
      p_work_item: itemToRow(item, state.teamId, state.year, state.weekKey),
      p_tasks:     buildTaskPayload(item.tasks),
      p_is_new:    true,
      p_item_id:   null
    });
    if (error) throw error;
  }

  async function updateItem(item) {
    // 同上：更新 work_item + 替换 tasks 合并为一次事务性 RPC
    const { error } = await supabase.rpc("save_work_item_with_tasks", {
      p_work_item: {
        work_item:            item.work_item || "",
        priority:             item.priority  || "Low",
        status:               item.status    || "pending",
        expect_complete_date: item.expect_complete_date || null,
        create_date:          item.create_date          || null
      },
      p_tasks:   buildTaskPayload(item.tasks),
      p_is_new:  false,
      p_item_id: item.id
    });
    if (error) throw error;
  }

  // task 数组 → RPC 用的 jsonb payload（过滤空白 task，去掉客户端专用的 work_item_id 字段）
  function buildTaskPayload(tasks) {
    return (tasks || [])
      .filter(isMeaningfulTask)
      .map((t, i) => {
        const row = taskToRow(t, null);
        delete row.work_item_id;
        return { ...row, sort_order: i };
      });
  }

  // ── 删除 WorkItem ──────────────────────────────────
  async function deleteCurrentItem() {
    if (!modalContext.value) return;
    if (modalContext.value.isNew) {
      closeModal();
      showToast("Cancelled");
      return;
    }
    const title = modalDraft.value?.work_item || "当前 Work Item";
    if (!confirm(`Are you sure you want to delete「${title}」？`)) return;

    modalSaving.value = true;
    try {
      // tasks 会由数据库 cascade 自动删除
      const { error } = await supabase
        .from("work_items")
        .delete()
        .eq("id", modalContext.value.itemId);
      if (error) throw error;
      await loadBoard();
      showToast("Work Item deleted");
      closeModal();
    } catch (err) {
      showToast("Delete failed:" + (err.message || String(err)));
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
    const name = task?.task_name || `Task ${index + 1}`;
    if (!confirm(`Are you sure you want to delete「${name}」？`)) return;
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
      showToast("Work Item moved", 3000);
    } catch (err) {
      const isRlsDenied = /row-level security/i.test(err.message || "");
      showToast(isRlsDenied ? "You don't have permission to move this Work Item to another member. Please contact an administrator to reassign it." : "Move failed:" + (err.message || String(err)), 3000);
      if (isRlsDenied) await loadBoard(); // 避免卡片在界面上残留"已移动"的错觉
    }
  }

  // ── 卡片级复制：把某个 Work Item 复制一份到上一周 / 下一周 ──────
  // direction: -1 = 上一周，1 = 下一周。原卡片保持不动，目标周新增一份独立副本。
  // 权限：和 Edit 按钮一致（isAdmin || 本人），由 ItemCard 的 v-if="canEdit" 控制显示，
  // 写入走的是新增 Work Item 同一条 RPC，staff 对自己数据的 RLS 权限本来就覆盖这里，无需改动后端。
  async function copyItemToAdjacentWeek(memberId, status, itemId, direction) {
    if (copyingItemIds[itemId]) return; // 防止重复点击

    const item = getMemberItems(memberId, status).find(i => i.id === itemId);
    const sourceWeek = weekOptions.value.find(w => w.key === state.weekKey);
    if (!item || !sourceWeek) return;

    const targetStartDate = formatDate(
      addDays(parseDate(sourceWeek.startDate), direction * 7)
    );
    const matched = findWeekByStartDate(targetStartDate, state.year);

    if (!matched) {
      showToast(direction < 0 ? "No earlier week available." : "No later week available.");
      return;
    }

    const title = item.work_item || "This Work Item";
    const directionLabel = direction < 0 ? "previous week" : "next week";
    const confirmMsg =
      `Confirm copy「${title}」to ${directionLabel}（${matched.week.label}）？`;
    if (!confirm(confirmMsg)) return;

    copyingItemIds[itemId] = true;
    try {
      const payload = cloneItem(item); // 深拷贝，避免影响原卡片
      const { error } = await supabase.rpc("save_work_item_with_tasks", {
        p_work_item: itemToRow(payload, state.teamId, matched.year, matched.week.key),
        p_tasks:     buildTaskPayload(payload.tasks),
        p_is_new:    true,
        p_item_id:   null
      });
      if (error) throw error;

      const yearHint = matched.year !== state.year ? `（${matched.year} year）` : "";
      showToast(`Copied to ${matched.week.label}${yearHint}`, 2500);

      // 极端情况下目标周恰好也是当前显示的周（理论上不会发生，直接兜底刷新一下）
      if (matched.year === state.year && matched.week.key === state.weekKey) {
        await loadBoard();
      }
    } catch (err) {
      const isRlsDenied = /row-level security/i.test(err.message || "");
      showToast(
        isRlsDenied
          ? "You don't have permission to copy this Work Item. Please contact an administrator."
          : "Copy failed:" + (err.message || String(err)),
        3000
      );
    } finally {
      delete copyingItemIds[itemId];
    }
  }

  // ── 清空当前周（仅 admin）─────────────────────────
  async function clearCurrentWeek() {
    const week = weekOptions.value.find(w => w.key === state.weekKey);
    if (!confirm(`Are you sure you want to clear all data for ${state.teamName} in ${week?.label}?`)) return;
    const { error } = await supabase
      .from("work_items")
      .delete()
      .eq("team_id", state.teamId)
      .eq("year", state.year)
      .eq("week_key", state.weekKey);
    if (error) { showToast("Clear failed:" + error.message); return; }
    await loadBoard();
    showToast("Current week cleared");
  }

  // ── 按成员复制某一周到当前周（仅 admin）──────────
  async function copySelectedMemberWeek() {
    if (boardLoading.value || importSaving.value) return;

    const member = membersData.value.find(
      item => item.userId === importState.ownerId
    );
    const sourceWeek = importWeekOptions.value.find(
      item => item.key === importState.sourceWeekKey
    );
    const targetWeek = weekOptions.value.find(
      item => item.key === state.weekKey
    );

    if (!member || !sourceWeek || !targetWeek) {
      showToast("Please select a source week and a member to import.");
      return;
    }

    if (
      Number(importState.sourceYear) === Number(state.year) &&
      importState.sourceWeekKey === state.weekKey
    ) {
      showToast("The source week can't be the same as the current target week.");
      return;
    }

    const targetItemCount = STATUS_KEYS.reduce(
      (total, status) =>
        total + getMemberItems(member.userId, status).length,
      0
    );

    const replaceExisting = targetItemCount > 0;
    const message = replaceExisting
      ? `「${member.displayName}」在当前周已有 ${targetItemCount} 条 Work Item。继续后将先清空该成员当前周数据，再从 ${sourceWeek.label} 导入，确定继续吗？`
      : `确定把「${member.displayName}」的 ${sourceWeek.label} 数据复制到当前周吗？`;

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
        p_shift_days:       calendarDayDiff(
          sourceWeek.startDate,
          targetWeek.startDate
        ),
        p_replace_existing: replaceExisting
      });

      if (error) throw error;

      await loadBoard();
      showToast(
        `已为 ${member.displayName} 导入 ${
          Number(data?.copied_work_items || 0)
        } 条 Work Item`
      );
    } catch (err) {
      showToast("Import failed:" + (err.message || String(err)));
    } finally {
      importSaving.value = false;
    }
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
    showToast("JSON exported");
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
    boardData, boardLoading, noTeamMessage,
    toastMessage, toastVisible,
    modalOpen, modalContext, modalDraft, modalSaveHint, modalSaving,
    importState, importWeekOptions, importSaving,
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
    copyingItemIds, copyItemToAdjacentWeek,
    moveMemberUp,
    onImportOwnerChange,
    onImportSourceYearChange,
    onImportSourceWeekChange,
    copySelectedMemberWeek,
    exportJson,
    showToast
  };
}
