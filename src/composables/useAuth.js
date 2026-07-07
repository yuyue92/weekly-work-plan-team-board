import { ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import { ALLOWED_EMAIL_DOMAIN } from "../constants/index.js";

const session  = ref(null);   // Supabase session
const profile  = ref(null);   // public.profiles 行
const loading  = ref(true);   // 初始化时等待 session 恢复

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
    if (s) await fetchProfile(s.user.id);
    loading.value = false;

    // 监听登录状态变化（token 刷新、其他 tab 登出等）
    supabase.auth.onAuthStateChange(async (_event, s) => {
      session.value = s;
      if (s) await fetchProfile(s.user.id);
      else   profile.value = null;
    });
  }

  // ── 读取 profile ─────────────────────────────────
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
    if (!error && data.user) await fetchProfile(data.user.id);
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
