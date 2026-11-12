<script setup>
import { computed } from 'vue'
import { useIndicador } from '../composables/useIndicador.js'
import { formatarPercentagem } from '../utils/formatacao.js'
const props = defineProps({ indicador: { type: Object, required: true } })
const { serie, carregando, erro, carregar } = useIndicador(() => props.indicador.codigo)
const recente = computed(() => serie.value.at(-1) || null)
</script>
<template>
  <article class="indicator-card">
    <div class="card-top"><span class="indicator-icon" :style="{ color: indicador.cor, backgroundColor: indicador.cor + '14' }">{{ indicador.icone }}</span><span class="eyebrow">MOÇAMBIQUE · OIT / BM</span></div>
    <h3>{{ indicador.titulo }}</h3>
    <p class="card-subtitle">{{ indicador.subtitulo }}</p>
    <div v-if="carregando" class="metric skeleton">A carregar…</div>
    <div v-else-if="erro" class="metric-error"><span>Dados indisponíveis</span><button type="button" class="link-button" @click="carregar(true)">Repetir consulta</button></div>
    <div v-else-if="recente" class="metric">{{ formatarPercentagem(recente.valor) }}<small>{{ recente.ano }} · último ano com dados</small></div>
    <div v-else class="metric-error">Sem observações disponíveis</div>
    <RouterLink class="text-link" :to="`/indicadores/${indicador.codigo}`">Ver evolução e detalhes <span aria-hidden="true">↗</span></RouterLink>
  </article>
</template>
