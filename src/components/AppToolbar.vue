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
          <select
            id="weekSelect"
            class="form-select"
            :value="state.weekKey"
            @change="$emit('week-change', $event.target.value)"
          >
            <option v-for="week in weekOptions" :key="week.key" :value="week.key">{{ week.label }}</option>
          </select>
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
            <button class="btn btn-outline-primary" type="button" @click="$emit('export')">导出 JSON</button>
            <button
              v-if="isAdmin"
              class="btn btn-outline-danger"
              type="button"
              @click="$emit('clear-week')"
            >清空当前周</button>
            <span class="save-status">{{ saveStatusText }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  teams:            { type: Array,   required: true },
  state:            { type: Object,  required: true },
  weekOptions:      { type: Array,   required: true },
  startDateDisplay: { type: String,  default: "" },
  endDateDisplay:   { type: String,  default: "" },
  saveStatusText:   { type: String,  default: "" },
  isAdmin:          { type: Boolean, default: false }
});
defineEmits(["team-change", "year-change", "week-change", "export", "clear-week"]);
</script>
