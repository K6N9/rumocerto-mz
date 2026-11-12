<script setup>
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
</script>
<template>
  <a class="skip-link" href="#conteudo">Saltar para o conteúdo</a>
  <div class="app-shell">
    <AppHeader />
    <main id="conteudo" class="main-content"><RouterView /></main>
    <AppFooter />
  </div>
</template>
