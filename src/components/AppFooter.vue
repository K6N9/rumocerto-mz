<script setup>
const simbolo = `${import.meta.env.BASE_URL}branding/simbolo.png`
</script>
<template>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <div class="footer-identity"><img :src="simbolo" alt="" class="footer-icon" width="45" height="45"/><p class="footer-brand">Rumo<span>Certo</span> MZ</p></div>
        <p>Um projecto académico sobre a transição dos jovens para o mundo profissional.</p>
      </div>
      <div><strong>Dados e transparência</strong><p>Indicadores nacionais de Moçambique, estimativas modeladas da OIT via Banco Mundial. Não divulgamos vagas de emprego.</p><a href="https://data.worldbank.org/indicator/SL.UEM.1524.ZS?locations=MZ" target="_blank" rel="noopener noreferrer">Ver fonte dos indicadores ↗</a></div>
      <div><strong>Projecto académico</strong><p>Grupo 8 · Programação Web II · ISUTC · 2026</p><RouterLink to="/sobre">Metodologia e privacidade</RouterLink></div>
    </div>
  </footer>
</template>
