<script setup>
import { useId } from 'vue'

defineProps({
  titulo: { type: String, required: true },
  tipo: { type: String, default: 'text' },
  opcoes: Array,
  maximo: Number,
  minimo: Number,
  obrigatorio: Boolean,
  descricao: String,
  autocomplete: String
})
const valor = defineModel()
const id = useId()
</script>

<template>
  <div class="rc-campo">
    <label :for="id">{{ titulo }}</label>
    <select v-if="opcoes" :id="id" v-model="valor" :required="obrigatorio" :aria-describedby="descricao ? id + '-dica' : undefined">
      <option value="">Seleccione</option>
      <option v-for="opcao in opcoes" :key="opcao[0]" :value="opcao[0]">{{ opcao[1] }}</option>
    </select>
    <textarea v-else-if="tipo === 'textarea'" :id="id" v-model="valor" :maxlength="maximo" :required="obrigatorio" :aria-describedby="descricao ? id + '-dica' : undefined" rows="4"></textarea>
    <input v-else-if="tipo === 'number'" :id="id" v-model.number="valor" type="number" :min="minimo" :max="maximo" :required="obrigatorio" :aria-describedby="descricao ? id + '-dica' : undefined" />
    <input v-else :id="id" v-model="valor" :type="tipo" :maxlength="maximo" :minlength="minimo" :autocomplete="autocomplete" :required="obrigatorio" :aria-describedby="descricao ? id + '-dica' : undefined" />
    <small v-if="descricao" :id="id + '-dica'">{{ descricao }}</small>
  </div>
</template>
