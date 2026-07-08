import { PRIORITIES, SLOT_KEYS } from "../constants/index.js";
import { formatDate } from "./date.js";

// ── 前端 WorkItem 模型 ──────────────────────────────
// 与 Supabase work_items + tasks 表做双向转换

export function createEmptyItem(ownerId = "") {
  return {
    id:                   null,   // Supabase 生成，新建时为 null
    owner_id:             ownerId,
    work_item:            "",
    priority:             "Medium",
    status:               "pending",
    expect_complete_date: "",
    create_date:          formatDate(new Date()),
    tasks:                [createEmptyTask()]
  };
}

export function createEmptyTask() {
  return {
    id:             null,
    work_item_id:   null,
    task_name:      "",
    description:    "",
    remark_blocker: "",
    sort_order:     0,
    slots:          Object.fromEntries(SLOT_KEYS.map(k => [k, false]))
  };
}

// Supabase 行 → 前端 task 对象
export function rowToTask(row) {
  return {
    id:             row.id,
    work_item_id:   row.work_item_id,
    task_name:      row.task_name      || "",
    description:    row.description    || "",
    remark_blocker: row.remark_blocker || "",
    sort_order:     row.sort_order     ?? 0,
    slots:          Object.fromEntries(SLOT_KEYS.map(k => [k, Boolean(row[k])]))
  };
}

// 前端 task → Supabase insert/update payload
export function taskToRow(task, workItemId) {
  const slotFields = Object.fromEntries(SLOT_KEYS.map(k => [k, Boolean(task.slots?.[k])]));
  return {
    work_item_id:   workItemId || task.work_item_id,
    task_name:      task.task_name      || "",
    description:    task.description    || "",
    remark_blocker: task.remark_blocker || "",
    sort_order:     task.sort_order     ?? 0,
    ...slotFields
  };
}

// Supabase 行 → 前端 workItem 对象（tasks 需单独传入）
export function rowToItem(row, tasks = []) {
  return {
    id:                   row.id,
    owner_id:             row.owner_id,
    work_item:            row.work_item            || "",
    priority:             PRIORITIES.includes(row.priority) ? row.priority : "Medium",
    status:               row.status               || "pending",
    expect_complete_date: row.expect_complete_date || "",
    create_date:          row.create_date          || "",
    tasks:                tasks.map(rowToTask)
  };
}

// 前端 workItem → Supabase insert/update payload
export function itemToRow(item, teamId, year, weekKey) {
  return {
    team_id:              teamId,
    owner_id:             item.owner_id,
    year:                 Number(year),
    week_key:             weekKey,
    status:               item.status               || "pending",
    work_item:            item.work_item            || "",
    priority:             item.priority             || "Low",
    expect_complete_date: item.expect_complete_date || null,
    create_date:          item.create_date          || null
  };
}

export function countCheckedSlots(item) {
  const unique = new Set();
  (item.tasks || []).forEach(task =>
    SLOT_KEYS.forEach(k => { if (task.slots?.[k]) unique.add(k); })
  );
  return unique.size;
}

export function isMeaningfulItem(item) {
  return Boolean(
    String(item.work_item || "").trim() ||
    item.expect_complete_date ||
    (Array.isArray(item.tasks) && item.tasks.some(isMeaningfulTask))
  );
}

export function isMeaningfulTask(task) {
  if (!task) return false;
  return Boolean(
    String(task.task_name      || "").trim() ||
    String(task.description    || "").trim() ||
    String(task.remark_blocker || "").trim() ||
    SLOT_KEYS.some(k => Boolean(task.slots?.[k]))
  );
}

export function cloneItem(item) {
  return JSON.parse(JSON.stringify(item));
}
