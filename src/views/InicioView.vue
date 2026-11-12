<script setup>
import { indicadores } from '../data/indicadores.js'
import CartaoIndicador from '../components/CartaoIndicador.vue'
</script>
<template>
  <section class="hero" aria-labelledby="titulo-inicio">
    <div class="container hero-grid">
      <div class="hero-copy">
        <span class="hero-kicker"><span class="kicker-dot"></span> FEITO PARA JOVENS MOÇAMBICANOS</span>
        <h1 id="titulo-inicio">O teu futuro começa com um <em>próximo passo.</em></h1>
        <p>Indicadores reais de Moçambique e um plano de 30 dias criado para a tua situação, gratuito e disponível em PDF.</p>
        <div class="hero-actions"><RouterLink to="/plano" class="btn btn-primary">Criar o meu plano <span>↗</span></RouterLink><RouterLink to="/indicadores" class="btn btn-ghost">Explorar indicadores</RouterLink></div>
        <p class="hero-fine">Sem criar conta. Sem promessas de emprego. Com dados públicos e passos práticos.</p>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
        <div class="art-main"><span class="art-label">O CAMINHO É TEU</span><div class="art-arrow">↗</div><span class="art-caption">DESCOBRIR<br/>PREPARAR<br/>AVANÇAR</span></div>
        <div class="art-badge art-badge-top">01 / Conhecer</div><div class="art-badge art-badge-bottom">02 / Agir com propósito</div>
      </div>
    </div>
  </section>
  <section class="section container">
    <div class="section-head"><div><span class="eyebrow section-kicker">01 · COMPREENDER</span><h2>Conhece os números. <span class="muted-heading">Decide melhor.</span></h2><p>Indicadores publicados pelo Banco Mundial para Moçambique, actualizados através da API.</p></div><RouterLink to="/indicadores" class="text-link">Todos os indicadores ↗</RouterLink></div>
    <div class="card-grid"><CartaoIndicador v-for="indicador in indicadores" :key="indicador.codigo" :indicador="indicador" /></div>
    <p class="data-note">Nota: a taxa de desemprego juvenil refere-se à força de trabalho dos 15 aos 24 anos, não a todos os jovens. Os valores representam estimativas da OIT.</p>
  </section>
  <section class="section pathway-section"><div class="container"><div class="section-head"><div><span class="eyebrow section-kicker">02 · TOMAR ACÇÃO</span><h2>Um objectivo concreto. <span class="muted-heading">Quatro semanas.</span></h2></div></div><div class="steps-grid"><article><span class="step-number">01</span><h3>Explorar</h3><p>Consulta indicadores nacionais e compreende o contexto em que vais construir a tua carreira.</p></article><article><span class="step-number">02</span><h3>Preparar</h3><p>Indica as tuas dificuldades, disponibilidade e objectivos para receberes tarefas ajustadas à tua realidade.</p></article><article><span class="step-number">03</span><h3>Acompanhar</h3><p>Recebe uma confirmação imediata e, cerca de 5 minutos depois, um plano completo em PDF por e-mail.</p></article></div></div></section>
  <section class="section container"><div class="cta-panel"><div><span class="eyebrow">ESTÁ NA HORA</span><h2>O próximo passo não precisa de ser enorme.</h2><p>Cria o teu roteiro de 30 dias com orientações acessíveis e acompanhamento de cada semana.</p></div><RouterLink to="/plano" class="btn btn-primary">Construir o meu plano ↗</RouterLink></div></section>
</template>
