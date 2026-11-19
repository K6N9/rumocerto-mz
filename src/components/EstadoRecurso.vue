<script setup>
defineProps({ carregando: Boolean, erro: String, mensagem: String, vazio: String, repetir: Boolean })
defineEmits(['repetir'])
</script>

<template>
  <p v-if="carregando" class="rc-status" role="status">A carregar…</p>
  <div v-else-if="erro" class="rc-error" role="alert">
    <p>{{ erro }}</p>
    <button v-if="repetir" type="button" class="text-button" @click="$emit('repetir')">Tentar novamente</button>
  </div>
  <p v-else-if="vazio" class="rc-status" role="status">{{ vazio }}</p>
  <p v-if="mensagem" class="rc-success" role="status">{{ mensagem }}</p>
</template>
