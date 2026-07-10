const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function startOfWeekMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

export function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatTimestampForFile(date) {
  return `${date.getFullYear()}${pad2(date.getMonth()+1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

export function pad2(v) {
  return String(v).padStart(2, "0");
}

// "2026-01-10" → "Jan-10"，用于弹框里 Mon~Fri 下面展示具体日期
export function formatMonthDayLabel(dateString) {
  if (!dateString) return "";
  const date = parseDate(dateString);
  return `${MONTH_ABBR[date.getMonth()]}-${pad2(date.getDate())}`;
}

export function buildWorkWeeks(year) {
  const firstDay = new Date(year, 0, 1);
  const lastDay  = new Date(year, 11, 31);
  let start = startOfWeekMonday(firstDay);
  const weeks = [];
  let weekNo = 1;
  while (start <= lastDay) {
    const days = Array.from({ length: 5 }, (_, i) => addDays(start, i)).map(formatDate);
    weeks.push({
      key: `${year}-W${pad2(weekNo)}`,
      weekNo,
      startDate: days[0],
      endDate:   days[4],
      days,
      label: `week ${weekNo} ${days[0]} ~ ${days[4]}`
    });
    start = addDays(start, 7);
    weekNo++;
  }
  return weeks;
}

export function getDefaultWeekKey(year, weekOptions) {
  const today = new Date();
  if (today.getFullYear() !== Number(year)) return weekOptions[0]?.key || "";
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const match = weekOptions.find(w => {
    const mon = parseDate(w.startDate);
    const sun = addDays(mon, 6);
    return todayOnly >= mon && todayOnly <= sun;
  });
  return match?.key || weekOptions[0]?.key || "";
}

export function normalizeYear(value) {
  const y = Number(value);
  if (!Number.isInteger(y)) return new Date().getFullYear();
  return Math.min(2100, Math.max(2000, y));
}
