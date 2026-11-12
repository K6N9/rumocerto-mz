<script setup>
import { ref } from 'vue'
const menuAberto = ref(false)
const links = [{ to: '/', nome: 'Início' }, { to: '/indicadores', nome: 'Indicadores' }, { to: '/plano', nome: 'O meu plano' }, { to: '/sobre', nome: 'Sobre' }]
const simbolo = `${import.meta.env.BASE_URL}branding/simbolo.png`
</script>
<template>
  <header class="site-header">
    <div class="container nav-wrap">
      <RouterLink to="/" class="brand" @click="menuAberto = false" aria-label="RumoCerto MZ, ir ao início">
        <img class="brand-icon" :src="simbolo" alt="" width="48" height="48" />
        <span class="brand-name">Rumo<span class="brand-accent">Certo</span><small>MZ</small></span>
      </RouterLink>
      <button class="menu-toggle" type="button" :aria-expanded="menuAberto" aria-controls="navegacao" @click="menuAberto = !menuAberto">{{ menuAberto ? 'Fechar ×' : 'Menu ☰' }}</button>
      <nav id="navegacao" class="navigation" :class="{ 'is-open': menuAberto }" aria-label="Navegação principal">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" @click="menuAberto = false">{{ link.nome }}</RouterLink>
      </nav>
    </div>
  </header>
</template>
