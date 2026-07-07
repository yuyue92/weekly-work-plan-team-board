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

export const SLOT_KEYS = [
  "mon_am", "tue_am", "wed_am", "thu_am", "fri_am",
  "mon_pm", "tue_pm", "wed_pm", "thu_pm", "fri_pm"
];

export const SLOT_LABELS = [
  "Mon AM", "Tue AM", "Wed AM", "Thu AM", "Fri AM",
  "Mon PM", "Tue PM", "Wed PM", "Thu PM", "Fri PM"
];

export const PREVIEW_SLOT_KEYS = [
  "mon_am", "mon_pm", "tue_am", "tue_pm", "wed_am",
  "wed_pm", "thu_am", "thu_pm", "fri_am", "fri_pm"
];

export const PREVIEW_SLOT_LABELS = [
  "Mon AM", "Mon PM", "Tue AM", "Tue PM", "Wed AM",
  "Wed PM", "Thu AM", "Thu PM", "Fri AM", "Fri PM"
];
