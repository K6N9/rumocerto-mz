<script setup>
import { onMounted, reactive } from 'vue'
import CampoTexto from '../components/CampoTexto.vue'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { lerPessoal, rpc } from '../services/dados.js'
import { AREAS, DISPONIBILIDADES } from '../../shared/planner.js'
import { dividirLista, ESCOLARIDADES, MODALIDADES, PROVINCIAS, TIPOS } from '../../shared/oportunidades.js'

const perfil = reactive({ nome: '', provincia: '', localidade: '', escolaridade: '', area: '',
  competencias: '', comportamentais: '', experiencia_meses: '', experiencia: '', interesses: '', objectivos: '' })
const preferencias = reactive({ disponibilidade: '', modalidades: [], tipos: [], provincias: [] })
const { carregando, erro, mensagem, executar } = useRecurso()
const opcoes = lista => lista.map(valor => [valor, valor])
const campos = [
  { chave: 'nome', titulo: 'Nome', minimo: 2, maximo: 90, obrigatorio: true, autocomplete: 'name' },
  { chave: 'provincia', titulo: 'Província', opcoes: opcoes(PROVINCIAS), obrigatorio: true },
  { chave: 'localidade', titulo: 'Localidade', maximo: 120, autocomplete: 'address-level2' },
  { chave: 'escolaridade', titulo: 'Escolaridade', opcoes: ESCOLARIDADES.map((valor, i) => [i + 1, valor]) },
  { chave: 'area', titulo: 'Área profissional', opcoes: opcoes(AREAS) },
  { chave: 'experiencia_meses', titulo: 'Meses de experiência', tipo: 'number', minimo: 0, maximo: 720 },
  { chave: 'competencias', titulo: 'Competências técnicas', maximo: 2025, descricao: 'Separe por vírgula. Até 25 competências de 80 caracteres.' },
  { chave: 'comportamentais', titulo: 'Competências comportamentais', maximo: 2025, descricao: 'Separe por vírgula.' },
  { chave: 'experiencia', titulo: 'Experiência profissional', tipo: 'textarea', maximo: 1200 },
  { chave: 'interesses', titulo: 'Interesses', tipo: 'textarea', maximo: 600 },
  { chave: 'objectivos', titulo: 'Objectivos', tipo: 'textarea', maximo: 600 }
]
const grupos = { modalidades: ['Modalidades preferidas', MODALIDADES], tipos: ['Tipos de oportunidade', TIPOS], provincias: ['Províncias preferidas', PROVINCIAS] }

function carregar() {
  executar(() => Promise.all([lerPessoal('perfis'), lerPessoal('preferencias')]), ([dados, gostos]) => {
    if (dados) for (const chave of Object.keys(perfil)) {
      const valor = dados[chave]
      perfil[chave] = Array.isArray(valor) ? valor.join(', ') : (valor ?? '')
    }
    if (gostos) for (const chave of Object.keys(preferencias)) preferencias[chave] = gostos[chave]
  })
}

async function guardar() {
  const competencias = dividirLista(perfil.competencias, 26)
  const comportamentais = dividirLista(perfil.comportamentais, 26)
  if (perfil.nome.trim().length < 2 || [competencias, comportamentais].some(lista => lista.length > 25 || lista.some(v => v.length > 80))) {
    erro.value = 'Indique um nome válido e reveja a quantidade e o tamanho das competências.'
    return
  }
  const p = { ...perfil, nome: perfil.nome.trim(), competencias, comportamentais,
    escolaridade: perfil.escolaridade || null, experiencia_meses: perfil.experiencia_meses === '' ? null : perfil.experiencia_meses }
  if (await executar(() => rpc('guardar_perfil', { p_perfil: p, p_preferencias: { ...preferencias } }), null, 'Não foi possível guardar o perfil. Reveja os dados e tente novamente.')) {
    mensagem.value = 'Perfil e preferências guardados.'
  }
}
onMounted(carregar)
</script>

<template>
  <section class="container inner-page rc-page">
    <RouterLink to="/conta" class="back-link">Voltar à área pessoal</RouterLink>
    <header class="page-heading"><h1>Perfil profissional</h1><p>Indique o que sabe fazer e o que procura para receber correspondências relevantes.</p></header>
    <EstadoRecurso :carregando="carregando" :erro="erro" :mensagem="mensagem" repetir @repetir="carregar" />
    <form class="surface rc-panel rc-form" @submit.prevent="guardar">
      <div class="rc-form-grid"><CampoTexto v-for="campo in campos" :key="campo.chave" v-model="perfil[campo.chave]" v-bind="campo" /></div>
      <CampoTexto v-model="preferencias.disponibilidade" titulo="Disponibilidade" :opcoes="opcoes(DISPONIBILIDADES)" />
      <fieldset v-for="[chave, [titulo, lista]] in Object.entries(grupos)" :key="chave" class="rc-choices">
        <legend>{{ titulo }}</legend>
        <label v-for="opcao in lista" :key="opcao"><input v-model="preferencias[chave]" type="checkbox" :value="opcao" /> {{ opcao }}</label>
      </fieldset>
      <button class="btn btn-primary" :disabled="carregando">Guardar perfil</button>
    </form>
  </section>
</template>
