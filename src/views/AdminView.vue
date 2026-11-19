<script setup>
import { onMounted, reactive, ref } from 'vue'
import CampoTexto from '../components/CampoTexto.vue'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { consultar, descarregarFicheiro, rpc } from '../services/dados.js'
import { AREAS } from '../../shared/planner.js'
import { dataLegivel, dataMaputo, dividirLista, ESCOLARIDADES, ligacaoHttps, MODALIDADES, PROVINCIAS, TIPOS } from '../../shared/oportunidades.js'
import { ID_CONFIGURACAO_ALERTAS } from '../../shared/configuracao.js'
import { classificarSaudeWorker } from '../../shared/versao.js'

const estado = { rascunho: 'Rascunho', activa: 'Activa', arquivada: 'Arquivada' }
const relatorio = ref(null)
const auditoria = ref([])
const fontes = ref([])
const anuncios = ref([])
const alertas = ref(null)
const worker = ref('Por verificar')
const configuracao = reactive({ internos: true, resumos: false })
const tab = ref('oportunidades')
const estadoFiltro = ref('')
const pesquisa = ref('')
const pagina = ref(0)
const temMais = ref(false)
const tamanho = 20
const { carregando, erro, mensagem, executar } = useRecurso()
const lista = valores => valores.map(v => [v, v])

const novaFonte = () => ({ id: '', nome: '', url: '', activa: true, verificar: false })
const novoAnuncio = () => ({ id: '', titulo: '', entidade: '', descricao: '', fonte_id: '', tipo: '',
  area: '', provincia: '', localidade: '', modalidade: '', escolaridade: '', experiencia_meses: '',
  requisitos: '', competencias: '', competencias_obrigatorias: '', data_publicacao: '', prazo: '', prazo_hora: '',
  url_original: '', url_candidatura: '', estado: 'rascunho', verificar: false, verificada_em: null })
const fonte = reactive(novaFonte())
const anuncio = reactive(novoAnuncio())
const editarFonte = ref(false)
const editarAnuncio = ref(false)
const campos = [
  { chave: 'titulo', titulo: 'Título', minimo: 4, maximo: 160, obrigatorio: true },
  { chave: 'entidade', titulo: 'Entidade', minimo: 2, maximo: 150, obrigatorio: true },
  { chave: 'tipo', titulo: 'Tipo', opcoes: lista(TIPOS), obrigatorio: true },
  { chave: 'area', titulo: 'Área', opcoes: lista(AREAS) },
  { chave: 'provincia', titulo: 'Província', opcoes: lista(PROVINCIAS) },
  { chave: 'localidade', titulo: 'Localidade', maximo: 120 },
  { chave: 'modalidade', titulo: 'Modalidade', opcoes: lista(MODALIDADES) },
  { chave: 'escolaridade', titulo: 'Escolaridade mínima', opcoes: ESCOLARIDADES.map((v, i) => [i + 1, v]) },
  { chave: 'experiencia_meses', titulo: 'Experiência mínima (meses)', tipo: 'number', minimo: 0, maximo: 720 },
  { chave: 'data_publicacao', titulo: 'Data da publicação', tipo: 'date' },
  { chave: 'prazo', titulo: 'Prazo de candidatura', tipo: 'date' },
  { chave: 'prazo_hora', titulo: 'Hora do prazo (Maputo)', tipo: 'time' },
  { chave: 'url_original', titulo: 'URL do anúncio original', tipo: 'url', maximo: 2048, obrigatorio: true },
  { chave: 'url_candidatura', titulo: 'URL da candidatura', tipo: 'url', maximo: 2048, obrigatorio: true }
]
const listas = [
  ['requisitos', 'Requisitos', 20, 250],
  ['competencias', 'Competências', 25, 80],
  ['competencias_obrigatorias', 'Competências obrigatórias', 25, 80]
]

function carregar(indice = pagina.value, sucesso = '') {
  return executar(async () => {
    const procurar = db => {
      let query = db.from('oportunidades').select('id,titulo,entidade,estado,prazo,verificada_em')
        .order('verificada_em', { ascending: false, nullsFirst: false }).order('id')
      if (estadoFiltro.value) query = query.eq('estado', estadoFiltro.value)
      if (pesquisa.value.trim()) query = query.ilike('titulo', '%' + pesquisa.value.trim().replace(/[\\%_]/g, '\\$&') + '%')
      return query.range(indice * tamanho, (indice + 1) * tamanho - 1)
    }
    return Promise.all([rpc('relatorio_admin'), consultar(db => db.from('fontes').select('*').order('nome')),
      consultar(procurar), consultar(db => db.from('auditoria').select('*').order('id', { ascending: false }).limit(50)),
      rpc('estado_alertas'), consultar(db => db.from('configuracao_alertas').select('internos,resumos').eq('id', ID_CONFIGURACAO_ALERTAS).single())])
  }, ([resumo, fontesDb, oportunidadesDb, registos, estadoAlertas, config]) => {
    relatorio.value = resumo
    fontes.value = fontesDb
    anuncios.value = oportunidadesDb
    auditoria.value = registos
    alertas.value = estadoAlertas[0] || null
    Object.assign(configuracao, config)
    pagina.value = indice
    temMais.value = oportunidadesDb.length === tamanho
    mensagem.value = sucesso
  })
}

async function verificarWorker() {
  const base = String(import.meta.env.VITE_WORKER_URL ?? '').replace(/\/$/, '')
  worker.value = 'A verificar…'
  if (!base) { worker.value = 'URL por configurar'; return }
  try {
    const resposta = await fetch(base + '/api/saude', { signal: AbortSignal.timeout(8000) })
    const dados = await resposta.json()
    const estado = classificarSaudeWorker(resposta.ok, dados)
    worker.value = {
      disponivel: 'Protocolo compatível · envio anunciado',
      incompativel: 'Resposta de saúde com protocolo incompatível',
      indisponivel: 'Envio indisponível'
    }[estado]
  } catch { worker.value = 'Consulta indisponível' }
}

function abrirFonte(item = novaFonte()) {
  Object.assign(fonte, { id: item.id, nome: item.nome, url: item.url, activa: item.activa, verificar: false })
  editarFonte.value = true
}
async function abrirAnuncio(item) {
  if (!item) { Object.assign(anuncio, novoAnuncio()); editarAnuncio.value = true; return }
  await executar(() => consultar(db => db.from('oportunidades').select('*').eq('id', item.id).single()), dados => {
    Object.assign(anuncio, novoAnuncio(), Object.fromEntries(Object.keys(novoAnuncio()).filter(c => c !== 'verificar').map(chave => {
      const valor = dados[chave]
      return [chave, Array.isArray(valor) ? valor.join('\n') : (valor ?? '')]
    })))
    editarAnuncio.value = true
  })
}

async function guardarFonte() {
  const url = ligacaoHttps(fonte.url)
  if (!url || fonte.nome.trim().length < 2) { erro.value = 'Indique o nome e uma ligação HTTPS válida.'; return }
  const anterior = fontes.value.find(f => f.id === fonte.id)
  const verificada_em = fonte.verificar ? new Date().toISOString() : (anterior?.url === url ? anterior.verificada_em : null)
  const dados = { nome: fonte.nome.trim(), url, activa: fonte.activa, verificada_em }
  const guardar = db => fonte.id ? db.from('fontes').update(dados).eq('id', fonte.id).select('id').single() :
    db.from('fontes').insert(dados).select('id').single()
  if (await executar(() => consultar(guardar), null, 'Não foi possível guardar a fonte. Reveja a ligação e tente novamente.')) {
    editarFonte.value = false
    carregar(pagina.value, 'Fonte guardada.')
  }
}

async function guardarAnuncio() {
  const { id, verificar, ...dados } = anuncio
  dados.url_original = ligacaoHttps(dados.url_original)
  dados.url_candidatura = ligacaoHttps(dados.url_candidatura)
  dados.titulo = dados.titulo.trim()
  dados.entidade = dados.entidade.trim()
  dados.descricao = dados.descricao.trim()
  for (const [campo, , maximo] of listas) dados[campo] = dividirLista(dados[campo], maximo + 1)
  const datasInvalidas = (dados.prazo_hora && !dados.prazo) || (dados.data_publicacao && dados.prazo && dados.data_publicacao > dados.prazo)
  const fonteDb = fontes.value.find(item => item.id === dados.fonte_id)
  const fonteVigente = fonteDb?.activa && Date.now() - Date.parse(fonteDb.verificada_em) < 90 * 86400000
    && Date.parse(fonteDb.verificada_em) <= Date.now()
  if (!dados.url_original || !dados.url_candidatura || dados.titulo.length < 4 || dados.entidade.length < 2 ||
      dados.descricao.length < 10 || datasInvalidas ||
      listas.some(([campo, , n, max]) => dados[campo].length > n || dados[campo].some(v => v.length > max)) ||
      (dados.estado === 'activa' && (!verificar || !fonteVigente || (dados.prazo && dados.prazo < dataMaputo()) ||
        (dados.data_publicacao && dados.data_publicacao > dataMaputo())))) {
    erro.value = 'Reveja campos, datas e ligações. Para publicar, confirme o anúncio e use uma fonte activa com verificação recente.'
    return
  }
  for (const campo of ['escolaridade','experiencia_meses','data_publicacao','prazo','prazo_hora','verificada_em']) if (dados[campo] === '') dados[campo] = null
  if (verificar) dados.verificada_em = new Date().toISOString()
  const guardar = db => id ? db.from('oportunidades').update(dados).eq('id', id).select('id').single() :
    db.from('oportunidades').insert(dados).select('id').single()
  if (await executar(() => consultar(guardar), null, 'Não foi possível guardar o anúncio. Confirme fonte, estado e datas.')) {
    editarAnuncio.value = false
    carregar(pagina.value, 'Oportunidade guardada.')
  }
}

async function arquivar(item) {
  const pedido = item ? () => consultar(db => db.from('oportunidades').update({ estado: 'arquivada' }).eq('id', item.id).select('id').single()) :
    () => rpc('arquivar_expiradas')
  let total = 1
  if (await executar(pedido, resultado => { if (!item) total = resultado }, 'Não foi possível arquivar as oportunidades.')) {
    carregar(pagina.value, total === 1 ? 'Uma oportunidade arquivada.' : total + ' oportunidades arquivadas.')
  }
}
async function guardarConfiguracao() {
  const pedido = db => db.from('configuracao_alertas').update({ ...configuracao }).eq('id', ID_CONFIGURACAO_ALERTAS).select('id').single()
  if (await executar(() => consultar(pedido), null, 'Não foi possível guardar a configuração.')) carregar(pagina.value, 'Configuração guardada.')
}
function exportar() {
  descarregarFicheiro(JSON.stringify({ ...relatorio.value, estado_alertas: alertas.value, estado_worker: worker.value }, null, 2),
    'application/json', 'RumoCerto_MZ_Relatorio_Admin.json')
}
onMounted(() => { carregar(0); verificarWorker() })
</script>

<template>
  <section class="container inner-page rc-page">
    <RouterLink to="/conta" class="back-link">Voltar à área pessoal</RouterLink>
    <header class="page-heading"><h1>Administração</h1><p>Faça a revisão do catálogo e acompanhe o estado dos serviços.</p></header>
    <div class="rc-actions" aria-label="Secções de administração">
      <button v-for="[chave, titulo] in [['oportunidades','Oportunidades'],['fontes','Fontes'],['relatorio','Serviços e relatórios'],['auditoria','Auditoria']]" :key="chave" class="btn btn-outline" :aria-pressed="chave === tab" @click="tab = chave">{{ titulo }}</button>
    </div>
    <EstadoRecurso :carregando="carregando" :erro="erro" :mensagem="mensagem" repetir @repetir="carregar()" />
    <template v-if="tab === 'oportunidades'">
      <div class="rc-actions">
        <button class="btn btn-primary" :disabled="!fontes.length" @click="abrirAnuncio()">Nova oportunidade</button>
        <button class="btn btn-outline" :disabled="carregando" @click="arquivar()">Arquivar expiradas</button>
        <button v-if="!fontes.length" class="text-button" @click="tab = 'fontes'">Adicionar uma fonte</button>
      </div>
      <form v-if="editarAnuncio" class="surface rc-panel rc-form" @submit.prevent="guardarAnuncio">
        <h2>{{ anuncio.id ? 'Editar oportunidade' : 'Nova oportunidade' }}</h2>
        <div class="rc-form-grid">
          <CampoTexto v-for="campo in campos" :key="campo.chave" v-model="anuncio[campo.chave]" v-bind="campo" />
          <CampoTexto v-model="anuncio.fonte_id" titulo="Fonte" :opcoes="fontes.map(f => [f.id, f.nome])" obrigatorio />
          <CampoTexto v-model="anuncio.estado" titulo="Estado" :opcoes="Object.entries(estado)" obrigatorio />
        </div>
        <CampoTexto v-model="anuncio.descricao" titulo="Descrição" tipo="textarea" :maximo="6000" obrigatorio />
        <CampoTexto v-for="[chave, titulo] in listas" :key="chave" v-model="anuncio[chave]" :titulo="titulo" tipo="textarea" descricao="Um elemento por linha." />
        <div class="rc-actions">
          <a v-if="ligacaoHttps(anuncio.url_original)" :href="ligacaoHttps(anuncio.url_original)" target="_blank" rel="noopener noreferrer">Abrir anúncio original</a>
          <a v-if="ligacaoHttps(anuncio.url_candidatura)" :href="ligacaoHttps(anuncio.url_candidatura)" target="_blank" rel="noopener noreferrer">Abrir página de candidatura</a>
        </div>
        <label class="rc-check"><input v-model="anuncio.verificar" type="checkbox" :required="anuncio.estado === 'activa'" /> Consultei o anúncio original, confirmei os dados, as ligações e a validade.</label>
        <div class="rc-actions"><button class="btn btn-primary" :disabled="carregando">Guardar oportunidade</button><button class="btn btn-outline" type="button" @click="editarAnuncio = false">Cancelar</button></div>
      </form>
      <form class="surface rc-panel rc-form" @submit.prevent="carregar(0)">
        <div class="rc-form-grid"><CampoTexto v-model="pesquisa" titulo="Título da oportunidade" :maximo="120" /><CampoTexto v-model="estadoFiltro" titulo="Estado" :opcoes="Object.entries(estado)" /></div>
        <button class="btn btn-outline" :disabled="carregando">Filtrar</button>
      </form>
      <div class="rc-card-grid">
        <article v-for="item in anuncios" :key="item.id" class="surface rc-card">
          <p class="rc-tag">{{ estado[item.estado] }}</p><h2>{{ item.titulo }}</h2><p>{{ item.entidade }} · Prazo {{ dataLegivel(item.prazo) }}</p>
          <p>Última revisão {{ dataLegivel(item.verificada_em) }}</p>
          <div class="rc-actions"><button class="text-button" :disabled="carregando" @click="abrirAnuncio(item)">Editar</button><button v-if="item.estado !== 'arquivada'" class="text-button" :disabled="carregando" @click="arquivar(item)">Arquivar</button></div>
        </article>
      </div>
      <p v-if="!anuncios.length && !carregando && !erro" class="rc-status">Nenhuma oportunidade nesta página.</p>
      <div v-if="pagina || temMais" class="rc-actions">
        <button class="btn btn-outline" :disabled="!pagina || carregando" @click="carregar(pagina - 1)">Anterior</button><span>Página {{ pagina + 1 }}</span>
        <button class="btn btn-outline" :disabled="!temMais || carregando" @click="carregar(pagina + 1)">Seguinte</button>
      </div>
    </template>
    <template v-if="tab === 'fontes'">
      <button class="btn btn-primary" @click="abrirFonte()">Nova fonte</button>
      <form v-if="editarFonte" class="surface rc-panel rc-form" @submit.prevent="guardarFonte">
        <h2>{{ fonte.id ? 'Editar fonte' : 'Nova fonte' }}</h2>
        <CampoTexto v-model="fonte.nome" titulo="Nome da fonte" :minimo="2" :maximo="150" obrigatorio />
        <CampoTexto v-model="fonte.url" titulo="URL da fonte" tipo="url" :maximo="2048" obrigatorio />
        <a v-if="ligacaoHttps(fonte.url)" :href="ligacaoHttps(fonte.url)" target="_blank" rel="noopener noreferrer">Abrir fonte</a>
        <label class="rc-check"><input v-model="fonte.activa" type="checkbox" /> Fonte activa</label>
        <label class="rc-check"><input v-model="fonte.verificar" type="checkbox" /> Confirmei a entidade responsável e a página oficial.</label>
        <div class="rc-actions"><button class="btn btn-primary" :disabled="carregando">Guardar fonte</button><button class="btn btn-outline" type="button" @click="editarFonte = false">Cancelar</button></div>
      </form>
      <div class="rc-card-grid">
        <article v-for="item in fontes" :key="item.id" class="surface rc-card">
          <p class="rc-tag">{{ item.activa ? 'Activa' : 'Desactivada' }}</p><h2>{{ item.nome }}</h2>
          <p>Última verificação {{ dataLegivel(item.verificada_em) }}</p><button class="text-button" @click="abrirFonte(item)">Editar fonte</button>
        </article>
      </div>
    </template>
    <template v-if="tab === 'relatorio' && relatorio">
      <article class="surface rc-panel">
        <h2>Resumo agregado</h2>
        <dl class="rc-meta rc-meta-wide">
          <div><dt>Oportunidades publicadas</dt><dd>{{ relatorio.publicadas }}</dd></div>
          <div v-for="[chave, total] in Object.entries(relatorio.estados)" :key="chave"><dt>Oportunidades · {{ estado[chave] }}</dt><dd>{{ total }}</dd></div>
          <div><dt>Fontes activas</dt><dd>{{ relatorio.fontes }}</dd></div>
          <div><dt>Notificações internas</dt><dd>{{ relatorio.notificacoes }}</dd></div>
          <div><dt>Pedidos de eliminação</dt><dd>{{ relatorio.pedidos_eliminacao }}</dd></div>
          <div><dt>Worker de planos</dt><dd>{{ worker }}</dd></div>
          <div><dt>Supabase</dt><dd>Consulta autorizada concluída</dd></div>
          <div><dt>Última execução de alertas</dt><dd>{{ alertas?.estado || 'Por verificar' }} · {{ dataLegivel(alertas?.actualizado_em) }}</dd></div>
          <div v-for="[chave, total] in Object.entries(relatorio.envios)" :key="chave"><dt>Envios · {{ chave }}</dt><dd>{{ total }}</dd></div>
        </dl>
        <div class="rc-actions"><button class="btn btn-outline" @click="verificarWorker">Verificar Worker</button><button class="btn btn-outline" @click="exportar">Descarregar relatório</button></div>
      </article>
      <article class="surface rc-panel">
        <h2>Falhas recentes de envio</h2>
        <ul v-if="relatorio.ultimas_falhas.length"><li v-for="(falha, i) in relatorio.ultimas_falhas" :key="i">{{ dataLegivel(falha.tentado_em) }} · {{ falha.estado }} · {{ falha.motivo }}</li></ul>
        <p v-else>Sem falhas registadas.</p>
      </article>
      <form class="surface rc-panel rc-form" @submit.prevent="guardarConfiguracao">
        <h2>Agendamento de alertas</h2>
        <label class="rc-check"><input v-model="configuracao.internos" type="checkbox" /> Gerar alertas internos em segundo plano</label>
        <label class="rc-check"><input v-model="configuracao.resumos" type="checkbox" /> Autorizar fila semanal no Worker configurado</label>
        <button class="btn btn-primary" :disabled="carregando">Guardar configuração</button>
      </form>
    </template>
    <article v-if="tab === 'auditoria'" class="surface rc-panel">
      <h2>Últimas alterações</h2>
      <ul v-if="auditoria.length" class="rc-log"><li v-for="item in auditoria" :key="item.id"><strong>{{ item.entidade }} · {{ item.acao }}</strong> · {{ item.operador }} · {{ dataLegivel(item.criado_em) }}<small>{{ item.registo }} {{ item.estado }}</small></li></ul>
      <p v-else>Sem alterações registadas.</p>
    </article>
  </section>
</template>
