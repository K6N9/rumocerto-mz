<script setup>
import { prazoLegivel } from '../../shared/oportunidades.js'
defineProps({ oportunidade: { type: Object, required: true } })
</script>

<template>
  <article class="surface rc-card">
    <p class="rc-tag">{{ oportunidade.tipo }}</p>
    <h2><RouterLink :to="{ name: 'oportunidade', params: { id: oportunidade.id } }">{{ oportunidade.titulo }}</RouterLink></h2>
    <p>{{ oportunidade.entidade }}</p>
    <dl class="rc-meta">
      <div><dt>Localização</dt><dd>{{ [oportunidade.localidade, oportunidade.provincia].filter(Boolean).join(', ') || 'Por indicar' }}</dd></div>
      <div><dt>Prazo</dt><dd>{{ prazoLegivel(oportunidade) }}</dd></div>
    </dl>
    <slot />
  </article>
</template>
