<script setup>
import { computed } from 'vue'
import { obterIndicador } from '../data/indicadores.js'
import { useIndicador } from '../composables/useIndicador.js'
import { formatarPercentagem, criarCsvSerie } from '../utils/formatacao.js'
import EstadoDados from '../components/EstadoDados.vue'
import GraficoLinha from '../components/GraficoLinha.vue'
const props = defineProps({ codigo: String })
const indicador = computed(() => obterIndicador(props.codigo))
const { serie, carregando, erro, ultimaConsulta, carregar } = useIndicador(() => indicador.value?.codigo)
const recente = computed(() => serie.value.at(-1))
const anterior = computed(() => serie.value.at(-2))
const diferenca = computed(() => recente.value && anterior.value ? recente.value.valor - anterior.value.valor : null)
function exportarCSV() {
  if (!serie.value.length || !indicador.value) return
  const conteudo = criarCsvSerie(serie.value)
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `rumocerto-moz-${indicador.value.codigo}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
</script>
<template>
  <div class="container inner-page" v-if="indicador">
    <RouterLink to="/indicadores" class="back-link">← Voltar aos indicadores</RouterLink>
    <div class="page-heading"><span class="eyebrow section-kicker">BANCO MUNDIAL · OIT</span><h1>{{ indicador.titulo }}</h1><p>{{ indicador.resumo }}</p></div>
    <EstadoDados :carregando="carregando" :erro="erro" :vazio="!serie.length" @repetir="carregar(true)" />
    <template v-if="!carregando && !erro && serie.length">
      <div class="detail-metrics"><article><span>Último valor publicado</span><strong>{{ formatarPercentagem(recente?.valor) }}</strong><small>Ano de referência: {{ recente?.ano }}</small></article><article><span>Variação face ao ano anterior disponível</span><strong>{{ diferenca === null ? '—' : `${diferenca > 0 ? '+' : ''}${diferenca.toFixed(1)} pp` }}</strong><small>pontos percentuais, {{ anterior?.ano }}–{{ recente?.ano }}</small></article><article><span>Anos com dados</span><strong>{{ serie.length }}</strong><small>{{ serie[0]?.ano }} a {{ recente?.ano }}</small></article></div>
      <section class="surface-chart"><div class="chart-heading"><div><h2>Evolução do indicador</h2><p>Últimas 12 observações anuais disponíveis</p></div><div class="chart-actions"><button class="link-button" type="button" @click="carregar(true)">Actualizar ↻</button><button class="link-button" type="button" @click="exportarCSV">Descarregar CSV ↓</button></div></div><GraficoLinha :serie="serie" :cor="indicador.cor" /><p v-if="ultimaConsulta" class="data-note">Última consulta nesta sessão: {{ new Date(ultimaConsulta).toLocaleString('pt-MZ') }}</p></section>
    </template>
    <section class="explainer-card data-source-box"><h2>Fonte e interpretação</h2><p>Banco Mundial, API de Indicadores, país MOZ, série <code>{{ indicador.codigo }}</code>. Fonte primária: Organização Internacional do Trabalho, estimativas modeladas. A população representada são jovens de 15 a 24 anos na força de trabalho. O dado não permite deduzir automaticamente a situação individual de um estudante.</p><a :href="`https://data.worldbank.org/indicator/${indicador.codigo}?locations=MZ`" target="_blank" rel="noopener noreferrer" class="text-link">Consultar a fonte original ↗</a></section>
  </div>
  <div v-else class="container inner-page"><div class="page-heading"><h1>Indicador desconhecido</h1><p>Não temos informação sobre o indicador solicitado.</p><RouterLink to="/indicadores" class="btn btn-primary">Ver os indicadores</RouterLink></div></div>
</template>
