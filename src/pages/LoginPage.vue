<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1 class="auth-title">Weekly Work Plan</h1>
      <p class="auth-subtitle">Team Board</p>

      <!-- Tab 切换 -->
      <div class="auth-tabs">
        <button
          class="auth-tab"
          :class="{ active: mode === 'login' }"
          @click="mode = 'login'; clearMsg()"
        >Log In</button>
        <button
          class="auth-tab"
          :class="{ active: mode === 'register' }"
          @click="mode = 'register'; clearMsg()"
        >Sign Up</button>
      </div>

      <!-- 登录表单 -->
      <div v-if="mode === 'login'">
        <div class="form-group">
          <label>Email</label>
          <input class="form-control" type="email" v-model="email" placeholder="xxx@pccw.com" @keyup.enter="doLogin" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <div class="auth-password-wrap">
            <input class="form-control" :type="showPassword ? 'text' : 'password'" v-model="password" @keyup.enter="doLogin" />
            <button
              type="button"
              class="auth-password-toggle"
              @click="showPassword = !showPassword">
              <!-- 隐藏密码 -->
              <svg
                v-if="showPassword"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.6 10.6 0 0112 4c5.5 0 9 5 9 5a16 16 0 01-3.1 3.6M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5a10.8 10.8 0 004-.8" />
              </svg>
  
              <!-- 显示密码 -->
              <svg
                v-else
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </button>
          </div>
        </div>
        <div v-if="errorMsg" class="auth-error">{{ errorMsg }}</div>
        <button class="btn btn-primary auth-btn" :disabled="submitting" @click="doLogin">
          {{ submitting ? "Logging in..." : "Log In" }}
        </button>
      </div>

      <!-- 注册表单 -->
      <div v-if="mode === 'register'">
        <div class="form-group">
          <label>Display Name (shown on the board)</label>
          <input class="form-control" type="text" v-model="displayName" placeholder="e.g. Zhang San" />
        </div>
        <div class="form-group">
          <label>Email (must be @pccw.com)</label>
          <input class="form-control" type="email" v-model="email" placeholder="xxx@pccw.com" />
        </div>
        <div class="form-group">
          <label>Password (at least 6 characters)</label>
          <div class="auth-password-wrap">
            <input class="form-control" :type="showPassword ? 'text' : 'password'" v-model="password" />
            <button
              type="button"
              class="auth-password-toggle"
              @click="showPassword = !showPassword">
              <!-- 隐藏密码 -->
              <svg
                v-if="showPassword"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.6 10.6 0 0112 4c5.5 0 9 5 9 5a16 16 0 01-3.1 3.6M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5a10.8 10.8 0 004-.8" />
              </svg>
  
              <!-- 显示密码 -->
              <svg
                v-else
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </button>
          </div>
        </div>
        <div v-if="errorMsg"   class="auth-error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="auth-success">{{ successMsg }}</div>
        <button class="btn btn-primary auth-btn" :disabled="submitting" @click="doRegister">
          {{ submitting ? "Signing up..." : "Sign Up" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth.js";

const router      = useRouter();
const { signIn, signUp } = useAuth();

const mode        = ref("login");
const email       = ref("");
const password    = ref("");
const displayName = ref("");
const errorMsg    = ref("");
const successMsg  = ref("");
const submitting  = ref(false);
const showPassword = ref(false)

const REMEMBER_EMAIL_KEY = "weekly-work-plan:last-email";

onMounted(() => {
  email.value = localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
});

function clearMsg() {
  errorMsg.value   = "";
  successMsg.value = "";
}

async function doLogin() {
  if (!email.value || !password.value) { errorMsg.value = "Please enter your email and password"; return; }
  submitting.value = true;
  clearMsg();
  const normalizedEmail = email.value.trim().toLowerCase();
  const { error } = await signIn(normalizedEmail, password.value);
  submitting.value = false;
  if (error) { errorMsg.value = error.message; return; }
  localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail);
  router.push({ name: "Board" });
}

async function doRegister() {
  if (!displayName.value.trim()) { errorMsg.value = "Please enter a display name"; return; }
  if (!email.value || !password.value) { errorMsg.value = "Please enter your email and password"; return; }
  if (password.value.length < 6) { errorMsg.value = "Password must be at least 6 characters"; return; }
  submitting.value = true;
  clearMsg();
  const normalizedEmail = email.value.trim().toLowerCase();
  const {data, error } = await signUp(normalizedEmail, password.value, displayName.value.trim());
  submitting.value = false;
  if (error) { errorMsg.value = error.message; return; }
  
  // 当前 Supabase 已关闭邮箱验证，signUp 会直接返回可用 session：自动登录并跳转；
  // 如果之后重新开启邮箱验证，data.session 会是 null，走下面的提示分支
  if (data?.session) {
    localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail);
    successMsg.value = "Sign-up successful, logging you in automatically…";
    router.push({ name: "Board" });
    return;
  }
  localStorage.setItem(REMEMBER_EMAIL_KEY, normalizedEmail);
  successMsg.value = "Sign-up successful! Please check your email to verify your account, then log in from the [Log In] tab.";
  password.value = "";
  mode.value = "login";
}
</script>
