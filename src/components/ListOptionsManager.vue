<template>
  <section class="card" style="margin-bottom:16px;">
    <div class="card-body">
      <div class="section-header-row">
        <div>
          <h2 class="section-title">{{ title }}</h2>
          <p v-if="hint" class="section-hint">{{ hint }}</p>
        </div>
        <div class="header-inline-form">
          <input
            class="form-control form-control-sm"
            :type="inputType"
            :step="inputType === 'number' ? 0.5 : null"
            :placeholder="placeholder"
            v-model="newName"
            @keyup.enter="create"
          />
          <button class="btn btn-primary btn-sm" :disabled="creating || !String(newName).trim()" @click="create">
            {{ creating ? "Adding..." : "+ Add" }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-muted" style="padding:8px 0;">Loading...</div>

      <table v-else class="admin-table">
        <thead><tr><th>Value</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="option in items" :key="option.id">
            <td>
              <input
                v-if="editingId === option.id"
                class="form-control form-control-sm"
                :type="inputType"
                :step="inputType === 'number' ? 0.5 : null"
                v-model="editingName"
                @keyup.enter="saveRename(option)"
                @keyup.esc="cancelEdit"
              />
              <span v-else>{{ option.name }}</span>
            </td>
            <td class="action-btnlist">
              <template v-if="editingId === option.id">
                <button class="btn btn-primary btn-sm" :disabled="savingId === option.id" @click="saveRename(option)">
                  {{ savingId === option.id ? "Saving..." : "Save" }}
                </button>
                <button class="btn btn-light btn-sm" :disabled="savingId === option.id" @click="cancelEdit">Cancel</button>
              </template>
              <template v-else>
                <button class="btn btn-light btn-sm" @click="startEdit(option)">Rename</button>
                <button
                  class="btn btn-outline-danger btn-sm"
                  :disabled="deletingId === option.id"
                  @click="remove(option)"
                >{{ deletingId === option.id ? "Deleting..." : "Delete" }}</button>
              </template>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="2" style="text-align:center;color:#94a3b8;padding:14px;">No options yet</td>
          </tr>
        </tbody>
      </table>

    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { supabase } from "../lib/supabase.js";

const props = defineProps({
  listType:    { type: String, required: true },  // "project" | "priority" | "hour"
  title:       { type: String, required: true },
  hint:        { type: String, default: "" },
  placeholder: { type: String, default: "New value" },
  inputType:   { type: String, default: "text" },  // hour 用 "number"
  usageColumn: { type: String, default: "" }        // 删除前检查 work_items 这个字段有没有还在用这个值；不传就跳过检查
});

const items    = ref([]);
const loading  = ref(true);

const newName    = ref("");
const creating   = ref(false);
const editingId  = ref("");
const editingName = ref("");
const savingId   = ref("");
const deletingId = ref("");

async function load() {
  loading.value = true;
  const { data, error } = await supabase
    .from("list_options")
    .select("*")
    .eq("list_type", props.listType)
    .order("sort_order")
    .order("name");
  if (!error) items.value = data || [];
  loading.value = false;
}

function normalize(raw) {
  // hour 类型存文本，但语义是数字，统一trim一下，数字类型顺手格式化，避免 "1.50" 这种奇怪写法
  const text = String(raw ?? "").trim();
  if (props.inputType !== "number") return text;
  const num = Number(text);
  return Number.isNaN(num) ? "" : String(Math.round(num * 100) / 100);
}

async function create() {
  const name = normalize(newName.value);
  if (!name) return;
  if (items.value.some(o => o.name.toLowerCase() === name.toLowerCase())) {
    alert("This value already exists"); return;
  }
  creating.value = true;
  try {
    const sortOrder = items.value.length
      ? Math.max(...items.value.map(o => o.sort_order)) + 1
      : 0;
    const { error } = await supabase
      .from("list_options")
      .insert({ list_type: props.listType, name, sort_order: sortOrder });
    if (error) throw error;
    newName.value = "";
    await load();
  } catch (err) {
    alert("Create failed: " + (err.message || String(err)));
  } finally {
    creating.value = false;
  }
}

function startEdit(option) {
  editingId.value   = option.id;
  editingName.value = option.name;
}
function cancelEdit() {
  editingId.value = "";
  editingName.value = "";
}

async function saveRename(option) {
  const name = normalize(editingName.value);
  if (!name) { alert("Value can't be empty"); return; }
  if (name === option.name) { cancelEdit(); return; }
  if (items.value.some(o => o.id !== option.id && o.name.toLowerCase() === name.toLowerCase())) {
    alert("This value already exists"); return;
  }
  savingId.value = option.id;
  try {
    const { error } = await supabase.from("list_options").update({ name }).eq("id", option.id);
    if (error) throw error;
    cancelEdit();
    await load();
  } catch (err) {
    alert("Rename failed: " + (err.message || String(err)));
  } finally {
    savingId.value = "";
  }
}

async function remove(option) {
  let confirmText = `Delete "${option.name}"?`;

  if (props.usageColumn) {
    const { count, error: countErr } = await supabase
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .eq(props.usageColumn, option.name);
    if (countErr) { alert("Failed to check usage: " + countErr.message); return; }
    if (count) {
      confirmText = `${count} Work Item(s) currently use "${option.name}". They will keep the stored value but it will no longer appear in the dropdown. Continue?`;
    }
  }
  if (!confirm(confirmText)) return;

  deletingId.value = option.id;
  try {
    const { error } = await supabase.from("list_options").delete().eq("id", option.id);
    if (error) throw error;
    await load();
  } catch (err) {
    alert("Delete failed: " + (err.message || String(err)));
  } finally {
    deletingId.value = "";
  }
}

onMounted(load);
</script>