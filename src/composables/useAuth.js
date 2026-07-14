// useAuth.js — Supabase Auth 登录/注册 + 会话超时控制
import { ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import { ALLOWED_EMAIL_DOMAIN } from "../constants/index.js";

// ── 会话控制策略 ─────────────────────────────────────────
// 1. 空闲 30 分钟自动退出；
// 2. 退出前 5 分钟显示提醒；
// 3. 绝对最长会话：8 小时（超过强制退出，重新登录）。
const IDLE_TIMEOUT_MS         = 10 * 60 * 1000;
const IDLE_WARNING_BEFORE_MS  = 2  * 60 * 1000;
const ABSOLUTE_SESSION_TTL_MS = 8  * 60 * 60 * 1000;
const ACTIVITY_THROTTLE_MS    = 15 * 1000;

const SESSION_STARTED_AT_KEY = "weekly_board_session_started_at";
const LAST_ACTIVITY_AT_KEY   = "weekly_board_last_activity_at";

const session  = ref(null);   // Supabase session
const profile  = ref(null);   // public.profiles 行
const loading  = ref(true);   // 初始化时等待 session 恢复

const sessionWarningVisible   = ref(false); // 是否显示"即将过期"提醒
const sessionRemainingSeconds = ref(0);     // 提醒里的倒计时（秒）

let authListenerRegistered = false;
let lastAppliedToken       = null; // 记录已处理过的 access_token，避免同一个 session 被重复处理

let warningTimer   = null;
let expiryTimer    = null;
let remainingTimer = null;
let activityListenersBound = false;
let lastActivityWriteAt    = 0;
let signingOut             = false;

// ── 就绪 Promise：init() 完成时 resolve 一次，路由守卫直接 await 它 ──
let readyResolve = null;
const readyPromise = new Promise(resolve => { readyResolve = resolve; });
function markReady() {
  loading.value = false;
  if (readyResolve) { readyResolve(); readyResolve = null; }
}

// ── localStorage 时间戳读写 ────────────────────────────────
function readTimestamp(key) {
  const raw = window.localStorage.getItem(key);
  const ts = Number(raw);
  return Number.isFinite(ts) && ts > 0 ? ts : null;
}
function writeTimestampNow(key) {
  const now = Date.now();
  window.localStorage.setItem(key, String(now));
  return now;
}
function getSessionStartedAt()    { return readTimestamp(SESSION_STARTED_AT_KEY); }
function getLastActivityAt()      { return readTimestamp(LAST_ACTIVITY_AT_KEY); }
function setSessionStartedAtNow() { return writeTimestampNow(SESSION_STARTED_AT_KEY); }
function setLastActivityAtNow()   { return writeTimestampNow(LAST_ACTIVITY_AT_KEY); }
function clearStoredSessionTimes() {
  window.localStorage.removeItem(SESSION_STARTED_AT_KEY);
  window.localStorage.removeItem(LAST_ACTIVITY_AT_KEY);
}

// ── 定时器管理 ────────────────────────────────────────────
function clearSessionTimers() {
  if (warningTimer)   { window.clearTimeout(warningTimer);   warningTimer = null; }
  if (expiryTimer)    { window.clearTimeout(expiryTimer);    expiryTimer = null; }
  if (remainingTimer) { window.clearInterval(remainingTimer); remainingTimer = null; }
}

function getAbsoluteExpiresAt(sessionStartedAt) {
  return sessionStartedAt + ABSOLUTE_SESSION_TTL_MS;
}
function isIdleExpired(lastActivityAt)       { return Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS; }
function isAbsoluteExpired(sessionStartedAt) { return Date.now() >= getAbsoluteExpiresAt(sessionStartedAt); }

function updateRemainingSeconds(expiresAt) {
  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  sessionRemainingSeconds.value = remaining;
  return remaining;
}
function startRemainingTicker(expiresAt) {
  if (remainingTimer) { window.clearInterval(remainingTimer); remainingTimer = null; }
  // 倒计时归零时兜底强制登出，不依赖 expiryTimer 是否按预期触发——
  // 万一 expiryTimer 中途被别的地方（比如 TOKEN_REFRESHED 触发的 scheduleSessionTimers）
  // 清掉又没有正确重排，这里作为最后一道保险，保证倒计时到 0 一定会真正登出，
  // 不会出现卡在 00:00 停在原地的情况。
  const tick = () => {
    const remaining = updateRemainingSeconds(expiresAt);
    if (remaining <= 0) {
      if (remainingTimer) { window.clearInterval(remainingTimer); remainingTimer = null; }
      signOut();
    }
  };

  tick();
  if (sessionRemainingSeconds.value > 0) {
    remainingTimer = window.setInterval(tick, 1000);
  }
}
function showSessionWarning(expiresAt) {
  sessionWarningVisible.value = true;
  startRemainingTicker(expiresAt);
}
function hideSessionWarning() {
  sessionWarningVisible.value = false;
  sessionRemainingSeconds.value = 0;
  if (remainingTimer) { window.clearInterval(remainingTimer); remainingTimer = null; }
}

// 根据"空闲到期时间"和"绝对到期时间"里更早的那个，安排提醒定时器 + 强退定时器
function scheduleSessionTimers(sessionStartedAt, lastActivityAt) {
  clearSessionTimers();
  hideSessionWarning();

  const now = Date.now();
  const idleExpiresAt     = lastActivityAt + IDLE_TIMEOUT_MS;
  const absoluteExpiresAt = getAbsoluteExpiresAt(sessionStartedAt);
  const expiresAt         = Math.min(idleExpiresAt, absoluteExpiresAt);

  if (now >= expiresAt) {
    signOut();
    return;
  }

  const idleWarningAt     = idleExpiresAt - IDLE_WARNING_BEFORE_MS;
  const absoluteWarningAt = absoluteExpiresAt - IDLE_WARNING_BEFORE_MS;
  const warningAt         = Math.min(idleWarningAt, absoluteWarningAt);

  if (now >= warningAt) {
    showSessionWarning(expiresAt);
  } else {
    warningTimer = window.setTimeout(() => showSessionWarning(expiresAt), warningAt - now);
  }

  expiryTimer = window.setTimeout(() => signOut(), expiresAt - now);
}

// 用户有实际操作时调用：刷新"最后活动时间"，重新计算定时器
// 注意：只续"空闲 30 分钟"这个时钟，不会延长"绝对 8 小时"这个上限
function refreshActivity() {
  if (!session.value) return;

  const sessionStartedAt = getSessionStartedAt();
  if (!sessionStartedAt || isAbsoluteExpired(sessionStartedAt)) {
    signOut();
    return;
  }

  const lastActivityAt = setLastActivityAtNow();
  lastActivityWriteAt = lastActivityAt;
  scheduleSessionTimers(sessionStartedAt, lastActivityAt);
}

function handleActivityEvent(event) {
  if (!session.value) return;
  if (event?.type === "visibilitychange" && document.visibilityState !== "visible") return;

  // 过期提醒弹出期间，不再靠"任意活动"自动续期/关闭提醒——
  // 否则鼠标划过提醒卡片就被判定成一次"活动"，卡片会在用户点到按钮之前就先消失了。
  // 提醒弹出后只能通过卡片上的【Continue Session】按钮显式续期（该按钮直接调用 continueSession()，
  // 不经过这里，不受这条 return 影响）。
  if (sessionWarningVisible.value) return;

  const now = Date.now();
  // 提醒已经弹出时，任意操作都立即续期；平时节流写入，避免 mousemove 高频触发
  if (now - lastActivityWriteAt >= ACTIVITY_THROTTLE_MS) {
    refreshActivity();
  }
}

function bindActivityListeners() {
  if (activityListenersBound || typeof window === "undefined") return;
  ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(eventName => {
    window.addEventListener(eventName, handleActivityEvent, { passive: true });
  });
  document.addEventListener("visibilitychange", handleActivityEvent);
  activityListenersBound = true;
}
function unbindActivityListeners() {
  if (!activityListenersBound || typeof window === "undefined") return;
  ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(eventName => {
    window.removeEventListener(eventName, handleActivityEvent);
  });
  document.removeEventListener("visibilitychange", handleActivityEvent);
  activityListenersBound = false;
}

// ── 登出 ─────────────────────────────────────────
async function signOut() {
  if (signingOut) return;
  signingOut = true;

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("Supabase signOut failed, clearing local session:", error.message);
    }
  } finally {
    lastAppliedToken = null;
    session.value = null;
    profile.value = null;
    hideSessionWarning();
    clearSessionTimers();
    clearStoredSessionTimes();
    unbindActivityListeners();
    lastActivityWriteAt = 0;
    signingOut = false;
  }
}

export function useAuth() {
  // ── 计算属性 ────────────────────────────────────
  const isLoggedIn  = computed(() => Boolean(session.value));
  const isAdmin     = computed(() => profile.value?.role === "admin");
  const currentUser = computed(() => ({
    id:           session.value?.user?.id || null,
    email:        session.value?.user?.email || "",
    displayName:  profile.value?.display_name || "",
    role:         profile.value?.role || "staff"
  }));

  function whenReady() {
    return readyPromise;
  }

  // ── 初始化：恢复 session ──────────────────────────
  async function init() {
    loading.value = true;
    const { data: { session: s } } = await supabase.auth.getSession();
    // 注意：这里不传 resetSession，刷新页面/重开标签页不会顺带延长"绝对 8 小时"上限，
    // 会按 localStorage 里已经记录的起始时间继续倒计时。
    await applySession(s);
    markReady();

    if (!authListenerRegistered) {
      authListenerRegistered = true;
      supabase.auth.onAuthStateChange(async (event, s) => {
        if (event === "SIGNED_OUT" || !s) {
          await applySession(null);
          return;
        }
        // 只有真正的登录事件才重置计时起点；TOKEN_REFRESHED 这种后台静默刷新不算
        await applySession(s, { resetSession: event === "SIGNED_IN" });
      });
    }
  }

  // ── 唯一的"设置登录状态"入口 ──────────────────────
  async function applySession(s, options = {}) {
    if (!s) {
      lastAppliedToken = null;
      session.value = null;
      profile.value = null;
      hideSessionWarning();
      clearSessionTimers();
      clearStoredSessionTimes();
      unbindActivityListeners();
      lastActivityWriteAt = 0;
      return;
    }

    if (s.access_token === lastAppliedToken && !options.resetSession) return;
    lastAppliedToken = s.access_token;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", s.user.id)
      .single();

    if (!error && data?.is_disabled) {
      // 账号已被禁用：不设置 session/profile，直接强制登出
      await supabase.auth.signOut();
      lastAppliedToken = null;
      session.value = null;
      profile.value = null;
      return;
    }

    session.value = s;
    profile.value = error ? null : data;

    // ── 会话超时控制：登录成功/恢复 session 后启动倒计时 ──
    let sessionStartedAt = getSessionStartedAt();
    let lastActivityAt   = getLastActivityAt();

    if (options.resetSession || !sessionStartedAt) {
      sessionStartedAt = setSessionStartedAtNow();
    }
    if (options.resetSession || !lastActivityAt) {
      lastActivityAt = setLastActivityAtNow();
    }

    if (isAbsoluteExpired(sessionStartedAt) || isIdleExpired(lastActivityAt)) {
      await signOut();
      return;
    }

    bindActivityListeners();
    scheduleSessionTimers(sessionStartedAt, lastActivityAt);
  }

  // ── 读取 profile ──────────────────────────────────
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error) profile.value = data;
  }

  // ── 注册 ─────────────────────────────────────────
  async function signUp(email, password, displayName) {
    if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      return { error: { message: `Only ${ALLOWED_EMAIL_DOMAIN} email addresses are allowed to register` } };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    });
    return { data, error };
  }

  // ── 登录 ─────────────────────────────────────────
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data, error };

    await applySession(data.session, { resetSession: true });

    if (!session.value) {
      return { data: null, error: { message: "This account has been disabled. Please contact an administrator." } };
    }
    return { data, error };
  }

  // "即将过期"提醒里点【继续使用】调用这个：等价于产生一次新的用户操作，重新计时
  function continueSession() {
    refreshActivity();
  }

  return {
    session,
    profile,
    loading,
    isLoggedIn,
    isAdmin,
    currentUser,
    sessionWarningVisible,
    sessionRemainingSeconds,
    init,
    whenReady,
    signUp,
    signIn,
    signOut,
    fetchProfile,
    continueSession
  };
}