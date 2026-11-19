<script setup>
const logo = `${import.meta.env.BASE_URL}branding/simbolo.webp`
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-layout">
      <div><div class="footer-brandline"><img :src="logo" alt="" width="41" height="41" /><strong>RumoCerto <span>MZ</span></strong></div><p>Plataforma de orientação e desenvolvimento profissional. Projecto académico do Grupo 8.</p></div>
      <nav aria-label="Ligações do rodapé">
        <RouterLink to="/sobre">Sobre e privacidade</RouterLink>
        <RouterLink to="/indicadores">Indicadores</RouterLink>
        <RouterLink to="/preparacao">Preparação profissional</RouterLink>
        <a href="https://data.worldbank.org/indicator/SL.UEM.1524.ZS?locations=MZ" target="_blank" rel="noopener noreferrer">Fonte dos dados</a>
      </nav>
    </div>
    <div class="container footer-bottom"><span>Grupo 8 · LECC31 · ISUTC · 2026</span><span>O plano é educativo e não garante emprego.</span></div>
  </footer>
</template>
