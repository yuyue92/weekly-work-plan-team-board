// composables/useWeeklySummary.js
import { reactive, ref, computed } from "vue";
import { supabase } from "../lib/supabase.js";
import { buildWorkWeeks, getDefaultWeekKey, normalizeYear } from "../utils/date.js";

const state = reactive({
  teamId: null, teamName: "",
  year: new Date().getFullYear(), weekKey: ""
});

const teamsData   = ref([]);
const weekOptions = ref([]);
const members     = ref([]);
const loading     = ref(false);
const summaryRecord = ref(null);
const summarySaving  = ref(false);

export function useWeeklySummary() {
  async function initTeams() {
    loading.value = true;
    try {
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
      if (error) throw error;
      teamsData.value = data || [];
      if (teamsData.value.length && !state.teamId) await onTeamChange(teamsData.value[0].id);
    } finally { loading.value = false; }
  }

  async function onTeamChange(teamId) {
    const team = teamsData.value.find(t => t.id === teamId);
    if (!team) return;
    state.teamId = team.id; state.teamName = team.name;
    const weeks = buildWorkWeeks(state.year);
    weekOptions.value = weeks;
    if (!weeks.some(w => w.key === state.weekKey)) state.weekKey = getDefaultWeekKey(state.year, weeks);
    await loadData();
  }

  function onYearChange(rawValue) {
    state.year = normalizeYear(rawValue);
    const weeks = buildWorkWeeks(state.year);
    weekOptions.value = weeks;
    state.weekKey = getDefaultWeekKey(state.year, weeks);
    loadData();
  }

  function onWeekChange(weekKey) { state.weekKey = weekKey; loadData(); }

  async function loadData() {
    if (!state.teamId || !state.weekKey) return;
    loading.value = true;
    try {
      const { data: teamUsers, error: tuErr } = await supabase
        .from("team_users")
        .select("user_id, sort_order, profiles(id, display_name)")
        .eq("team_id", state.teamId).order("sort_order");
      if (tuErr) throw tuErr;

      const { data: reports, error: repErr } = await supabase
        .from("weekly_reports")
        .select("owner_id, report_text")
        .eq("team_id", state.teamId).eq("year", state.year).eq("week_key", state.weekKey);
      if (repErr) throw repErr;

      const reportMap = Object.fromEntries((reports || []).map(r => [r.owner_id, r.report_text || ""]));
      members.value = (teamUsers || [])
        .filter(row => row.profiles)
        .map(row => ({
          userId: row.profiles.id,
          displayName: row.profiles.display_name,
          sortOrder: row.sort_order,
          reportText: reportMap[row.profiles.id] || ""
        }));

      const { data: summary, error: sumErr } = await supabase
        .from("weekly_summaries")
        .select("id, content_html, updated_by, updated_at")
        .eq("team_id", state.teamId).eq("year", state.year).eq("week_key", state.weekKey)
        .maybeSingle();
      if (sumErr) throw sumErr;
      summaryRecord.value = summary || null;
    } finally { loading.value = false; }
  }

  async function saveSummary(contentHtml, updatedByUserId) {
    if (!state.teamId || !state.weekKey) return { error: { message: "请先选择 Team 和 Week" } };
    summarySaving.value = true;
    try {
      const { data, error } = await supabase
        .from("weekly_summaries")
        .upsert(
          { team_id: state.teamId, year: Number(state.year), week_key: state.weekKey,
            content_html: contentHtml, updated_by: updatedByUserId },
          { onConflict: "team_id,year,week_key" }
        )
        .select("id, content_html, updated_by, updated_at").single();
      if (error) throw error;
      summaryRecord.value = data;
      return { data };
    } catch (error) { return { error }; }
    finally { summarySaving.value = false; }
  }

  const weekLabel = computed(() => weekOptions.value.find(w => w.key === state.weekKey)?.label || "");

  return {
    state, teamsData, weekOptions, members, loading,
    summaryRecord, summarySaving,
    initTeams, onTeamChange, onYearChange, onWeekChange,
    loadData, saveSummary, weekLabel
  };
}