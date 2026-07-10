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

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Work Item 每天的工时字段 key，和 work_items 表里的 mon_hours ~ fri_hours 一一对应
export const HOUR_KEYS = ["mon", "tue", "wed", "thu", "fri"];

// 工时下拉选项：0, 0.5, 1 ... 8，共 17 档
export const HOUR_OPTIONS = Array.from(
  { length: 17 },
  (_, i) => Math.round(i * 0.5 * 10) / 10
);

// Project Name 先用固定下拉列表，不建表；以后要接 Supabase 表的话把这里换成异步拉取即可
export const PROJECT_NAMES = [
  "Customer_Service_Process",
  "Internal_Tooling",
  "Platform_Migration",
  "Data_Analytics",
  "Other"
];