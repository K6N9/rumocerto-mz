<script setup>
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'

function saltar() {
  const conteudo = document.getElementById('conteudo')
  conteudo?.focus()
  conteudo?.scrollIntoView()
}
</script>

<template>
  <a class="skip-link" href="#conteudo" @click.prevent="saltar">Saltar para o conteúdo</a>
  <AppHeader />
  <main id="conteudo" class="main-content" tabindex="-1"><RouterView /></main>
  <AppFooter />
</template>
