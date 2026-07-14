<template>
  <RouterView />
  <Teleport to="body">
    <div v-if="sessionWarningVisible" class="session-warning-mask">
      <div class="session-warning-card">
        <div class="session-warning-icon">⏳</div>
        <div class="session-warning-title">Your session is about to expire</div>
        <div class="session-warning-desc">
          You've been inactive for a while. You'll be signed out automatically in
          <b>{{ sessionRemainingText }}</b>.
        </div>
        <div class="session-warning-actions">
          <button class="btn btn-primary btn-sm" type="button" @click="continueSession">Continue Session</button>
          <button class="btn btn-light btn-sm" type="button" @click="handleSignOut">Sign Out</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup>
import { computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "./composables/useAuth.js";

const router = useRouter();
const { signOut, isLoggedIn, sessionWarningVisible, sessionRemainingSeconds, continueSession } = useAuth();

const sessionRemainingText = computed(() => {
  const total = sessionRemainingSeconds.value;
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
});

// 统一处理所有登出场景：
// 手动退出、倒计时归零、绝对会话过期、其他标签页退出
watch(isLoggedIn, loggedIn => {
  if (!loggedIn && router.currentRoute.value.name !== "Login") {
    router.replace({ name: "Login" });
  }
});

async function handleSignOut() {
  await signOut();
}
</script>