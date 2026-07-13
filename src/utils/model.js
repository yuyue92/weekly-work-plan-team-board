import { HOUR_KEYS } from "../constants/index.js";
import { formatDate } from "./date.js";

// ── 前端 WorkItem 模型 ──────────────────────────────
// 与 Supabase work_items + tasks 表做双向转换

export function createEmptyItem(ownerId = "") {
  return {
    id:                   null,   // Supabase 生成，新建时为 null
    owner_id:             ownerId,
    work_item:            "",
    project_name:         "",
    priority:             "Medium",
    status:               "pending",
    expect_complete_date: "",
    create_date:          formatDate(new Date()), // 仍然记录，只是不在编辑弹框里展示了
    hours:                Object.fromEntries(HOUR_KEYS.map(k => [k, 0])),
    tasks:                []
  };
}

export function createEmptyTask() {
  return {
    id:             null,
    work_item_id:   null,
    task_name:      "",
    description:    "",
    remark_blocker: "",
    sort_order:     0
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
    sort_order:     row.sort_order     ?? 0
  };
}

// 前端 task → Supabase insert/update payload
export function taskToRow(task, workItemId) {
  return {
    work_item_id:   workItemId || task.work_item_id,
    task_name:      task.task_name      || "",
    description:    task.description    || "",
    remark_blocker: task.remark_blocker || "",
    sort_order:     task.sort_order     ?? 0
  };
}

// Supabase 行 → 前端 workItem 对象（tasks 需单独传入）
export function rowToItem(row, tasks = []) {
  return {
    id:                   row.id,
    owner_id:             row.owner_id,
    work_item:            row.work_item            || "",
    project_name:         row.project_name         || "",
    priority:             row.priority              || "Medium",
    status:               row.status               || "pending",
    expect_complete_date: row.expect_complete_date || "",
    create_date:          row.create_date          || "",
    hours:                Object.fromEntries(
      HOUR_KEYS.map(k => [k, Number(row[`${k}_hours`]) || 0])
    ),
    tasks:                tasks.map(rowToTask)
  };
}

// 前端 workItem → Supabase INSERT payload（新增时用，字段最全）
export function itemToRow(item, teamId, year, weekKey) {
  const hourFields = Object.fromEntries(
    HOUR_KEYS.map(k => [`${k}_hours`, Number(item.hours?.[k]) || 0])
  );
  return {
    team_id:              teamId,
    owner_id:             item.owner_id,
    year:                 Number(year),
    week_key:             weekKey,
    status:               item.status               || "pending",
    work_item:            item.work_item            || "",
    project_name:         item.project_name         || "",
    priority:             item.priority             || "Low",
    expect_complete_date: item.expect_complete_date || null,
    create_date:          item.create_date          || null,
    ...hourFields
  };
}

// 前端 workItem → Supabase UPDATE payload（编辑时用，不带 team_id/owner_id/year/week_key/create_date，
// 避免弹框里的一次保存意外把这些"归属类"字段带偏）
export function itemToUpdateRow(item) {
  const hourFields = Object.fromEntries(
    HOUR_KEYS.map(k => [`${k}_hours`, Number(item.hours?.[k]) || 0])
  );
  return {
    status:               item.status               || "pending",
    work_item:            item.work_item            || "",
    project_name:         item.project_name         || "",
    priority:             item.priority             || "Low",
    expect_complete_date: item.expect_complete_date || null,
    ...hourFields
  };
}

export function totalWeeklyHours(item) {
  return HOUR_KEYS.reduce((sum, k) => sum + (Number(item.hours?.[k]) || 0), 0);
}

export function isMeaningfulItem(item) {
  return Boolean(
    String(item.work_item || "").trim() ||
    item.expect_complete_date ||
    HOUR_KEYS.some(k => Number(item.hours?.[k]) > 0) ||
    (Array.isArray(item.tasks) && item.tasks.some(isMeaningfulTask))
  );
}

export function isMeaningfulTask(task) {
  if (!task) return false;
  return Boolean(
    String(task.task_name      || "").trim() ||
    String(task.description    || "").trim() ||
    String(task.remark_blocker || "").trim()
  );
}

export function cloneItem(item) {
  return JSON.parse(JSON.stringify(item));
}