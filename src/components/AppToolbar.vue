<template>
  <section class="card">
    <div class="card-body">
      <div class="toolbar">
        <div class="form-group team-group">
          <label for="teamSelect">Team</label>
          <select
            id="teamSelect"
            class="form-select"
            :value="state.teamId"
            @change="$emit('team-change', $event.target.value)"
          >
            <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
          </select>
        </div>
        <div class="form-group year-group">
          <label for="yearInput">Year</label>
          <input
            id="yearInput"
            class="form-control"
            type="number" min="2000" max="2100" step="1"
            :value="state.year"
            @change="$emit('year-change', $event.target.value)"
          />
        </div>
        <div class="form-group week-group">
          <label for="weekSelect">Week</label>
          <div class="week-switcher">
            <button
              class="week-nav-btn"
              type="button"
              title="Previous Week"
              aria-label="Switch to previous week"
              :disabled="!canGoPreviousWeek"
              @click="switchWeek(-1)">‹</button>
            <select
              id="weekSelect"
              class="form-select"
              :value="state.weekKey"
              @change="$emit('week-change', $event.target.value)"
            >
              <option v-for="week in weekOptions" :key="week.key" :value="week.key">{{ week.label }}</option>
            </select>
            <button
              class="week-nav-btn"
              type="button"
              title="Next Week"
              aria-label="Switch to next week"
              :disabled="!canGoNextWeek"
              @click="switchWeek(1)">›</button>
          </div>
        </div>
        <div class="form-group date-group">
          <label>StartDate</label>
          <input class="form-control readonly-input" type="text" readonly :value="startDateDisplay" />
        </div>
        <div class="form-group date-group">
          <label>EndDate</label>
          <input class="form-control readonly-input" type="text" readonly :value="endDateDisplay" />
        </div>
        <div class="form-group actions-group">
          <label>&nbsp;</label>
          <div class="actions">
            <button class="btn btn-outline-primary" type="button" @click="$emit('export')">Export JSON</button>
            <button
              v-if="isAdmin"
              class="btn btn-outline-danger"
              type="button"
              @click="$emit('clear-week')"
            >Clear Current Week</button>
          </div>
        </div>

        <div v-if="isAdmin" class="import-panel">
          
          <div class="import-controls">
            <div class="import-panel-heading">
              <strong>One-click Import (by Member)</strong>
            </div>
            <div class="form-group import-member-group">
              <label for="importMemberSelect">Member</label>
              <select
                id="importMemberSelect"
                class="form-select"
                :value="importState.ownerId"
                @change="$emit('import-owner-change', $event.target.value)"
              >
                <option
                  v-for="member in members"
                  :key="member.userId"
                  :value="member.userId"
                >
                  {{ member.displayName }}
                </option>
              </select>
            </div>

            <div class="form-group import-year-group">
              <label for="importSourceYear">Source Year</label>
              <input
                id="importSourceYear"
                class="form-control"
                type="number"
                min="2000"
                max="2100"
                step="1"
                :value="importState.sourceYear"
                @change="$emit('import-source-year-change', $event.target.value)"
              />
            </div>

            <div class="form-group import-week-group">
              <label for="importSourceWeek">Source Week</label>
              <select
                id="importSourceWeek"
                class="form-select"
                :value="importState.sourceWeekKey"
                @change="$emit('import-source-week-change', $event.target.value)"
              >
                <option
                  v-for="week in importWeekOptions"
                  :key="week.key"
                  :value="week.key"
                >
                  {{ week.label }}
                </option>
              </select>
            </div>

            <div class="form-group import-action-group">
              <label>&nbsp;</label>
              <button
                class="btn btn-outline-primary"
                type="button"
                :disabled="
                  importSaving ||
                  !importState.ownerId ||
                  !importState.sourceWeekKey ||
                  (
                    Number(importState.sourceYear) === Number(state.year) &&
                    importState.sourceWeekKey === state.weekKey
                  )
                "
                @click="$emit('copy-member-week')"
              >
                {{ importSaving ? "Importing..." : "Import This Member" }}
              </button>
            </div>
        </div>
      </div>

      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps({
  teams:            { type: Array,   required: true },
  state:            { type: Object,  required: true },
  weekOptions:      { type: Array,   required: true },
  members:          { type: Array,   default: () => [] },
  importState:      { type: Object,  required: true },
  importWeekOptions:{ type: Array,   default: () => [] },
  importSaving:     { type: Boolean, default: false },
  startDateDisplay: { type: String,  default: "" },
  endDateDisplay:   { type: String,  default: "" },
  isAdmin:          { type: Boolean, default: false }
});

const emit = defineEmits(["team-change", "year-change", "week-change", "export", "clear-week", "import-owner-change","import-source-year-change","import-source-week-change","copy-member-week"]);

const selectedWeekIndex = computed(() =>
  props.weekOptions.findIndex(week => week.key === props.state.weekKey)
);

const canGoPreviousWeek = computed(() =>
  selectedWeekIndex.value > 0
);

const canGoNextWeek = computed(() =>
  selectedWeekIndex.value >= 0 &&
  selectedWeekIndex.value < props.weekOptions.length - 1
);

function switchWeek(offset) {
  const targetIndex = selectedWeekIndex.value + offset;
  const targetWeek = props.weekOptions[targetIndex];

  if (targetWeek) {
    emit("week-change", targetWeek.key);
  }
}
</script>
