<script setup>
defineProps({ recurso: { type: Object, required: true } })
</script>
<template>
  <article class="resource-card"><span class="pill">{{ recurso.categoria }}</span><h3>{{ recurso.titulo }}</h3><p>{{ recurso.descricao }}</p><RouterLink :to="{ path: '/plano', query: { recurso: recurso.id } }" class="text-link">Criar plano com este tema ↗</RouterLink></article>
</template>
