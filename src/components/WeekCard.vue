<script setup>
import { computed } from 'vue'
import { diaDaTarefa } from '../../shared/planner.js'
const props = defineProps({
  semana: { type: Object, required: true },
  concluidas: { type: Array, default: () => [] },
  interactivo: Boolean,
  inicialmenteAberta: Boolean
})
defineEmits(['alternar'])
const feitas = computed(() => props.semana.tarefas.filter((_, i) => props.concluidas.includes(`${props.semana.numero - 1}-${i}`)).length)
const percentagem = computed(() => Math.round(100 * feitas.value / Math.max(1, props.semana.tarefas.length)))
</script>

<template>
  <details class="week-card" :open="inicialmenteAberta">
    <summary class="week-summary">
      <span class="week-index">{{ String(semana.numero).padStart(2, '0') }}</span>
      <span class="week-heading"><strong>{{ semana.titulo }}</strong><small>{{ semana.foco }}</small></span>
      <span v-if="interactivo" class="week-count" :class="{ 'week-done': percentagem === 100 }">{{ percentagem === 100 ? 'Concluída' : `${feitas}/${semana.tarefas.length}` }}</span>
      <span v-else class="week-count">{{ semana.minutosSugeridos }} min</span>
      <span class="week-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div class="week-content">
      <div v-if="interactivo" class="week-progress-track" role="progressbar" :aria-label="`Progresso da semana ${semana.numero}`" :aria-valuenow="percentagem" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: percentagem + '%' }"></span></div><p class="week-instruction">{{ interactivo ? 'Assinale cada tarefa quando a concluir.' : 'Tarefas sugeridas para esta semana.' }}</p>
      <ul class="task-list">
        <li v-for="(t, i) in semana.tarefas" :key="i">
          <label v-if="interactivo" class="task-check">
            <input type="checkbox" :checked="concluidas.includes(`${semana.numero - 1}-${i}`)" @change="$emit('alternar', `${semana.numero - 1}-${i}`)" />
            <span :class="{ 'is-done': concluidas.includes(`${semana.numero - 1}-${i}`) }">{{ t }}<small>Dia {{ diaDaTarefa(semana, i) }}<template v-if="semana.minutosPorTarefa?.[i]"> · {{ semana.minutosPorTarefa[i] }} min</template></small></span>
          </label>
          <span v-else class="task-static"><span class="task-dot" aria-hidden="true"></span>{{ t }}</span>
        </li>
      </ul>
      <div class="week-deliverable"><strong>Resultado esperado</strong><span>{{ semana.entregavel }}</span></div>
    </div>
  </details>
</template>
