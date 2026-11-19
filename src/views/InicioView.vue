<script setup>
import { indicadores } from '../../shared/indicadores.js'
import IndicadorCard from '../components/IndicadorCard.vue'
import { computed } from 'vue'
import { usePlano } from '../composables/usePlano.js'
const { plano, progresso, concluidas } = usePlano()
const proximaTarefa = computed(() => {
  if (!plano.value) return ''
  for (const semana of plano.value.semanas) for (const [i,tarefa] of semana.tarefas.entries()) {
    if (!concluidas.value.includes(`${semana.numero-1}-${i}`)) return tarefa
  }
  return 'Todas as actividades do plano foram concluídas.'
})
</script>

<template>
  <section class="hero">
    <div class="container hero-layout">
      <div class="hero-content">
        <span class="eyebrow hero-eyebrow"><span class="status-dot"></span> ORIENTAÇÃO PROFISSIONAL</span>
        <h1>Organize o seu <span>futuro profissional.</span></h1>
        <p>Defina objectivos profissionais e acompanhe um plano de desenvolvimento de 30 dias, adaptado à sua disponibilidade.</p>
        <div class="hero-buttons">
          <RouterLink class="btn btn-primary" :to="plano ? '/progresso' : '/plano'">{{ plano ? 'Acompanhar plano' : 'Criar plano' }} <span aria-hidden="true">↗</span></RouterLink>
          <RouterLink class="btn btn-on-dark" to="/oportunidades">Explorar oportunidades</RouterLink>
        </div>
        <p class="hero-assurance">Acesso livre · Sem registo obrigatório</p><div v-if="plano" class="hero-resume" role="status"><span class="resume-dot"></span> Progresso: <strong>{{ progresso.feitas }} de {{ progresso.total }}</strong> actividades concluídas.</div>
      </div>
      <div class="hero-visual" aria-label="Exemplo de um plano de quatro semanas">
        <div class="preview-card" :class="{ 'preview-personal': plano }">
          <div class="preview-top"><span>{{ plano ? 'PLANO EM CURSO' : 'PLANO DE CARREIRA' }}</span><span class="preview-badge">30 dias</span></div>
          <template v-if="plano">
            <h2>{{ plano.titulo }}</h2>
            <p class="preview-context">Acompanhe a evolução das suas actividades.</p>
            <div class="preview-progress-head"><strong>{{ progresso.percentagem }}%</strong><span>{{ progresso.feitas }} de {{ progresso.total }} tarefas</span></div>
            <div class="preview-progress-track"><span :style="{ width: progresso.percentagem + '%' }"></span></div>
            <div class="preview-next"><span>PRÓXIMA ACTIVIDADE</span><p>{{ proximaTarefa }}</p></div>
            <RouterLink class="preview-link" to="/progresso">Consultar progresso <span aria-hidden="true">↗</span></RouterLink>
          </template>
          <template v-else>
            <h2>Do objectivo <em>à realização.</em></h2>
            <div class="preview-list">
              <div><span class="preview-number">01</span><span><strong>Descobrir</strong><small>Identificar as prioridades</small></span><span class="preview-check">✓</span></div>
              <div><span class="preview-number">02</span><span><strong>Aprender</strong><small>Desenvolver competências</small></span></div>
              <div><span class="preview-number">03</span><span><strong>Construir</strong><small>Criar algo demonstrável</small></span></div>
              <div><span class="preview-number">04</span><span><strong>Avançar</strong><small>Rever os resultados</small></span></div>
            </div>
            <div class="preview-footer"><span>Actividades distribuídas por etapas</span><span>4 semanas</span></div>
          </template>
        </div>
      </div>
    </div>
  </section>

  <section class="section container context-section" aria-labelledby="contexto-titulo">
    <div class="context-copy">
      <span class="eyebrow">CONTEXTO ESTATÍSTICO</span>
      <h2 id="contexto-titulo">Informação para <em>decisões fundamentadas.</em></h2>
      <p>Consulte a evolução dos indicadores nacionais de desemprego juvenil. Estes valores contextualizam o mercado de trabalho, mas não representam previsões individuais.</p>
      <RouterLink class="text-link" to="/indicadores">Consultar indicadores <span aria-hidden="true">↗</span></RouterLink>
    </div>
    <IndicadorCard :indicador="indicadores[0]" />
  </section>

  <section class="section steps-section" aria-labelledby="passos-titulo">
    <div class="container">
      <div class="section-heading compact-heading">
        <div><span class="eyebrow">COMO FUNCIONA</span><h2 id="passos-titulo">Do objectivo <em>ao acompanhamento.</em></h2></div>
      </div>
      <div class="journey-grid">
        <article><span>01</span><h3>Definir objectivos</h3><p>Indique a área profissional, o objectivo e a disponibilidade semanal.</p></article>
        <article><span>02</span><h3>Gerar plano</h3><p>Consulte quatro semanas de actividades e descarregue o plano em PDF.</p></article>
        <article><span>03</span><h3>Acompanhar actividades</h3><p>Registe as tarefas concluídas e acompanhe a evolução do plano.</p></article>
      </div>
    </div>
  </section>
</template>
