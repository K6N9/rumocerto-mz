<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import CampoTexto from '../components/CampoTexto.vue'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { consultar, consultarOportunidade, rpc } from '../services/dados.js'
import { conta } from '../services/supabase.js'
import { dataLegivel, dataMaputo, ESTADOS_CANDIDATURA } from '../../shared/oportunidades.js'

const rota = useRoute()
const estados = Object.entries(ESTADOS_CANDIDATURA)
const externas = new Set(['enviada','em_analise','entrevista','seleccionado','nao_seleccionado'])
const registos = ref([])
const totais = ref({})
const estadoFiltro = ref('')
const listaOportunidades = ref([])
const inicial = () => ({ id: '', titulo: '', entidade: '', oportunidade_id: '', estado: 'guardada', data_evento: dataMaputo(), notas: '' })
const form = reactive(inicial())
const confirmado = ref(false)
const original = ref('guardada')
const precisaConfirmar = computed(() => externas.has(form.estado) && (!form.id || form.estado !== original.value))
const historicos = reactive({})
const erroHistorico = reactive({})
const emEdicao = ref(false)
const { carregando, erro, mensagem, executar } = useRecurso()
const pagina = ref(0)
const haMais = ref(false)
const limite = 20

function carregar(indice = pagina.value) {
  const id = conta.utilizador.id
  const oportunidade = rota.query.oportunidade
  const filtro = estadoFiltro.value
  executar(async () => {
    const consulta = db => {
      let pedido = db.from('candidaturas').select('*').eq('utilizador', id).order('actualizado_em', { ascending: false }).order('id')
      if (filtro) pedido = pedido.eq('estado', filtro)
      return pedido.range(indice * limite, (indice + 1) * limite - 1)
    }
    const [linhas, contagem, anuncio, favoritos] = await Promise.all([
      consultar(consulta), rpc('resumo_candidaturas'), oportunidade ? consultarOportunidade(oportunidade) : null,
      consultar(db => db.from('favoritos').select('oportunidade_id').eq('utilizador', id).order('criado_em', { ascending: false }).limit(50))
    ])
    const ids = favoritos.map(f => f.oportunidade_id)
    const guardadas = ids.length ? await consultar(db => db.from('catalogo_oportunidades').select('id,titulo,entidade').in('id', ids)) : []
    return { linhas, contagem, anuncio, guardadas }
  }, ({ linhas, contagem, anuncio, guardadas }) => {
    registos.value = linhas
    totais.value = contagem
    pagina.value = indice
    haMais.value = linhas.length === limite
    listaOportunidades.value = anuncio && !guardadas.some(i => i.id === anuncio.id) ? [anuncio, ...guardadas] : guardadas
    if (anuncio && !emEdicao.value) editar({ ...inicial(), oportunidade_id: anuncio.id, titulo: anuncio.titulo, entidade: anuncio.entidade })
  })
}
function editar(registo = inicial()) {
  Object.assign(form, inicial(), Object.fromEntries(Object.keys(inicial()).map(chave => [chave, registo[chave] ?? ''])))
  original.value = registo.estado || 'guardada'
  confirmado.value = false
  emEdicao.value = true
}
function associar() {
  const anuncio = listaOportunidades.value.find(o => o.id === form.oportunidade_id)
  if (anuncio) { form.titulo = anuncio.titulo; form.entidade = anuncio.entidade }
}
async function guardar() {
  if (form.titulo.trim().length < 3 || (precisaConfirmar.value && !confirmado.value)) {
    erro.value = 'Indique um título válido e confirme a informação sobre o estado.'
    return
  }
  const { id, ...campos } = form
  const dados = { ...campos, titulo: campos.titulo.trim(), oportunidade_id: campos.oportunidade_id || null, utilizador: conta.utilizador.id }
  const ok = await executar(() => consultar(db => id
    ? db.from('candidaturas').update(dados).eq('id', id).eq('utilizador', dados.utilizador).select('id').single()
    : db.from('candidaturas').insert(dados).select('id').single()), null, 'Não foi possível guardar a candidatura.')
  if (ok) {
    if (id) delete historicos[id]
    emEdicao.value = false
    mensagem.value = 'Candidatura registada.'
    const [linhas, contagem] = await Promise.allSettled([
      consultar(db => {
        let consulta = db.from('candidaturas').select('*').eq('utilizador', dados.utilizador).order('actualizado_em', { ascending: false }).order('id')
        if (estadoFiltro.value) consulta = consulta.eq('estado', estadoFiltro.value)
        return consulta.limit(limite)
      }), rpc('resumo_candidaturas')
    ])
    if (linhas.status === 'fulfilled') { registos.value = linhas.value; pagina.value = 0; haMais.value = linhas.value.length === limite }
    else erro.value = 'A candidatura foi guardada. Actualize a lista para ver o resultado.'
    if (contagem.status === 'fulfilled') totais.value = contagem.value
  }
}
async function verHistorico(id, evento) {
  if (!evento.target.open || historicos[id]) return
  erroHistorico[id] = false
  try {
    historicos[id] = await consultar(db => db.from('historico_candidaturas').select('id,estado,data_evento').eq('candidatura_id', id).order('id', { ascending: false }))
  } catch { erroHistorico[id] = true }
}
watch(() => [estadoFiltro.value, rota.query.oportunidade], () => carregar(0), { immediate: true })
</script>

<template>
  <section class="container inner-page rc-page">
    <RouterLink to="/conta" class="back-link">Voltar à área pessoal</RouterLink>
    <header class="page-heading"><h1>Candidaturas</h1><p>Registe o seu percurso e consulte o histórico de estados.</p></header>
    <EstadoRecurso :carregando="carregando" :erro="erro" :mensagem="mensagem" repetir @repetir="carregar()" />
    <div class="rc-actions">
      <button v-if="!emEdicao" class="btn btn-primary" @click="editar()">Nova candidatura</button>
      <RouterLink to="/preparacao" class="btn btn-outline">Preparar candidatura ou entrevista</RouterLink>
    </div>
    <form v-if="emEdicao" class="surface rc-panel rc-form" @submit.prevent="guardar">
      <h2>{{ form.id ? 'Editar candidatura' : 'Nova candidatura' }}</h2>
      <div class="rc-form-grid">
        <CampoTexto v-model="form.titulo" titulo="Título" :minimo="3" :maximo="160" obrigatorio />
        <CampoTexto v-model="form.entidade" titulo="Entidade" :maximo="150" />
        <label>Oportunidade
          <select v-model="form.oportunidade_id" @change="associar">
            <option value="">Sem associação</option>
            <option v-if="form.oportunidade_id && !listaOportunidades.some(i => i.id === form.oportunidade_id)" :value="form.oportunidade_id">Anúncio associado</option>
            <option v-for="item in listaOportunidades" :key="item.id" :value="item.id">{{ item.titulo }}</option>
          </select>
        </label>
        <CampoTexto v-model="form.estado" titulo="Estado" :opcoes="estados" obrigatorio />
        <CampoTexto v-model="form.data_evento" tipo="date" titulo="Data do estado" obrigatorio />
      </div>
      <CampoTexto v-model="form.notas" titulo="Notas privadas" tipo="textarea" :maximo="4000" />
      <label v-if="precisaConfirmar" class="rc-check"><input v-model="confirmado" type="checkbox" required /> Confirmo que este estado corresponde ao que aconteceu.</label>
      <div class="rc-actions"><button class="btn btn-primary" :disabled="carregando">Guardar candidatura</button><button type="button" class="btn btn-outline" @click="emEdicao = false">Cancelar</button></div>
    </form>
    <div class="surface rc-panel rc-form">
      <CampoTexto v-model="estadoFiltro" titulo="Filtrar por estado" :opcoes="estados" />
      <dl v-if="Object.keys(totais).length" class="rc-meta rc-meta-wide"><div v-for="[chave, total] in Object.entries(totais)" :key="chave"><dt>{{ ESTADOS_CANDIDATURA[chave] }}</dt><dd>{{ total }}</dd></div></dl>
    </div>
    <p v-if="!registos.length && !carregando && !erro" class="rc-status" role="status">Nenhuma candidatura nesta página.</p>
    <div class="rc-card-grid">
      <article v-for="registo in registos" :key="registo.id" class="surface rc-card">
        <p class="rc-tag">{{ ESTADOS_CANDIDATURA[registo.estado] }}</p>
        <h2>{{ registo.titulo }}</h2><p>{{ registo.entidade }} · {{ dataLegivel(registo.data_evento) }}</p>
        <p v-if="registo.notas" class="rc-texto">{{ registo.notas }}</p>
        <button class="text-button" @click="editar(registo)">Editar candidatura</button>
        <details @toggle="verHistorico(registo.id, $event)">
          <summary>Histórico</summary>
          <p v-if="erroHistorico[registo.id]" role="alert">Feche e volte a abrir para consultar o histórico.</p>
          <ol v-else-if="historicos[registo.id]"><li v-for="evento in historicos[registo.id]" :key="evento.id">{{ dataLegivel(evento.data_evento) }} · {{ ESTADOS_CANDIDATURA[evento.estado] }}</li></ol>
          <p v-else role="status">A carregar…</p>
        </details>
      </article>
    </div>
    <nav v-if="pagina || haMais" class="rc-actions" aria-label="Páginas de candidaturas">
      <button class="btn btn-outline" :disabled="!pagina || carregando" @click="carregar(pagina - 1)">Anterior</button><span>Página {{ pagina + 1 }}</span>
      <button class="btn btn-outline" :disabled="!haMais || carregando" @click="carregar(pagina + 1)">Seguinte</button>
    </nav>
  </section>
</template>
