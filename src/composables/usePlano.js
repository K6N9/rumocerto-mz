import { ref, computed, watch } from 'vue'
import { calcularProgresso, converterPlanoDiario, podeConverterPlano } from '../../shared/planner.js'
import { assinaturaPerfil, substituirPlano } from '../../shared/estado.js'
import { estadoInicial, normalizarEstadoSalvo } from '../../shared/persistencia.js'
import { erroPlano } from '../../shared/contratoPlano.js'
import { conta } from '../services/supabase.js'
import { consultar, rpc } from '../services/dados.js'

const KEY = 'rumocerto:v3:estado'
const contaId = computed(() => conta.utilizador?.id || '')
function ler() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') }
  catch { return null }
}

function normalizarRascunho(valor) {
  const dados = normalizarEstadoSalvo(valor?.dados)
  const id = dados.plano && /^[0-9a-f-]{36}$/i.test(valor?.id) ? valor.id : null
  const pendentes = Object.fromEntries(Object.entries(valor?.pendentes || {}).filter(([chave, valor]) =>
    /^[0-3]-[0-9]$/.test(chave) && typeof valor === 'boolean' && dados.plano?.semanas[Number(chave[0])]?.tarefas[Number(chave[2])]))
  return { dados, id, sincronizado: Boolean(id && valor?.sincronizado === true), pendentes }
}
function normalizarHistorico(valor) {
  return Array.isArray(valor) ? valor.map(normalizarRascunho).filter(item => item.dados.plano) : []
}

const salvo = ler()
const local = ref(normalizarEstadoSalvo(salvo))
const historicoLocal = ref(normalizarHistorico(salvo?.historico))
const privado = ref(estadoInicial())
const historicoPrivado = ref([])
const historico = computed(() => contaId.value ? historicoPrivado.value : historicoLocal.value)
const identificador = ref(null)
const sincronizado = ref(false)
const pendentes = ref({})
const estadoSync = ref('')
const ocupado = ref(false)
const dados = computed({ get: () => contaId.value ? privado.value : local.value, set: novo => {
  if (contaId.value) privado.value = novo
  else local.value = novo
} })
watch([local, historicoLocal], ([estado, anteriores]) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...estado, historico: anteriores })) } catch {}
}, { deep: true })
const chavePrivada = id => 'rumocerto:v4:rascunho:' + id
watch(contaId, (actual, anterior) => {
  let rascunho = null
  try {
    if (anterior) sessionStorage.removeItem(chavePrivada(anterior))
    if (actual) rascunho = JSON.parse(sessionStorage.getItem(chavePrivada(actual)) || 'null')
  } catch {}
  historicoPrivado.value = normalizarHistorico(rascunho?.historico)
  activarRascunho(rascunho)
  ocupado.value = false
}, { flush: 'sync', immediate: true })

watch([privado, identificador, sincronizado, pendentes, historicoPrivado], () => {
  if (!contaId.value) return
  const chave = chavePrivada(contaId.value)
  try {
    if (!privado.value.plano && !historicoPrivado.value.length) { sessionStorage.removeItem(chave); return }
    sessionStorage.setItem(chave, JSON.stringify({ dados: privado.value, id: identificador.value,
      sincronizado: sincronizado.value, pendentes: pendentes.value, historico: historicoPrivado.value }))
  } catch {}
}, { deep: true })

function novoRascunho() {
  identificador.value = null
  sincronizado.value = false
  pendentes.value = {}
  estadoSync.value = ''
}

function activarRascunho(valor) {
  const rascunho = normalizarRascunho(valor)
  privado.value = rascunho.dados
  identificador.value = rascunho.id
  sincronizado.value = rascunho.sincronizado
  pendentes.value = rascunho.pendentes
  estadoSync.value = Object.keys(pendentes.value).length ? 'Há alterações por guardar na conta.' : ''
}

function arquivarActual() {
  if (!dados.value.plano) return
  const id = contaId.value ? identificador.value : null
  const indice = id ? historico.value.findIndex(item => item.id === id) : -1
  if (indice !== -1) historico.value.splice(indice, 1)
  historico.value.unshift(normalizarRascunho({ dados: dados.value, id,
    sincronizado: contaId.value && sincronizado.value, pendentes: contaId.value ? pendentes.value : {} }))
}

function abrirAnterior(indice) {
  if (ocupado.value || !historico.value[indice]) return false
  const [anterior] = historico.value.splice(indice, 1)
  arquivarActual()
  if (contaId.value) activarRascunho(anterior)
  else dados.value = anterior.dados
  return true
}

async function guardarNaConta() {
  if (!contaId.value || !privado.value.plano || ocupado.value) return false
  const problema = erroPlano(privado.value.plano)
  if (problema) { estadoSync.value = problema; return false }
  const utilizador = contaId.value
  const actual = identificador.value ??= crypto.randomUUID()
  const actualEstado = normalizarEstadoSalvo(privado.value)
  ocupado.value = true
  estadoSync.value = 'A guardar o plano…'
  try {
    if (!sincronizado.value) await rpc('guardar_plano', {
      p_id: actual, p_plano: actualEstado.plano, p_perfil: actualEstado.perfilDoPlano, p_concluidas: actualEstado.concluidas
    })
    if (contaId.value !== utilizador || identificador.value !== actual) return false
    sincronizado.value = true
    while (Object.keys(pendentes.value).length && contaId.value === utilizador && identificador.value === actual) {
      const [chave, valor] = Object.entries(pendentes.value)[0]
      await rpc('actualizar_tarefa', { p_plano: actual, p_chave: chave, p_concluida: valor })
      if (contaId.value === utilizador && identificador.value === actual && pendentes.value[chave] === valor) delete pendentes.value[chave]
    }
    if (contaId.value === utilizador && identificador.value === actual) estadoSync.value = 'Plano e progresso guardados na conta.'
    return true
  } catch (erro) {
    if (contaId.value === utilizador && identificador.value === actual) {
      estadoSync.value = erro.code === '22023'
        ? 'O servidor rejeitou a estrutura do plano. O rascunho continua nesta sessão.'
        : 'Falha de sincronização. O plano continua nesta sessão. Pode voltar a guardar.'
    }
    return false
  } finally { if (contaId.value === utilizador) ocupado.value = false }
}

async function abrirPlano(id) {
  if (!contaId.value || ocupado.value) return false
  if (id === identificador.value) return true
  const noHistorico = historico.value.findIndex(item => item.id === id && Object.keys(item.pendentes).length)
  if (noHistorico !== -1) return abrirAnterior(noHistorico)
  const utilizador = contaId.value
  ocupado.value = true
  estadoSync.value = 'A abrir o plano…'
  try {
    const [registo, tarefas] = await Promise.all([
      consultar(db => db.from('planos').select('dados,perfil').eq('id', id).eq('utilizador', utilizador).single()),
      consultar(db => db.from('tarefas').select('chave,concluida').eq('plano_id', id).eq('utilizador', utilizador))
    ])
    if (contaId.value !== utilizador) return false
    const aberto = normalizarEstadoSalvo({ perfil: registo.perfil, plano: registo.dados, concluidas: tarefas.filter(t => t.concluida).map(t => t.chave) })
    if (!aberto.plano) throw new Error('Estrutura de plano inválida')
    const indice = historico.value.findIndex(item => item.id === id)
    if (indice !== -1) historico.value.splice(indice, 1)
    arquivarActual()
    privado.value = aberto
    identificador.value = id
    sincronizado.value = true
    pendentes.value = {}
    estadoSync.value = 'Plano da conta carregado.'
    return true
  } catch (erro) {
    if (contaId.value === utilizador) estadoSync.value = erro.message === 'Estrutura de plano inválida'
      ? 'O plano guardado tem uma estrutura inválida.' : 'Não foi possível abrir o plano guardado.'
    return false
  } finally { if (contaId.value === utilizador) ocupado.value = false }
}
export function usePlano() {
  const perfil = computed(() => dados.value.perfil)
  const plano = computed(() => dados.value.plano)
  const concluidas = computed(() => dados.value.concluidas)
  const perfilDoPlano = computed(() => dados.value.perfilDoPlano)
  const progresso = computed(() => calcularProgresso(dados.value.plano, dados.value.concluidas))
  const desactualizado = computed(() => Boolean(dados.value.plano && dados.value.assinatura !== assinaturaPerfil(dados.value.perfil)))
  const importavel = computed(() => Boolean(contaId.value && local.value.plano))

  function guardarPlano(novo, { confirmado = false, perfilPlano = dados.value.perfil } = {}) {
    const problema = erroPlano(novo)
    if (problema) throw new Error(problema)
    if (ocupado.value) return false
    const anterior = dados.value
    const igual = anterior.plano &&
      JSON.stringify({ ...anterior.plano, criadoEm: undefined }) === JSON.stringify({ ...novo, criadoEm: undefined }) &&
      anterior.assinatura === assinaturaPerfil(perfilPlano)
    if (igual) return true
    if (anterior.plano) {
      if (!confirmado) return false
      arquivarActual()
    }
    dados.value = substituirPlano(anterior, novo, perfilPlano)
    if (contaId.value) novoRascunho()
    return true
  }

  const convertivel = computed(() => podeConverterPlano(plano.value))
  function converterPlano() {
    const anterior = dados.value
    const conversao = converterPlanoDiario(anterior.plano, anterior.concluidas)
    if (!conversao || !guardarPlano(conversao.plano, { confirmado: true, perfilPlano: anterior.perfilDoPlano })) return false
    dados.value.concluidas = conversao.concluidas
    return true
  }

  function alternarTarefa(chave) {
    if (!dados.value.plano || !/^[0-3]-[0-9]$/.test(chave)) return
    const [semana, tarefa] = chave.split('-').map(Number)
    if (!dados.value.plano.semanas[semana]?.tarefas[tarefa]) return
    const actual = new Set(dados.value.concluidas)
    if (actual.has(chave)) actual.delete(chave)
    else actual.add(chave)
    dados.value.concluidas = [...actual]
    if (contaId.value && identificador.value) {
      pendentes.value[chave] = actual.has(chave)
      if (sincronizado.value && !ocupado.value) guardarNaConta()
    }
  }
  function limpar() {
    dados.value = estadoInicial()
    if (contaId.value) novoRascunho()
  }
  function importarLocal() {
    if (!importavel.value || ocupado.value || dados.value.plano) return
    privado.value = normalizarEstadoSalvo(JSON.parse(JSON.stringify(local.value)))
    novoRascunho()
    estadoSync.value = 'Plano deste navegador aberto. Pode guardá-lo na conta.'
  }
  return { perfil, perfilDoPlano, plano, concluidas, progresso, desactualizado, guardarPlano, alternarTarefa, limpar,
    guardarNaConta, abrirPlano, importarLocal, importavel, estadoSync, ocupado, identificador, historico, abrirAnterior, convertivel, converterPlano }
}
