<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { conta } from '../services/supabase.js'

const rota = useRoute()
const aberto = ref(false)
const menu = ref(null)
const logo = `${import.meta.env.BASE_URL}branding/simbolo.webp`
const base = [
  { to: '/', label: 'Início' },
  { to: '/indicadores', label: 'Indicadores' },
  { to: '/oportunidades', label: 'Oportunidades' },
  { to: '/preparacao', label: 'Preparação' },
  { to: '/progresso', label: 'Progresso' }
]
const links = computed(() => [...base, conta.utilizador ? { to: '/conta', label: 'Área pessoal' } : { to: '/entrar', label: 'Entrar' }])
watch(() => rota.path, () => { aberto.value = false })
function fechar(evento) {
  if (!aberto.value) return
  evento?.stopPropagation()
  aberto.value = false
  nextTick(() => menu.value?.focus())
}
</script>

<template>
  <header class="site-header" @keydown.esc="fechar">
    <div class="container navbar">
      <RouterLink to="/" class="brand" aria-label="RumoCerto MZ, página inicial" @click="aberto = false">
        <span class="brand-mark" aria-hidden="true"><img :src="logo" alt="" width="43" height="43" /></span>
        <span>Rumo<span class="brand-accent">Certo</span><small>MZ</small></span>
      </RouterLink>
      <button ref="menu" type="button" class="menu-button" :aria-expanded="aberto" aria-controls="site-links" @click="aberto = !aberto">{{ aberto ? 'Fechar ×' : 'Menu ☰' }}</button>
      <nav id="site-links" class="nav-links" :class="{ 'nav-open': aberto }" aria-label="Navegação principal">
        <RouterLink v-for="item in links" :key="item.to" :to="item.to" @click="aberto = false">{{ item.label }}</RouterLink>
        <RouterLink class="nav-primary" to="/plano" @click="aberto = false">Criar plano</RouterLink>
      </nav>
    </div>
  </header>
</template>
