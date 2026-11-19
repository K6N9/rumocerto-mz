<script setup>
import { onMounted, reactive, ref } from 'vue'
import CampoTexto from '../components/CampoTexto.vue'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { descarregarFicheiro, guardarPessoal, lerPessoal } from '../services/dados.js'
import { CONTACTOS_CV, CONTEUDO_CV, normalizarCurriculo, validarCurriculo } from '../../shared/curriculo.js'

const form = reactive(normalizarCurriculo())
const { carregando, erro, mensagem, executar } = useRecurso()
const exportando = ref(false)

function carregar() {
  executar(() => lerPessoal('curriculos'), registo => Object.assign(form, normalizarCurriculo(registo?.dados)))
}
function validar() {
  const dados = normalizarCurriculo(form)
  erro.value = validarCurriculo(dados)
  return erro.value ? null : dados
}
async function guardar() {
  const dados = validar()
  if (dados && await executar(() => guardarPessoal('curriculos', { dados }), null, 'Não foi possível guardar o currículo.')) mensagem.value = 'Currículo guardado.'
}
async function exportar() {
  const dados = validar()
  if (!dados) return
  exportando.value = true
  try {
    const { gerarPdfCurriculo } = await import('../../shared/pdf.js')
    descarregarFicheiro(gerarPdfCurriculo(dados), 'application/pdf', 'RumoCerto_MZ_Curriculo.pdf')
    mensagem.value = 'Currículo descarregado.'
  } catch { erro.value = 'Não foi possível gerar o PDF.' }
  finally { exportando.value = false }
}
onMounted(carregar)
</script>

<template>
  <section class="container inner-page rc-page">
    <RouterLink to="/conta" class="back-link">Voltar à área pessoal</RouterLink>
    <header class="page-heading"><h1>Criador de CV</h1><p>Inclua os dados que pretende partilhar com as entidades a que se candidata.</p></header>
    <EstadoRecurso :carregando="carregando" :erro="erro" :mensagem="mensagem" />
    <div class="rc-editor">
      <form class="surface rc-panel rc-form" @submit.prevent="guardar">
        <h2>Dados e contactos profissionais</h2>
        <div class="rc-form-grid">
          <CampoTexto v-for="[chave, titulo, tipo, maximo] in CONTACTOS_CV" :key="chave" v-model="form[chave]" :titulo="titulo" :tipo="tipo" :maximo="maximo" :obrigatorio="chave === 'nome'" />
        </div>
        <h2>Percurso profissional</h2>
        <CampoTexto v-for="[chave, titulo, tipo, maximo] in CONTEUDO_CV" :key="chave" v-model="form[chave]" :titulo="titulo" :tipo="tipo" :maximo="maximo" descricao="Use uma linha por elemento quando listar actividades." />
        <div class="rc-actions">
          <button class="btn btn-primary" :disabled="carregando">Guardar na conta</button>
          <button type="button" class="btn btn-outline" :disabled="exportando" @click="exportar">{{ exportando ? 'A gerar PDF…' : 'Descarregar PDF' }}</button>
        </div>
      </form>
      <article class="surface rc-panel rc-preview" aria-label="Pré-visualização do currículo">
        <h2>Pré-visualização</h2>
        <p v-if="!form.nome">O seu currículo aparece aqui à medida que preenche os campos.</p>
        <template v-else>
          <h3>{{ form.nome }}</h3><p v-if="form.cargo">{{ form.cargo }}</p>
          <p class="rc-texto">{{ CONTACTOS_CV.slice(2).map(([chave]) => form[chave]).filter(Boolean).join(' · ') }}</p>
          <template v-for="[chave, titulo] in CONTEUDO_CV" :key="chave">
            <section v-if="form[chave]"><h4>{{ titulo }}</h4><p class="rc-texto">{{ form[chave] }}</p></section>
          </template>
        </template>
      </article>
    </div>
  </section>
</template>
