<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { accaoAuth, conta } from '../services/supabase.js'
import { descarregarFicheiro, exportarConta, guardarPessoal, lerPessoal, rpc } from '../services/dados.js'
import { dataLegivel } from '../../shared/oportunidades.js'

const router = useRouter()
const rota = useRoute()
const prefs = reactive({ novas: true, prazos: true, tarefas: true, resumo_email: false })
const pedido = ref(null)
const consentimentoEm = ref('')
const confirmar = ref(false)
const { carregando, erro, mensagem, executar } = useRecurso()
const opcoes = { novas: 'Novas correspondências RumoMatch', prazos: 'Prazos de candidatura', tarefas: 'Lembretes de tarefas',
  resumo_email: 'Aceito receber o resumo semanal por e-mail' }

function carregar() {
  executar(() => Promise.all([lerPessoal('preferencias_comunicacao'), lerPessoal('pedidos_eliminacao')]), ([dados, eliminacao]) => {
    if (dados) for (const chave of Object.keys(prefs)) prefs[chave] = dados[chave]
    consentimentoEm.value = dados?.consentimento_em || ''
    pedido.value = eliminacao
    if (rota.query.actualizada === 'sim') mensagem.value = 'Palavra-passe actualizada.'
  })
}
async function guardar() {
  const dados = { ...prefs, resumo_email: !pedido.value && prefs.resumo_email }
  if (await executar(() => guardarPessoal('preferencias_comunicacao', dados), registo => { consentimentoEm.value = registo.consentimento_em || '' },
    'Não foi possível guardar as preferências.')) mensagem.value = 'Preferências guardadas.'
}
function exportar() {
  const id = conta.utilizador.id
  executar(exportarConta, dados => {
    if (id !== conta.utilizador?.id) return
    descarregarFicheiro(JSON.stringify(dados, null, 2), 'application/json', 'RumoCerto_MZ_Dados_Pessoais.json')
    mensagem.value = 'Dados exportados. Guarde o ficheiro num local privado.'
  }, 'Não foi possível exportar os dados.')
}
async function eliminar() {
  if (!confirmar.value) return
  const registado = await executar(async () => {
    await rpc('pedir_eliminacao')
    return lerPessoal('pedidos_eliminacao')
  }, dados => { pedido.value = dados; prefs.resumo_email = false; consentimentoEm.value = '' },
  'Não foi possível confirmar o pedido de eliminação. Pode tentar novamente.')
  if (registado) mensagem.value = 'Pedido registado para tratamento pela equipa.'
}
async function sair() {
  if (await executar(() => accaoAuth('signOut', { scope: 'local' }), null, 'Não foi possível terminar a sessão.')) await router.replace({ name: 'inicio' })
}
onMounted(carregar)
</script>

<template>
  <section class="container inner-page rc-page">
    <RouterLink to="/conta" class="back-link">Voltar à área pessoal</RouterLink>
    <header class="page-heading"><h1>Definições de conta</h1><p>{{ conta.utilizador?.email }}</p></header>
    <EstadoRecurso :carregando="carregando" :erro="erro" :mensagem="mensagem" />
    <form class="surface rc-panel rc-form" @submit.prevent="guardar">
      <h2>Preferências de comunicação</h2>
      <label v-for="[chave, titulo] in Object.entries(opcoes)" :key="chave" class="rc-check">
        <input v-model="prefs[chave]" type="checkbox" :disabled="chave === 'resumo_email' && !!pedido" /> {{ titulo }}
      </label>
      <p v-if="consentimentoEm">Consentimento registado em {{ dataLegivel(consentimentoEm) }}.</p>
      <p>Para cancelar o resumo, retire a selecção da opção de e-mail e guarde.</p>
      <button class="btn btn-primary" :disabled="carregando">Guardar preferências</button>
    </form>
    <section class="surface rc-panel">
      <h2>Conta e dados pessoais</h2>
      <div class="rc-actions">
        <RouterLink to="/redefinir-palavra-passe" class="btn btn-outline">Alterar palavra-passe</RouterLink>
        <button type="button" class="btn btn-outline" :disabled="carregando" @click="exportar">Exportar dados pessoais</button>
        <button type="button" class="btn btn-outline" :disabled="carregando" @click="sair">Terminar sessão</button>
      </div>
    </section>
    <section class="surface rc-panel">
      <h2>Eliminação da conta</h2>
      <p v-if="pedido" role="status">Pedido apresentado em {{ dataLegivel(pedido.criado_em) }}. A equipa fará o tratamento.</p>
      <form v-else class="rc-form" @submit.prevent="eliminar">
        <p>Pode exportar os dados antes de pedir a sua eliminação.</p>
        <label class="rc-check"><input v-model="confirmar" type="checkbox" required /> Quero pedir a eliminação da minha conta e dos seus dados.</label>
        <button class="btn btn-outline" :disabled="carregando || !confirmar">Pedir eliminação</button>
      </form>
    </section>
  </section>
</template>
