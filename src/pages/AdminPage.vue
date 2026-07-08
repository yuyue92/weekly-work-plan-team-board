<template>
  <div class="container">
    <header class="app-header">
      <div class="app-hader-sub">
        <h1 class="app-title">成员管理</h1>
        <p class="app-subtitle">管理各 Team 的成员分配</p>
      </div>
      <div class="header-right">
        <button class="btn btn-light btn-sm" @click="$router.push('/')">← 返回看板</button>
      </div>
    </header>

    <div v-if="loading" class="board-loading">加载中...</div>

    <template v-else>
      <!-- 所有已注册用户 -->
      <section class="card" style="margin-bottom:16px;">
        <div class="card-body">
          <h2 class="section-title">已注册用户</h2>
          <p class="section-hint">以下是所有已注册的 @pccw.com 账号，可将其分配到对应 Team。</p>
          <div class="table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>显示名称</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>所在 Team</th>
                  <th>操作</th>
                  <th>危险操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in allProfiles" :key="user.id">
                  <td>{{ user.display_name }}</td>
                  <td>{{ user.email }}</td>
                  <td>
                    <span class="badge badge-role" :class="user.role === 'admin' ? 'badge-admin' : 'badge-staff'">
                      {{ user.role === 'admin' ? 'Admin' : 'Staff' }}
                    </span>
                  </td>
                  <td>
                    <span class="badge" :class="user.is_disabled ? 'badge-staff' : 'badge-admin'">
                      {{ user.is_disabled ? '已禁用' : '正常' }}
                    </span>
                  </td>
                  <td>
                    <span
                      v-if="getUserTeams(user.id).length"
                      class="team-tags"
                    >
                      <span
                        v-for="team in getUserTeams(user.id)"
                        :key="team.id"
                        class="tag"
                      >
                        {{ team.name }}
                        <button
                          class="tag-remove"
                          title="移除"
                          @click="removeMember(user.id, team.id)"
                        >×</button>
                      </span>
                    </span>
                    <span v-else class="text-muted">未分配</span>
                  </td>
                  <td>
                    <div class="assign-row">
                      <select class="form-select form-select-sm" v-model="assignTarget[user.id]">
                        <option value="">选择 Team…</option>
                        <option
                          v-for="team in getAssignableTeams(user.id)"
                          :key="team.id"
                          :value="team.id"
                        >{{ team.name }}</option>
                      </select>
                      <button
                        class="btn btn-primary btn-sm"
                        :disabled="!assignTarget[user.id]"
                        @click="addMember(user.id)"
                      >加入</button>
                    </div>
                  </td>
                  <td>
                    <button
                      v-if="user.id !== currentUser.id && !user.is_disabled"
                      class="btn btn-outline-danger btn-sm"
                      :disabled="togglingUserId === user.id"
                      @click="disableUser(user)"
                    >{{ togglingUserId === user.id ? "处理中..." : "禁用（清空数据）" }}</button>
                    <button
                      v-else-if="user.id !== currentUser.id && user.is_disabled"
                      class="btn btn-outline-primary btn-sm"
                      :disabled="togglingUserId === user.id"
                      @click="enableUser(user)"
                    >{{ togglingUserId === user.id ? "处理中..." : "启用" }}</button>
                    <span v-else class="text-muted" style="font-size:12px;">当前登录账号</span>
                  </td>
                </tr>
                <tr v-if="!allProfiles.length">
                  <td colspan="7" style="text-align:center;color:#94a3b8;padding:18px;">
                    暂无注册用户
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Team 概览 -->
      <section class="card">
        <div class="card-body">
          <h2 class="section-title">Team 成员概览</h2>
          <div class="teams-overview">
            <div v-for="team in allTeams" :key="team.id" class="team-block">
              <div class="team-block-name">{{ team.name }}</div>
              <div v-if="getTeamMembers(team.id).length" class="team-block-members">
                <span v-for="m in getTeamMembers(team.id)" :key="m.user_id" class="tag">
                  {{ getProfile(m.user_id)?.display_name || m.user_id }}
                </span>
              </div>
              <div v-else class="text-muted" style="font-size:13px;">暂无成员</div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Toast -->
    <ToastMessage :message="toastMsg" :visible="toastVisible" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../composables/useAuth.js";
import ToastMessage from "../components/ToastMessage.vue";

const { currentUser } = useAuth();

const loading      = ref(true);
const allProfiles  = ref([]);   // public.profiles 全部
const allTeams     = ref([]);   // public.teams 全部
const teamUsers    = ref([]);   // public.team_users 全部 { team_id, user_id }

const togglingUserId = ref("");
// 每个用户待分配的 team 选择（user_id -> team_id）
const assignTarget = reactive({});

const toastMsg     = ref("");
const toastVisible = ref(false);
let toastTimer     = null;

function showToast(msg) {
  toastMsg.value     = msg;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible.value = false; }, 1800);
}

// ── 数据加载 ─────────────────────────────────────────
async function loadAll() {
  loading.value = true;
  const [profilesRes, teamsRes, teamUsersRes] = await Promise.all([
    supabase.from("profiles").select("*").order("display_name"),
    supabase.from("teams").select("*").order("name"),
    supabase.from("team_users").select("team_id, user_id")
  ]);
  allProfiles.value = profilesRes.data || [];
  allTeams.value    = teamsRes.data    || [];
  teamUsers.value   = teamUsersRes.data || [];
  loading.value     = false;
}

// ── 工具函数 ──────────────────────────────────────────
function getProfile(userId) {
  return allProfiles.value.find(p => p.id === userId);
}

function getUserTeams(userId) {
  const teamIds = teamUsers.value
    .filter(tu => tu.user_id === userId)
    .map(tu => tu.team_id);
  return allTeams.value.filter(t => teamIds.includes(t.id));
}

function getTeamMembers(teamId) {
  return teamUsers.value.filter(tu => tu.team_id === teamId);
}

// 该用户还未加入的 team
function getAssignableTeams(userId) {
  const joined = getUserTeams(userId).map(t => t.id);
  return allTeams.value.filter(t => !joined.includes(t.id));
}

// ── 加入 Team ─────────────────────────────────────────
async function addMember(userId) {
  const teamId = assignTarget[userId];
  if (!teamId) return;
  const { error } = await supabase
    .from("team_users")
    .insert({ team_id: teamId, user_id: userId });
  if (error) { showToast("操作失败：" + error.message); return; }
  assignTarget[userId] = "";
  await loadAll();
  showToast("已加入 Team");
}

// ── 移除 Team ─────────────────────────────────────────
async function removeMember(userId, teamId) {
  const profile = getProfile(userId);
  const team    = allTeams.value.find(t => t.id === teamId);
  if (!confirm(`确定将「${profile?.display_name}」从「${team?.name}」移除吗？`)) return;
  const { error } = await supabase
    .from("team_users")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);
  if (error) { showToast("操作失败：" + error.message); return; }
  await loadAll();
  showToast("已移除");
}

// ── 禁用账号（软删除）：清空该用户 work_items（连带 tasks 级联删除）+ team_users，
//    再把 profiles.is_disabled 置 true。auth.users 本身不动，前端权限做不到删除。
async function disableUser(user) {
  if (user.id === currentUser.value.id) return;

  const confirmText =
    `确定要禁用「${user.display_name}（${user.email}）」吗？\n` +
    `此操作会清空该账号名下的所有 Work Item / Task，且无法恢复，账号也将无法再登录。`;
  if (!confirm(confirmText)) return;

  togglingUserId.value = user.id;
  try {
    const { error: wiErr } = await supabase.from("work_items").delete().eq("owner_id", user.id);
    if (wiErr) throw wiErr;

    const { error: tuErr } = await supabase.from("team_users").delete().eq("user_id", user.id);
    if (tuErr) throw tuErr;

    const { error: profErr } = await supabase.from("profiles").update({ is_disabled: true }).eq("id", user.id);
    if (profErr) throw profErr;

    await loadAll();
    showToast("账号已禁用");
  } catch (err) {
    alert("操作失败：" + (err.message || String(err)));
  } finally {
    togglingUserId.value = "";
  }
}

// ── 重新启用账号（只恢复登录权限，不恢复已清空的数据）───────
async function enableUser(user) {
  togglingUserId.value = user.id;
  try {
    const { error } = await supabase.from("profiles").update({ is_disabled: false }).eq("id", user.id);
    if (error) throw error;
    await loadAll();
    showToast("账号已启用");
  } catch (err) {
    alert("操作失败：" + (err.message || String(err)));
  } finally {
    togglingUserId.value = "";
  }
}

onMounted(loadAll);
</script>
