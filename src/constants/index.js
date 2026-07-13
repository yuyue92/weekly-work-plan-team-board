// TEAMS 和成员列表已移至 Supabase 的 teams / team_users / profiles 表
// 本文件只保留与 UI 逻辑相关的静态常量

export const ALLOWED_EMAIL_DOMAIN = "@pccw.com";

export const STORAGE_KEY = "weekly_work_plan_team_board_v3"; // 保留，用于 JSON 导入导出兼容

export const STATUS_KEYS = ["pending", "processing", "done"];

export const STATUS_LABELS = {
  pending:    "Pending",
  processing: "Processing",
  done:       "Done"
};


export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Work Item 每天的工时字段 key，和 work_items 表里的 mon_hours ~ fri_hours 一一对应
export const HOUR_KEYS = ["mon", "tue", "wed", "thu", "fri"];
