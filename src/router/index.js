import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "../composables/useAuth.js";

const routes = [
  {
    path:      "/login",
    name:      "Login",
    component: () => import("../pages/LoginPage.vue"),
    meta:      { requiresAuth: false }
  },
  {
    path:      "/",
    name:      "Board",
    component: () => import("../pages/BoardPage.vue"),
    meta:      { requiresAuth: true }
  },
  {
    path:      "/admin",
    name:      "Admin",
    component: () => import("../pages/AdminPage.vue"),
    meta:      { requiresAuth: true, requiresAdmin: true }
  },
  // 兜底：未知路由重定向首页
  { path: "/:pathMatch(.*)*", redirect: "/" }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  const { isLoggedIn, isAdmin, loading } = useAuth();

  // 等待 session 初始化完成再做跳转判断（最多等 5 秒，避免网络异常时无限卡住）
  if (loading.value) {
    await Promise.race([
      new Promise(resolve => {
        const stop = setInterval(() => {
          if (!loading.value) { clearInterval(stop); resolve(); }
        }, 50);
      }),
      new Promise(resolve => setTimeout(() => {
        console.warn("等待 session 初始化超时，按未登录处理");
        resolve();
      }, 5000))
    ]);
  }

  if (to.meta.requiresAuth && !isLoggedIn.value) return { name: "Login" };
  if (to.name === "Login" && isLoggedIn.value)   return { name: "Board" };
  if (to.meta.requiresAdmin && !isAdmin.value)   return { name: "Board" };
});

export default router;
