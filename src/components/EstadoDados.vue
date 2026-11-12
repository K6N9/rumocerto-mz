<script setup>
defineProps({ carregando: Boolean, erro: { type: String, default: '' }, vazio: Boolean })
defineEmits(['repetir'])
</script>
<template>
  <div v-if="carregando" class="state-panel" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><span>A consultar dados reais de Moçambique…</span></div>
  <div v-else-if="erro" class="state-panel state-error" role="alert"><span>Não foi possível carregar os dados.</span><p>{{ erro }}</p><button class="btn btn-small btn-outline" type="button" @click="$emit('repetir')">Tentar novamente</button></div>
  <div v-else-if="vazio" class="state-panel" role="status">Não existem valores disponíveis para este indicador.</div>
</template>
