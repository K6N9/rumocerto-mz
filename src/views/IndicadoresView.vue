<script setup>
import { indicadores } from '../data/indicadores.js'
import CartaoIndicador from '../components/CartaoIndicador.vue'
</script>
<template>
  <div class="container inner-page"><div class="page-heading"><span class="eyebrow section-kicker">DADOS REAIS · MOÇAMBIQUE</span><h1>Indicadores de emprego juvenil</h1><p>Explora como tem evoluído o desemprego entre jovens de 15 a 24 anos, segundo as estimativas modeladas da OIT disponibilizadas pelo Banco Mundial.</p></div>
    <div class="card-grid"><CartaoIndicador v-for="i in indicadores" :key="i.codigo" :indicador="i" /></div>
    <div class="explainer-grid"><div class="explainer-card"><h2>O que mede a taxa de desemprego?</h2><p>É a percentagem de pessoas sem emprego, disponíveis para trabalhar e à procura de trabalho, <strong>dentro da força de trabalho</strong> de uma faixa etária. Não mede todos os jovens que não têm emprego.</p></div><div class="explainer-card"><h2>Por que os números não contam tudo?</h2><p>Trabalho informal, subemprego, diferenças locais e jovens fora da força de trabalho exigem outros indicadores e investigação. As estimativas devem ser interpretadas com cautela.</p></div></div>
  </div>
</template>
