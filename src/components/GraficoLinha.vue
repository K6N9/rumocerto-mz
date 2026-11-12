<script setup>
import { computed } from 'vue'
import { formatarPercentagem } from '../utils/formatacao.js'
const props = defineProps({ serie: { type: Array, required: true }, cor: { type: String, default: '#2b8c85' } })
const dados = computed(() => props.serie.slice(-12))
const minimo = computed(() => Math.max(0, Math.min(...dados.value.map(d => d.valor)) - 2))
const maximo = computed(() => Math.max(...dados.value.map(d => d.valor), minimo.value + 2) + 2)
const pontos = computed(() => dados.value.map((d, i) => ({
  x: dados.value.length < 2 ? 50 : 40 + i * 640 / (dados.value.length - 1),
  y: 185 - 150 * (d.valor - minimo.value) / (maximo.value - minimo.value),
  ano: d.ano,
  valor: d.valor,
})))
const linha = computed(() => pontos.value.map(p => `${p.x},${p.y}`).join(' '))
</script>
<template>
  <div class="chart-wrap" v-if="dados.length">
    <svg class="chart" viewBox="0 0 740 250" role="img" :aria-label="`Gráfico com ${dados.length} observações anuais, de ${dados[0].ano} a ${dados[dados.length-1].ano}`">
      <line x1="40" y1="35" x2="680" y2="35" class="chart-grid" />
      <line x1="40" y1="110" x2="680" y2="110" class="chart-grid" />
      <line x1="40" y1="185" x2="680" y2="185" class="chart-grid" />
      <text x="6" y="39" class="chart-axis">{{ maximo.toFixed(0) }}%</text>
      <text x="6" y="189" class="chart-axis">{{ minimo.toFixed(0) }}%</text>
      <polyline :points="linha" fill="none" :stroke="cor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <circle v-for="p in pontos" :key="p.ano" :cx="p.x" :cy="p.y" r="5" :fill="cor"><title>{{ p.ano }}: {{ formatarPercentagem(p.valor) }}</title></circle>
      <text v-for="p in pontos.filter((_,i)=> i === 0 || i === pontos.length-1 || (i % 3 === 0))" :key="p.ano" :x="p.x" y="220" text-anchor="middle" class="chart-axis">{{ p.ano }}</text>
    </svg>
    <details class="chart-data"><summary>Ver valores numa tabela acessível</summary><table class="data-table"><thead><tr><th>Ano</th><th>Valor</th></tr></thead><tbody><tr v-for="p in dados" :key="p.ano"><td>{{ p.ano }}</td><td>{{ formatarPercentagem(p.valor) }}</td></tr></tbody></table></details>
  </div>
</template>
