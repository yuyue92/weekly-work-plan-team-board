import { ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import { ALLOWED_EMAIL_DOMAIN } from "../constants/index.js";

const session  = ref(null);   // Supabase session
const profile  = ref(null);   // public.profiles 行
const loading  = ref(true);   // 初始化时等待 session 恢复
let authListenerRegistered = false;
let lastAppliedToken       = null; // 记录已处理过的 access_token，避免同一个 session 被重复处理

// ── 就绪 Promise：init() 完成时 resolve 一次，路由守卫直接 await 它，
//    彻底替代 setInterval 轮询，避免残留计时器、轮询粒度等一系列不确定性 ──
let readyResolve = null;
const readyPromise = new Promise(resolve => { readyResolve = resolve; });
function markReady() {
  loading.value = false;
  if (readyResolve) { readyResolve(); readyResolve = null; }
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

  // 供路由守卫等待"session 初始化是否完成"，不用再手写轮询
  function whenReady() {
    return readyPromise;
  }
  // ── 初始化：恢复 session ──────────────────────────
  async function init() {
    loading.value = true;
    const { data: { session: s } } = await supabase.auth.getSession();
    await applySession(s);
    markReady();

    // 监听登录状态变化（token 刷新、其他 tab 登出等）——避免 init() 被多次调用时重复订阅
    if (!authListenerRegistered) {
      authListenerRegistered = true;
      supabase.auth.onAuthStateChange(async (_event, s) => {
        await applySession(s);
      });
    }
  }

  // ── 唯一的"设置登录状态"入口 ──────────────────────
  // 关键点 1：先查完 profile、确认没被禁用，才允许 session.value 变成非空，
  //          避免"先标记已登录、后台再补检查"的时间差（问题 2 的根因）。
  // 关键点 2：同一个 session（signIn() 手动调用 + onAuthStateChange 自动触发）
  //          用 access_token 去重，只处理一次，减少重复请求，避免拖长等待
  //          时间触发路由守卫里的"等待 session 初始化超时"警告（问题 1 的根因）。
  async function applySession(s) {
    if (!s) {
      lastAppliedToken = null;
      session.value = null;
      profile.value = null;
      return;
    }

    if (s.access_token === lastAppliedToken) return;
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
  }

  // ── 读取 profile（供 AdminPage 等场景手动刷新用，不涉及登录态判断）─────
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
      return { error: { message: `仅允许 ${ALLOWED_EMAIL_DOMAIN} 邮箱注册` } };
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

    await applySession(data.session);

    // applySession 里如果检测到 is_disabled，会把 session.value 置回 null
    if (!session.value) {
      return { data: null, error: { message: "该账号已被停用，请联系管理员" } };
    }
    return { data, error };
  }

  // ── 登出 ─────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut();
    lastAppliedToken = null;
    session.value = null;
    profile.value = null;
  }

  return {
    session,
    profile,
    loading,
    isLoggedIn,
    isAdmin,
    currentUser,
    init,
    whenReady,
    signUp,
    signIn,
    signOut,
    fetchProfile
  };
}