import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";
import { useAuth } from "./composables/useAuth.js";
import "./assets/main.css";

const app = createApp(App);
app.use(router);

// 先初始化 auth（恢复 session），再挂载应用，避免路由守卫判断时 session 还没就绪
const { init } = useAuth();
init().then(() => app.mount("#app"));
