import { ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import { ALLOWED_EMAIL_DOMAIN } from "../constants/index.js";

const session  = ref(null);   // Supabase session
const profile  = ref(null);   // public.profiles 行
const loading  = ref(true);   // 初始化时等待 session 恢复
let authListenerRegistered = false;

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

  // ── 初始化：恢复 session ──────────────────────────
  async function init() {
    loading.value = true;
    const { data: { session: s } } = await supabase.auth.getSession();
    session.value = s;
    if (s) await fetchProfile(s.user.id);// 内部若发现 is_disabled 会自动 signOut
    loading.value = false;

    // 监听登录状态变化（token 刷新、其他 tab 登出等）——避免 init() 被多次调用时重复订阅
    if (!authListenerRegistered) {
      authListenerRegistered = true;
      supabase.auth.onAuthStateChange(async (_event, s) => {
        session.value = s;
        if (s) await fetchProfile(s.user.id);
        else   profile.value = null;
      });
    }
  }

  // ── 读取 profile ─────────────────────────────────
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error) profile.value = data;
    // 账号已被管理员禁用：直接强制登出，不允许停留在已登录状态
    if (data?.is_disabled) {
      await supabase.auth.signOut();
      session.value = null;
      profile.value = null;
      return { disabled: true };
    }
    return { disabled: false };
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

    const result = await fetchProfile(data.user.id);
    if (result?.disabled) {
      return { data: null, error: { message: "该账号已被停用，请联系管理员" } };
    }
    return { data, error };
  }

  // ── 登出 ─────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut();
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
    signUp,
    signIn,
    signOut,
    fetchProfile
  };
}
