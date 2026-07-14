<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <h1 class="auth-title">Weekly Work Plan</h1>
      <p class="auth-subtitle">Team Board</p>

      <!-- Reset password mode: landed here after clicking the emailed link -->
      <template v-if="isResetRoute">
        <div class="form-group">
          <label>New Password (at least 6 characters)</label>
          <div class="auth-password-wrap">
            <input class="form-control" :type="showPassword ? 'text' : 'password'" v-model="password" @keyup.enter="doUpdatePassword" />
            <button type="button" class="auth-password-toggle" @click="showPassword = !showPassword">
              <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.6 10.6 0 0112 4c5.5 0 9 5 9 5a16 16 0 01-3.1 3.6M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5a10.8 10.8 0 004-.8" /></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" /><circle cx="12" cy="12" r="2.5" /></svg>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Confirm New Password</label>
          <input class="form-control" type="password" v-model="confirmPassword" @keyup.enter="doUpdatePassword" />
        </div>
        <div v-if="errorMsg" class="auth-error">{{ errorMsg }}</div>
        <button class="btn btn-primary auth-btn" :disabled="submitting" @click="doUpdatePassword">
          {{ submitting ? "Saving..." : "Save New Password" }}
        </button>
        <p class="auth-hint">After saving, this temporary session will end and you'll need to log in with your new password.</p>
      </template>

      <!-- Forgot password mode: just send the reset email -->
      <template v-else-if="mode === 'forgot'">
        <div class="form-group">
          <label>Registered Email</label>
          <input class="form-control" type="email" v-model="email" placeholder="xxx@pccw.com" @keyup.enter="doRequestReset" />
        </div>
        <div v-if="errorMsg" class="auth-error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="auth-success">{{ successMsg }}</div>
        <button class="btn btn-primary auth-btn" :disabled="submitting" @click="doRequestReset">
          {{ submitting ? "Sending..." : "Send Reset Email" }}
        </button>
        <div class="auth-secondary">
          <button type="button" class="auth-link-btn" @click="mode = 'login'; clearMsg()">Back to Log In</button>
        </div>
      </template>

      <!-- Normal login / sign up -->
      <template v-else>
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
          <div v-if="resetSuccessNotice" class="auth-success">Your password has been reset. Please log in with your new password.</div>
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
          <div class="auth-secondary auth-secondary-right">
            <button type="button" class="auth-link-btn" @click="mode = 'forgot'; clearMsg()">Forgot password?</button>
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
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth.js";

const route  = useRoute();
const router = useRouter();
const { signIn, signUp, signOut, requestPasswordReset, updatePassword } = useAuth();

const isResetRoute = computed(() => route.name === "ResetPassword");
const resetSuccessNotice = computed(() => route.query.resetSuccess === "1");

const mode          = ref("login");
const email          = ref("");
const password       = ref("");
const confirmPassword = ref("");
const displayName    = ref("");
const errorMsg       = ref("");
const successMsg     = ref("");
const submitting     = ref(false);
const showPassword   = ref(false);

const REMEMBER_EMAIL_KEY = "weekly-work-plan:last-email";

onMounted(() => {
  email.value = localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
});

function clearMsg() {
  errorMsg.value   = "";
  successMsg.value = "";
}

function friendlyAuthError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "Incorrect email or password, or this email hasn't registered yet.";
  if (message.includes("email not confirmed")) return "This email hasn't been verified yet. Please check your inbox for the verification link.";
  if (message.includes("already registered")) return "This email is already registered. Please log in instead.";
  if (message.includes("rate limit")) return "Too many attempts. Please try again later.";
  if (message.includes("recovery") || message.includes("token") || message.includes("session")) {
    return "This reset link may have expired or already been used. Please request a new one.";
  }
  if (message.includes("password")) return "Password doesn't meet the requirements — please use at least 6 characters.";
  return error?.message || "Something went wrong. Please try again.";
}

async function doLogin() {
  if (!email.value || !password.value) { errorMsg.value = "Please enter your email and password"; return; }
  submitting.value = true;
  clearMsg();
  const normalizedEmail = email.value.trim().toLowerCase();
  const { error } = await signIn(normalizedEmail, password.value);
  submitting.value = false;
  if (error) { errorMsg.value = friendlyAuthError(error); return; }
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
  const { data, error } = await signUp(normalizedEmail, password.value, displayName.value.trim());
  submitting.value = false;
  if (error) { errorMsg.value = friendlyAuthError(error); return; }

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

async function doRequestReset() {
  if (!email.value) { errorMsg.value = "Please enter your registered email"; return; }
  submitting.value = true;
  clearMsg();
  const { error } = await requestPasswordReset(email.value);
  submitting.value = false;
  if (error) { errorMsg.value = friendlyAuthError(error); return; }
  successMsg.value = "Reset email sent. Please check your inbox and click the link to continue.";
}

async function doUpdatePassword() {
  errorMsg.value = "";
  if (!password.value || password.value.length < 6) { errorMsg.value = "New password must be at least 6 characters"; return; }
  if (password.value !== confirmPassword.value) { errorMsg.value = "The two passwords you entered don't match"; return; }

  submitting.value = true;
  const { error } = await updatePassword(password.value);
  if (error) {
    submitting.value = false;
    errorMsg.value = friendlyAuthError(error);
    return;
  }

  await signOut();
  submitting.value = false;
  router.push({ name: "Login", query: { resetSuccess: "1" } });
}
</script>