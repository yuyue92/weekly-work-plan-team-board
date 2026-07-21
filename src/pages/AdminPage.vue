<template>
  <div class="container">
    <header class="app-header">
      <div class="app-hader-sub">
        <h1 class="app-title">Admin Settings</h1>
        <p class="app-subtitle">Manage teams, members, and board options</p>
      </div>
      <div class="header-right">
        <button class="btn btn-light btn-sm" @click="$router.push('/')">← Back to Board</button>
      </div>
    </header>

    <div v-if="loading" class="board-loading">Loading...</div>

    <template v-else>
      <!-- 所有已注册用户 -->
      <section class="card" style="margin-bottom:16px;">
        <div class="card-body">
          <h2 class="section-title">Registered Users</h2>
          <p class="section-hint">All registered @pccw.com accounts are listed below. Assign each one to a team.</p>
          <div class="table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Display Name</th>
                  <th>Email</th>
                  <th class="col-width-100">Role</th>
                  <th class="col-width-100">Status</th>
                  <th>Team</th>
                  <th>Actions</th>
                  <th class="col-actions">Danger Zone</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in allProfiles" :key="user.id">
                  <td>{{ user.staff_id || "—" }}</td>
                  <td>{{ user.display_name }}</td>
                  <td>{{ user.email }}</td>
                  <td class="col-width-100">
                    <span class="badge badge-role" :class="user.role === 'admin' ? 'badge-admin' : 'badge-staff'">
                      {{ user.role === 'admin' ? 'Admin' : 'Staff' }}
                    </span>
                  </td>
                  <td class="col-width-100">
                    <span class="badge" :class="user.is_disabled ? 'badge-is_disabled' : 'badge-is_enabled'">
                      {{ user.is_disabled ? 'Disabled' : 'Active' }}
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
                          title="Remove"
                          @click="removeMember(user.id, team.id)"
                        >×</button>
                      </span>
                    </span>
                    <span v-else class="text-muted">Unassigned</span>
                  </td>
                  <td>
                    <div class="assign-row">
                      <select class="form-select form-select-sm" v-model="assignTarget[user.id]">
                        <option value="">Select Team…</option>
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
                      >Join</button>
                    </div>
                  </td>
                  <td>
                    <button
                      v-if="user.id !== currentUser.id && !user.is_disabled"
                      class="btn btn-outline-danger btn-sm"
                      :disabled="togglingUserId === user.id"
                      @click="disableUser(user)"
                    >{{ togglingUserId === user.id ? "Processing..." : "Disable (Clear Data)" }}</button>
                    <button
                      v-else-if="user.id !== currentUser.id && user.is_disabled"
                      class="btn btn-outline-primary btn-sm"
                      :disabled="togglingUserId === user.id"
                      @click="enableUser(user)"
                    >{{ togglingUserId === user.id ? "Processing..." : "Enable" }}</button>
                    <span v-else class="text-muted" style="font-size:12px;">Current Account</span>
                  </td>
                </tr>
                <tr v-if="!allProfiles.length">
                  <td colspan="8" style="text-align:center;color:#94a3b8;padding:18px;">
                    No registered users
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
          <h2 class="section-title">Team Members Overview</h2>
          <div class="teams-overview">
            <div v-for="team in allTeams" :key="team.id" class="team-block">
              <div class="team-block-name">{{ team.name }}</div>
              <div v-if="getTeamMembers(team.id).length" class="team-block-members">
                <span v-for="m in getTeamMembers(team.id)" :key="m.user_id" class="tag">
                  {{ getProfile(m.user_id)?.display_name || m.user_id }}
                </span>
              </div>
              <div v-else class="text-muted" style="font-size:13px;">No members</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Teams 管理 -->
      <section class="card" style="margin-bottom:16px;">
        <div class="card-body">
          <div class="section-header-row">
            <div>
              <h2 class="section-title">Teams</h2>
              <p class="section-hint">Create, rename, or delete teams. A team must have no members before it can be deleted.</p>
            </div>
            <div class="header-inline-form">
              <input
                class="form-control form-control-sm"
                placeholder="New team name"
                v-model="newTeamName"
                :disabled="creatingTeam"
                @keyup.enter="createTeam"
              />
              <button class="btn btn-primary btn-sm" :disabled="creatingTeam || !newTeamName.trim()" @click="createTeam">
                {{ creatingTeam ? "Creating..." : "+ Add Team" }}
              </button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Members</th>
                  <th>Created</th>
                  <th class="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="team in allTeams" :key="team.id">
                  <td>
                    <input
                      v-if="editingTeamId === team.id"
                      class="form-control form-control-sm"
                      v-model="editingTeamName"
                      :disabled="savingTeamId === team.id"
                      @keyup.enter="saveTeamName(team)"
                      @keyup.esc="cancelEditTeam"
                    />
                    <span v-else>{{ team.name }}</span>
                  </td>
                  <td>{{ getTeamMembers(team.id).length }}</td>
                  <td>{{ (team.created_at || "").slice(0, 10) }}</td>
                  <td class="action-btnlist">
                    <template v-if="editingTeamId === team.id">
                      <button class="btn btn-primary btn-sm" :disabled="savingTeamId === team.id" @click="saveTeamName(team)">
                        {{ savingTeamId === team.id ? "Saving..." : "Save" }}
                      </button>
                      <button class="btn btn-light btn-sm" :disabled="savingTeamId === team.id" @click="cancelEditTeam">Cancel</button>
                    </template>
                    <template v-else>
                      <button class="btn btn-light btn-sm" @click="startEditTeam(team)">Rename</button>
                      <button
                        class="btn btn-outline-danger btn-sm"
                        :disabled="deletingTeamId === team.id"
                        @click="deleteTeam(team)"
                      >{{ deletingTeamId === team.id ? "Deleting..." : "Delete" }}</button>
                    </template>
                  </td>
                </tr>
                <tr v-if="!allTeams.length">
                  <td colspan="4" style="text-align:center;color:#94a3b8;padding:18px;">No teams yet</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>

      <!-- Project / Priority / 工时选项：统一用 list_options 表 -->
      <div class="list-options-grid">
        <ListOptionsManager
          list-type="project"
          title="Projects"
          hint="Options shown in the Work Item editor's Project dropdown."
          placeholder="New project name"
          usage-column="project_name"
        />
        <ListOptionsManager
          list-type="priority"
          title="Priority"
          hint="Options shown in the Work Item editor's Priority dropdown."
          placeholder="New priority name"
          usage-column="priority"
        />
        <ListOptionsManager
          list-type="hour"
          title="Hour Options"
          hint="Options shown in each day's hour dropdown (Mon–Fri) in the Work Item editor."
          placeholder="e.g. 0.5"
          input-type="number"
        />
      </div>

    </template>

    <!-- Toast -->
    <ToastMessage :message="toastMsg" :type="toastType" :visible="toastVisible" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../composables/useAuth.js";
import ToastMessage from "../components/ToastMessage.vue";
import ListOptionsManager from "../components/ListOptionsManager.vue";

const { currentUser } = useAuth();

const loading      = ref(true);
const allProfiles  = ref([]);   // public.profiles 全部
const allTeams     = ref([]);   // public.teams 全部
const teamUsers    = ref([]);   // public.team_users 全部 { team_id, user_id }

const togglingUserId = ref("");
// 每个用户待分配的 team 选择（user_id -> team_id）
const assignTarget = reactive({});

// Team 增删改
const newTeamName    = ref("");
const creatingTeam   = ref(false);
const editingTeamId  = ref("");
const editingTeamName = ref("");
const savingTeamId   = ref("");
const deletingTeamId = ref("");

const toastMsg     = ref("");
const toastType    = ref("info"); // success | error | info
const toastVisible = ref(false);
let toastTimer     = null;

function showToast(msg, type = "info") {
  toastMsg.value     = msg;
  toastType.value    = type;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible.value = false; }, type === "error" ? 3200 : 1800);
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
  if (error) { showToast("Operation failed:" + error.message, "error"); return; }
  assignTarget[userId] = "";
  await loadAll();
  showToast("Joined Team", "success");
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
  if (error) { showToast("Operation failed:" + error.message, "error"); return; }
  await loadAll();
  showToast("Removed!", "success");
}

// ── 新增 Team ─────────────────────────────────────────
async function createTeam() {
  const name = newTeamName.value.trim();
  if (!name) return;
  if (allTeams.value.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    showToast("A team with this name already exists", "info");
    return;
  }

  creatingTeam.value = true;
  try {
    const { error } = await supabase.from("teams").insert({ name });
    if (error) throw error;
    newTeamName.value = "";
    await loadAll();
    showToast("Team created", "success");
  } catch (err) {
    showToast("Create failed: " + (err.message || String(err)), "error");
  } finally {
    creatingTeam.value = false;
  }
}

// ── 改名 Team ─────────────────────────────────────────
function startEditTeam(team) {
  editingTeamId.value   = team.id;
  editingTeamName.value = team.name;
}

function cancelEditTeam() {
  editingTeamId.value   = "";
  editingTeamName.value = "";
}

async function saveTeamName(team) {
  const name = editingTeamName.value.trim();
  if (!name) { showToast("Team name can't be empty", "info"); return; }
  if (name === team.name) { cancelEditTeam(); return; }
  if (allTeams.value.some(t => t.id !== team.id && t.name.toLowerCase() === name.toLowerCase())) {
    showToast("A team with this name already exists", "info");
    return;
  }

  savingTeamId.value = team.id;
  try {
    const { error } = await supabase.from("teams").update({ name }).eq("id", team.id);
    if (error) throw error;
    cancelEditTeam();
    await loadAll();
    showToast("Team renamed", "success");
  } catch (err) {
    showToast("Rename failed: " + (err.message || String(err)), "error");
  } finally {
    savingTeamId.value = "";
  }
}

// ── 删除 Team ─────────────────────────────────────────
// 前端先挡住"还有成员"的 team；再查一下这个 team 名下有没有历史 work_items，
// 有的话强提示一次，避免管理员在不知情的情况下删掉一整批工作记录。
async function deleteTeam(team) {
  if (getTeamMembers(team.id).length > 0) {
    showToast("This team still has members. Remove them all before deleting the team.", "info");
    return;
  }

  const { count, error: countErr } = await supabase
    .from("work_items")
    .select("id", { count: "exact", head: true })
    .eq("team_id", team.id);
  if (countErr) { showToast("Failed to check team data: " + countErr.message, "error"); return; }

  const confirmText = count
    ? `Team "${team.name}" still has ${count} historical Work Item(s). Deleting the team may also delete this data (depending on database constraints). Continue?`
    : `Delete team "${team.name}"? This cannot be undone.`;
  if (!confirm(confirmText)) return;

  deletingTeamId.value = team.id;
  try {
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) throw error;
    await loadAll();
    showToast("Team deleted", "success");
  } catch (err) {
    const isFkViolation = /foreign key|violates/i.test(err.message || "");
    showToast(
      isFkViolation
        ? "This team still has related data (e.g. work items) preventing deletion."
        : "Delete failed: " + (err.message || String(err)), "error"
    );
  } finally {
    deletingTeamId.value = "";
  }
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

    const { data: updated, error: profErr } = await supabase
      .from("profiles")
      .update({ is_disabled: true })
      .eq("id", user.id)
      .select();
    if (profErr) throw profErr;
    // RLS 拦截时不会报错，只是没改到任何行，这里手动兜底识别出来
    if (!updated || updated.length === 0) {
      throw new Error("更新失败：没有权限修改该用户资料，请检查 profiles 表的 RLS UPDATE 策略");
    }

    await loadAll();
    showToast("账号已禁用", "success");
  } catch (err) {
    alert("Operation failed:" + (err.message || String(err)));
  } finally {
    togglingUserId.value = "";
  }
}

// ── 重新启用账号（只恢复登录权限，不恢复已清空的数据）───────
async function enableUser(user) {
  togglingUserId.value = user.id;
  try {
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({ is_disabled: false })
      .eq("id", user.id)
      .select();
    if (error) throw error;
    if (!updated || updated.length === 0) {
      throw new Error("更新失败：没有权限修改该用户资料，请检查 profiles 表的 RLS UPDATE 策略");
    }
    await loadAll();
    showToast("账号已启用", "success");
  } catch (err) {
    alert("Operation failed:" + (err.message || String(err)));
  } finally {
    togglingUserId.value = "";
  }
}

onMounted(loadAll);
</script>
<style scoped>
.admin-table .col-actions {
  width: 160px;
  text-align: center;
}
.admin-table .col-width-100 {
  width: 100px;
  text-align: center;
}
</style>