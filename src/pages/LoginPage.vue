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
        >登录</button>
        <button
          class="auth-tab"
          :class="{ active: mode === 'register' }"
          @click="mode = 'register'; clearMsg()"
        >注册</button>
      </div>

      <!-- 登录表单 -->
      <div v-if="mode === 'login'">
        <div class="form-group">
          <label>邮箱</label>
          <input class="form-control" type="email" v-model="email" placeholder="xxx@pccw.com" @keyup.enter="doLogin" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input class="form-control" type="password" v-model="password" @keyup.enter="doLogin" />
        </div>
        <div v-if="errorMsg" class="auth-error">{{ errorMsg }}</div>
        <button class="btn btn-primary auth-btn" :disabled="submitting" @click="doLogin">
          {{ submitting ? "登录中..." : "登录" }}
        </button>
      </div>

      <!-- 注册表单 -->
      <div v-if="mode === 'register'">
        <div class="form-group">
          <label>显示名称（看板中显示的姓名）</label>
          <input class="form-control" type="text" v-model="displayName" placeholder="e.g. Zhang San" />
        </div>
        <div class="form-group">
          <label>邮箱（仅限 @pccw.com）</label>
          <input class="form-control" type="email" v-model="email" placeholder="xxx@pccw.com" />
        </div>
        <div class="form-group">
          <label>密码（至少 6 位）</label>
          <input class="form-control" type="password" v-model="password" />
        </div>
        <div v-if="errorMsg"   class="auth-error">{{ errorMsg }}</div>
        <div v-if="successMsg" class="auth-success">{{ successMsg }}</div>
        <button class="btn btn-primary auth-btn" :disabled="submitting" @click="doRegister">
          {{ submitting ? "注册中..." : "注册" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
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

function clearMsg() {
  errorMsg.value   = "";
  successMsg.value = "";
}

async function doLogin() {
  if (!email.value || !password.value) { errorMsg.value = "请填写邮箱和密码"; return; }
  submitting.value = true;
  clearMsg();
  const { error } = await signIn(email.value.trim(), password.value);
  submitting.value = false;
  if (error) { errorMsg.value = error.message; return; }
  router.push({ name: "Board" });
}

async function doRegister() {
  if (!displayName.value.trim()) { errorMsg.value = "请填写显示名称"; return; }
  if (!email.value || !password.value) { errorMsg.value = "请填写邮箱和密码"; return; }
  if (password.value.length < 6) { errorMsg.value = "密码至少 6 位"; return; }
  submitting.value = true;
  clearMsg();
  const { error } = await signUp(email.value.trim(), password.value, displayName.value.trim());
  submitting.value = false;
  if (error) { errorMsg.value = error.message; return; }
  successMsg.value = "注册成功！请查收邮件确认链接，然后回来登录。";
  password.value   = "";
}
</script>
