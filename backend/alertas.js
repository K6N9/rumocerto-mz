import { emailJS } from './email.js'
import { calcularCorrespondencia } from '../shared/rumomatch.js'
import { ID_CONFIGURACAO_ALERTAS } from '../shared/configuracao.js'

function apiPrivada(env) {
  const url = new URL(env.SUPABASE_URL)
  const local = ['localhost', '127.0.0.1'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Configuração incompleta')
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }
  // Legacy service_role JWTs need Authorization. New sb_secret keys are accepted via apikey.
  if (!env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY
  return async (caminho, opcoes = {}) => {
    const resposta = await fetch(new URL('/rest/v1/' + caminho, url), {
      headers, signal: AbortSignal.timeout(10000), ...opcoes
    })
    if (!resposta.ok) throw new Error('Serviço de dados indisponível')
    const corpo = await resposta.text()
    return corpo ? JSON.parse(corpo) : null
  }
}

const rpc = (api, nome, dados = {}) => api('rpc/' + nome, { method: 'POST', body: JSON.stringify(dados) })
const alterar = (api, caminho, dados) => api(caminho, { method: 'PATCH', body: JSON.stringify(dados) })
const estado = (api, dados) => alterar(api, 'execucoes_alertas?chave=eq.true', dados)

async function gerarAlertas(api) {
  const [execucao] = await api('execucoes_alertas?chave=eq.true&select=cursor_utilizador')
  // Small rotating batches keep free-plan work bounded.
  const actores = await rpc(api, 'actores_alertas', { p_depois: execucao.cursor_utilizador })
  if (!actores.length) {
    await estado(api, { cursor_utilizador: null, estado: 'concluido' })
    return
  }
  const colunas = 'id,area,escolaridade,competencias,competencias_obrigatorias,experiencia_meses,provincia,modalidade,tipo'
  const oportunidades = await api('catalogo_oportunidades?select=' + colunas + '&order=verificada_em.desc,id&limit=50')
  for (const pessoa of actores) {
    const ids = oportunidades.map(o => ({ id: o.id, ...calcularCorrespondencia(pessoa.perfil, pessoa.preferencias, o) }))
      .filter(c => c.aptaParaAlerta).sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 30).map(c => c.id)
    await rpc(api, 'materializar_alertas', { p_correspondencias: ids, p_utilizador: pessoa.utilizador })
  }
  await estado(api, { cursor_utilizador: actores.length === 8 ? actores.at(-1).utilizador : null, estado: 'concluido' })
}

function configuracaoResumo(env) {
  if (env.RESUMOS_EMAIL !== 'true' || !env.EMAILJS_SERVICE_ID || !env.EMAILJS_PUBLIC_KEY || !env.EMAILJS_TEMPLATE_RESUMO) return null
  const limite = Number(env.EMAILJS_RESUMO_LIMITE_DIA)
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) return null
  const url = new URL(env.PUBLIC_APP_URL)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
  return { limite, url }
}

async function enviarResumo(api, env, config, agendado) {
  // Build the outbox only after the weekly window begins on Monday in Maputo.
  const local = new Date(agendado + 2 * 60 * 60 * 1000)
  if (local.getUTCDay() === 1 && local.getUTCHours() >= 8) await rpc(api, 'criar_resumos')
  const [id] = await rpc(api, 'reservar_resumo', { p_limite: config.limite })
  if (!id) return
  const [dados] = await rpc(api, 'dados_resumo', { p_envio: id })
  let resultado
  if (!dados || !Number(dados.total) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email || '')) {
    resultado = { estado: 'cancelado', motivo: 'sem_consentimento' }
  } else {
    try {
      const link = sufixo => { const url = new URL(config.url); url.hash = sufixo; return url.href }
      await emailJS(env, env.EMAILJS_TEMPLATE_RESUMO, { to_email: dados.email,
        subject: 'Resumo semanal do RumoCerto MZ', total_alertas: dados.total,
        link_alertas: link('/conta/notificacoes'), link_preferencias: link('/conta/definicoes') })
      resultado = { estado: 'aceite', motivo: null }
    } catch (erro) {
      resultado = { estado: erro.status === 429 ? 'falhou' : (erro.incerta ? 'incerto' : 'falhou'),
        motivo: erro.status === 429 ? 'limite' : (erro.status ? 'fornecedor' : 'rede') }
    }
  }
  await alterar(api, 'envios?id=eq.' + id + '&estado=eq.em_envio', resultado)
}

export async function executarAlertas(env, agendado = Date.now()) {
  if (env.ALERTAS_AGENDADOS !== 'true' || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return
  let api
  try {
    api = apiPrivada(env)
    const [config] = await api('configuracao_alertas?select=internos,resumos&id=eq.' + ID_CONFIGURACAO_ALERTAS)
    if (config?.internos) await gerarAlertas(api)
    const resumo = config?.resumos ? configuracaoResumo(env) : null
    if (resumo) await enviarResumo(api, env, resumo, agendado)
  } catch {
    if (api) try { await estado(api, { estado: 'falhou' }) } catch { /* Log below if the database is unavailable. */ }
    console.error('rumocerto: falha no processamento de alertas')
  }
}
