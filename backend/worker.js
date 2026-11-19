import { emailJS } from './email.js'
import { executarAlertas } from './alertas.js'
import { gerarPlanoDiario, validarPerfil, limparTexto } from '../shared/planner.js'
import { gerarPdf, gerarPdfUnicode } from '../shared/pdf.js'
import { erroPlano } from '../shared/contratoPlano.js'
import { VERSAO_PROTOCOLO } from '../shared/versao.js'

const RETENCAO_MS = 7 * 24 * 60 * 60 * 1000
const ESPERA_MS = 5 * 60 * 1000
const LIMITE_MS = 90 * 1000
const ORIGEM_LOCAL = 'http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173'
const MAXIMO_PEDIDO_BYTES = 8000
const ROTA_PEDIDO = /^\/api\/planos\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(\/pdf)?$/i
const PRAZO_ESTADO_MS = 75 * 1000
const SUBMISSAO_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function responder(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', ...headers
  } })
}
function erro(mensagem, status = 400, headers = {}) { return responder({ erro: mensagem }, status, headers) }
function origemPermitida(request, env) {
  const origem = request.headers.get('Origin') || ''
  const permitidas = String(env.ALLOWED_ORIGINS || ORIGEM_LOCAL).split(',').map(s => s.trim())
  return origem && permitidas.includes(origem) ? {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  } : { 'Vary': 'Origin' }
}
async function digest(valor) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor))
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('')
}
function raizWorker(valor) {
  const url = new URL(valor)
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (!(url.protocol === 'https:' || local) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Endereço público inválido')
  }
  return url
}
function configuracaoEnvio(env) {
  if (!env?.PLANOS || !env?.LIMITES ||
      !['EMAILJS_SERVICE_ID', 'EMAILJS_PUBLIC_KEY', 'EMAILJS_TEMPLATE_CONFIRM', 'EMAILJS_TEMPLATE_PLAN']
        .every(chave => typeof env[chave] === 'string' && env[chave].trim()) ||
      String(env.DOWNLOAD_SECRET || '').trim().length < 24 || String(env.RATE_SALT || '').trim().length < 16) return false
  try { raizWorker(env.PUBLIC_WORKER_URL); return true }
  catch { return false }
}
async function gerarToken(env, id, email) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(env.DOWNLOAD_SECRET)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const assinatura = await crypto.subtle.sign('HMAC', chave,
    new TextEncoder().encode(`rumocerto:estado:${id}:${email.toLowerCase()}`))
  return [...new Uint8Array(assinatura)].slice(0, 24).map(n => n.toString(16).padStart(2, '0')).join('')
}
async function assinatura(env, id) {
  if (!env.DOWNLOAD_SECRET || String(env.DOWNLOAD_SECRET).length < 24) throw new Error('Configuração incompleta')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.DOWNLOAD_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`rumocerto:pdf:${id}`))
  return [...new Uint8Array(sig)].map(v => v.toString(16).padStart(2, '0')).join('')
}
async function ligacaoPdf(env, id) {
  const raiz = raizWorker(env.PUBLIC_WORKER_URL)
  const url = new URL(`/api/planos/${id}/pdf`, raiz)
  url.searchParams.set('assinatura', await assinatura(env, id))
  return url.toString()
}
function estadoPublico(job) {
  const estado = job.estado === 'enviando' && Date.now() - job.agendadoPara > 10 * 60 * 1000 ? 'incerto' : job.estado
  return { id: job.id, estado, agendadoPara: new Date(job.agendadoPara).toISOString(),
    enviadoEm: job.enviadoEm || null, metodo: job.plano.metodo,
    faseIncerta: estado === 'incerto' ? (job.faseIncerta || 'entrega') : null }
}
function parametrosConfirmacao(job) {
  return {
    to_email: job.email, nome: job.pedido.nome || 'Jovem', area: job.pedido.area,
    situacao: job.pedido.situacao, objetivo: job.pedido.objetivo,
    disponibilidade: job.pedido.disponibilidade, internet: job.pedido.internet,
    usar_ia: job.pedido.usarIA ? 'Sim' : 'Não',
    passos: job.plano.semanas[0].tarefas.slice(0, 3).join('\n'),
    notas: job.pedido.dificuldade || 'Não indicado',
    subject: 'Confirmação do pedido — RumoCerto MZ', prazo: 'Cerca de 5 a 7 minutos'
  }
}
async function gerarOpcional(p, env) {
  const base = gerarPlanoDiario(p)
  if (!p.usarIA || !env.GEMINI_API_KEY) return base
  try {
    const instrucao = `Produz apenas JSON válido com chaves diagnostico e estrategia (textos curtos). És um orientador educativo moçambicano. Não inventes vagas, cursos pagos, estatísticas ou garantias de contratação. Área: ${limparTexto(p.area, 80)}. Objectivo: ${limparTexto(p.objetivo, 450)}. Situação: ${limparTexto(p.situacao, 80)}. Dificuldade: ${limparTexto(p.dificuldade, 200)}.`
    const modelo = /^[a-z0-9.-]+$/.test(String(env.GEMINI_MODEL || '')) ? String(env.GEMINI_MODEL) : 'gemini-3.5-flash-lite'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 9000)
    let response
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: instrucao }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 600 } })
      })
    } finally { clearTimeout(timeout) }
    if (!response.ok) return base
    const dados = await response.json()
    const conteudo = JSON.parse(dados.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    if (typeof conteudo.diagnostico !== 'string' || typeof conteudo.estrategia !== 'string') return base
    const diagnostico = limparTexto(conteudo.diagnostico, 600)
    const estrategia = limparTexto(conteudo.estrategia, 600)
    if (!diagnostico || !estrategia) return base
    return { ...base, diagnostico, estrategia, metodo: 'Plano com personalização opcional' }
  } catch { return base }
}

export class LimiteEnvios {
  constructor(state) { this.state = state }
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method !== 'POST' || !['/reservar', '/libertar'].includes(url.pathname)) return erro('Rota inválida', 404)
    let dados
    try { dados = await request.json() } catch { return erro('Reserva inválida', 400) }
    if (!SUBMISSAO_RE.test(String(dados?.reserva || ''))) return erro('Reserva inválida', 422)
    return this.state.blockConcurrencyWhile(async () => {
      const agora = Date.now()
      const dono = await this.state.storage.get('reserva')
      if (url.pathname === '/libertar') {
        if (dono === dados.reserva) {
          await this.state.storage.deleteAll()
          return responder({ libertado: true })
        }
        return responder({ libertado: false })
      }
      const bloqueadoAte = Number(await this.state.storage.get('ate') || 0)
      if (bloqueadoAte > agora) return erro('Aguarda 90 segundos antes de enviar outro pedido.', 429)
      await this.state.storage.put('ate', agora + LIMITE_MS)
      await this.state.storage.put('reserva', dados.reserva)
      await this.state.storage.setAlarm(agora + LIMITE_MS)
      return responder({ ok: true })
    })
  }
  async alarm() {
    const ate = Number(await this.state.storage.get('ate') || 0)
    if (ate > Date.now()) await this.state.storage.setAlarm(ate)
    else await this.state.storage.deleteAll()
  }
}

export class PlanoJob {
  constructor(state, env) { this.state = state; this.env = env }
  async guardar(job) {
    return this.state.blockConcurrencyWhile(async () => {
      if (await this.state.storage.get('job')) return erro('Pedido já existente.', 409)
      await this.state.storage.put('job', job)
      await this.state.storage.setAlarm(Math.min(job.expiraEm, Date.now() + PRAZO_ESTADO_MS))
      return responder({ ok: true }, 201)
    })
  }
  async confirmar() {
    const reserva = await this.state.blockConcurrencyWhile(async () => {
      const job = await this.state.storage.get('job')
      if (!job || job.estado !== 'por_confirmar') return null
      job.estado = 'a_confirmar'
      job.confirmacaoIniciada = Date.now()
      await this.state.storage.put('job', job)
      await this.state.storage.setAlarm(Math.min(job.expiraEm, Date.now() + PRAZO_ESTADO_MS))
      return job
    })
    if (!reserva) return erro('Pedido indisponível.', 409)
    let aceite = false
    let falha = null
    try { await emailJS(this.env, this.env.EMAILJS_TEMPLATE_CONFIRM, parametrosConfirmacao(reserva)); aceite = true }
    catch (e) { falha = e }
    await this.state.blockConcurrencyWhile(async () => {
      const job = await this.state.storage.get('job')
      if (!job || job.estado !== 'a_confirmar') return
      job.estado = aceite ? 'pendente' : falha?.incerta ? 'incerto' : 'falhou'
      job.faseIncerta = aceite ? null : 'confirmacao'
      await this.state.storage.put('job', job)
      await this.state.storage.setAlarm(aceite ? job.agendadoPara : job.expiraEm)
    })
    return aceite ? responder({ ok: true }) :
      erro(falha?.incerta ? 'Não foi possível confirmar o envio inicial. Verifique a caixa de entrada antes de repetir o pedido.' :
        'O serviço de e-mail recusou a confirmação.', falha?.incerta ? 503 : 502)
  }
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/guardar' && request.method === 'POST') return this.guardar(await request.json())
    if (url.pathname === '/confirmar' && request.method === 'POST') return this.confirmar()
    if (url.pathname === '/repetir' && request.method === 'POST') {
      const dados = await request.json()
      const job = await this.state.storage.get('job')
      if (!job) return erro('Pedido inexistente.', 404)
      if (job.impressao !== dados.impressao) return erro('Identificador já utilizado por outro pedido.', 409)
      if (job.expiraEm <= Date.now()) return erro('Pedido expirado.', 410)
      return responder({ existente: true, ...estadoPublico(job), plano: job.plano }, job.estado === 'a_confirmar' || job.estado === 'por_confirmar' ? 202 : 200)
    }
    if (url.pathname === '/estado' && request.method === 'GET') {
      const segredo = request.headers.get('Authorization')?.match(/^Bearer +([0-9a-f]{48})$/i)?.[1]
      if (!segredo) return erro('Acesso não autorizado.', 401)
      const job = await this.state.storage.get('job')
      if (!job || job.expiraEm < Date.now()) return erro('Pedido expirado.', 404)
      if (await digest(segredo) !== job.hash) return erro('Acesso não autorizado.', 401)
      return responder(estadoPublico(job))
    }
    if (url.pathname === '/pdf' && request.method === 'GET') {
      const sig = url.searchParams.get('assinatura') || ''
      const job = await this.state.storage.get('job')
      if (!job || job.expiraEm < Date.now()) return erro('Documento expirado.', 404)
      if (!/^[0-9a-f]{64}$/.test(sig) || sig !== await assinatura(this.env, job.id)) return erro('Acesso não autorizado.', 401)
      let pdf, modoPdf = 'unicode'
      try { pdf = await gerarPdfUnicode(job.pedido, job.plano) }
      catch { pdf = gerarPdf(job.pedido, job.plano); modoPdf = 'compatibilidade' }
      return new Response(pdf, { headers: {
        'X-RumoCerto-PDF': modoPdf,
        'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="RumoCerto_MZ_Plano_30_Dias.pdf"',
        'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow'
      } })
    }
    return erro('Rota inválida.', 404)
  }
  async alarm() {
    const job = await this.state.blockConcurrencyWhile(async () => {
      const actual = await this.state.storage.get('job')
      if (!actual) return null
      const agora = Date.now()
      if (agora >= actual.expiraEm) { await this.state.storage.deleteAll(); return null }
      if (actual.estado === 'por_confirmar') return { confirmar: true }
      if (['a_confirmar', 'enviando'].includes(actual.estado)) {
        const inicio = actual.estado === 'a_confirmar' ? actual.confirmacaoIniciada : actual.envioIniciado
        if (agora - Number(inicio || 0) >= PRAZO_ESTADO_MS) {
          actual.estado = 'incerto'
          actual.faseIncerta = actual.faseIncerta || (inicio === actual.confirmacaoIniciada ? 'confirmacao' : 'entrega')
          await this.state.storage.put('job', actual)
        }
        await this.state.storage.setAlarm(actual.estado === 'incerto' ? actual.expiraEm : Math.min(actual.expiraEm, agora + PRAZO_ESTADO_MS))
        return null
      }
      if (actual.estado !== 'pendente') { await this.state.storage.setAlarm(actual.expiraEm); return null }
      if (agora < actual.agendadoPara) { await this.state.storage.setAlarm(actual.agendadoPara); return null }
      actual.estado = 'enviando'
      actual.envioIniciado = agora
      await this.state.storage.put('job', actual)
      await this.state.storage.setAlarm(Math.min(actual.expiraEm, agora + PRAZO_ESTADO_MS))
      return actual
    })
    if (!job) return
    if (job.confirmar) { await this.confirmar(); return }
    let aceite = false
    let falha = null
    try {
      await emailJS(this.env, this.env.EMAILJS_TEMPLATE_PLAN, {
        to_email: job.email, nome: job.pedido.nome || 'Jovem',
        titulo_plano: job.plano.titulo, resumo_plano: job.plano.diagnostico,
        metodo: job.plano.metodo, link_pdf: await ligacaoPdf(this.env, job.id),
        area: job.pedido.area, situacao: job.pedido.situacao, objetivo: job.pedido.objetivo,
        disponibilidade: job.pedido.disponibilidade, internet: job.pedido.internet,
        prazo: new Date(job.agendadoPara).toISOString()
      })
      aceite = true
    } catch (e) { falha = e }
    await this.state.blockConcurrencyWhile(async () => {
      const actual = await this.state.storage.get('job')
      if (!actual || (actual.estado !== 'enviando' && actual.estado !== 'incerto') || actual.envioIniciado !== job.envioIniciado) return
      actual.estado = aceite ? 'enviado' : falha?.incerta ? 'incerto' : 'falhou'
      actual.faseIncerta = aceite ? null : 'entrega'
      if (aceite) actual.enviadoEm = new Date().toISOString()
      await this.state.storage.put('job', actual)
      await this.state.storage.setAlarm(actual.expiraEm)
    })
  }
}

async function lerPedido(request) {
  if (Number(request.headers.get('Content-Length')) > MAXIMO_PEDIDO_BYTES) return { excessivo: true }
  if (!request.body) return {}
  const fluxo = request.body.getReader()
  const leitor = new TextDecoder('utf-8', { fatal: true })
  let tamanho = 0
  let texto = ''
  try {
    while (true) {
      const { done, value } = await fluxo.read()
      if (done) break
      tamanho += value.byteLength
      if (tamanho > MAXIMO_PEDIDO_BYTES) {
        await fluxo.cancel().catch(() => {})
        return { excessivo: true }
      }
      texto += leitor.decode(value, { stream: true })
    }
    return { dados: JSON.parse(texto + leitor.decode()) }
  } catch {
    await fluxo.cancel().catch(() => {})
    return {}
  } finally { fluxo.releaseLock() }
}

async function criarPedido(request, env, headers) {
  if (!configuracaoEnvio(env)) return erro('O envio ainda não está configurado.', 503, headers)
  const tipo = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase()
  if (tipo !== 'application/json') return erro('O pedido deve usar application/json.', 415, headers)
  const { dados, excessivo } = await lerPedido(request)
  if (excessivo) return erro('Pedido demasiado grande.', 413, headers)
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return erro('Pedido inválido.', 400, headers)
  const erros = validarPerfil(dados, { exigirEmail: true })
  for (const campo of ['nome', 'objetivo', 'competencias', 'dificuldade', 'email', 'website']) {
    if (dados[campo] !== undefined && typeof dados[campo] !== 'string') erros[campo] = 'Introduza um texto válido.'
  }
  if (dados.usarIA !== undefined && typeof dados.usarIA !== 'boolean') erros.usarIA = 'Escolha uma opção válida.'
  if (Object.keys(erros).length) return responder({ erro: 'Verifique os campos do formulário.', erros }, 422, headers)
  if (typeof dados.submissaoId !== 'string' || !SUBMISSAO_RE.test(dados.submissaoId)) return erro('Identificador do pedido inválido.', 422, headers)
  const pedido = {
    nome: limparTexto(dados.nome, 90), area: dados.area, situacao: dados.situacao,
    objetivo: limparTexto(dados.objetivo, 450), disponibilidade: dados.disponibilidade,
    internet: dados.internet, competencias: limparTexto(dados.competencias, 300),
    dificuldade: limparTexto(dados.dificuldade, 450), usarIA: dados.usarIA === true
  }
  const id = dados.submissaoId.toLowerCase()
  const email = String(dados.email).trim().toLowerCase()
  const impressao = await digest(JSON.stringify({ ...pedido, email }))
  const objecto = env.PLANOS.get(env.PLANOS.idFromName(id))
  const repetido = await objecto.fetch('https://interno/repetir', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ impressao })
  })
  if (repetido.status !== 404) {
    const anterior = await repetido.json()
    if (!repetido.ok) return responder(anterior, repetido.status, headers)
    return responder({ ...anterior, token: await gerarToken(env, id, email), recuperado: true }, repetido.status, headers)
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip'
  const reservas = []
  async function libertarReservas() {
    await Promise.allSettled(reservas.map(gate => gate.fetch('https://interno/libertar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reserva: id })
    })))
  }
  try {
    for (const chave of [`email:${email}`, `ip:${ip.toLowerCase()}`]) {
      const grupo = await digest(`${String(env.RATE_SALT)}:${chave}`)
      const gate = env.LIMITES.get(env.LIMITES.idFromName(grupo))
      const reservado = await gate.fetch('https://interno/reservar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reserva: id })
      })
      if (!reservado.ok) {
        await libertarReservas()
        return erro('Aguarda 90 segundos antes de enviar outro pedido.', reservado.status, headers)
      }
      reservas.push(gate)
    }
  } catch {
    await libertarReservas()
    return erro('Não foi possível verificar o limite de envios. Tenta novamente.', 503, headers)
  }
  const plano = await gerarOpcional(pedido, env)
  if (erroPlano(plano)) {
    await libertarReservas()
    return erro('Não foi possível gerar um plano válido.', 503, headers)
  }
  const token = await gerarToken(env, id, email)
  const agora = Date.now()
  const job = { id, impressao, hash: await digest(token), email, pedido, plano,
    estado: 'por_confirmar', criadoEm: new Date(agora).toISOString(),
    agendadoPara: agora + ESPERA_MS, expiraEm: agora + RETENCAO_MS, enviadoEm: null }
  const persistido = await objecto.fetch('https://interno/guardar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job)
  })
  if (persistido.status === 409) {
    const anterior = await objecto.fetch('https://interno/repetir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ impressao })
    })
    const resposta = await anterior.json()
    if (!anterior.ok) { await libertarReservas(); return responder(resposta, anterior.status, headers) }
    await libertarReservas()
    return responder({ ...resposta, token, recuperado: true }, anterior.status, headers)
  }
  if (!persistido.ok) {
    await libertarReservas()
    return erro('Não foi possível guardar o pedido.', 503, headers)
  }
  const confirmado = await objecto.fetch('https://interno/confirmar', { method: 'POST' })
  if (!confirmado.ok) {
    const recuperado = await objecto.fetch('https://interno/repetir', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ impressao })
    })
    if (recuperado.ok) {
      const anterior = await recuperado.json()
      return responder({ ...anterior, token, recuperado: true,
        mensagem: 'Não foi possível confirmar o processamento da mensagem. Consulte o estado do pedido antes de tentar novamente.' }, 202, headers)
    }
    return erro('Não foi possível confirmar o envio. Verifique a caixa de entrada antes de repetir o pedido.', confirmado.status, headers)
  }
  return responder({ ...estadoPublico({ ...job, estado: 'pendente' }), token, plano,
    mensagem: 'Confirmação aceite pelo serviço de e-mail.' }, 201, headers)
}

export default {
  scheduled(evento, env, contexto) {
    contexto.waitUntil(executarAlertas(env, evento.scheduledTime))
  },
  async fetch(request, env) {
    const headers = origemPermitida(request, env)
    const origin = request.headers.get('Origin')
    if (origin && !headers['Access-Control-Allow-Origin']) return erro('Origem não autorizada.', 403, headers)
    if (request.method === 'OPTIONS') {
      headers.Vary = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
      const metodo = request.headers.get('Access-Control-Request-Method')
      const campos = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(v => v.trim()).filter(Boolean)
      if ((metodo && !['GET', 'POST'].includes(metodo)) || campos.some(v => !['authorization', 'content-type'].includes(v))) {
        return erro('Preflight não autorizado.', 403, headers)
      }
      return new Response(null, { status: 204, headers })
    }
    const url = new URL(request.url)
    try {
      if (url.pathname === '/api/saude' && request.method === 'GET') return responder({ ok: true,
        aplicacao: 'RumoCerto MZ', versao: VERSAO_PROTOCOLO,
        envioDisponivel: configuracaoEnvio(env) }, 200, headers)
      if (url.pathname === '/api/planos' && request.method === 'POST') return await criarPedido(request, env, headers)
      const match = url.pathname.match(ROTA_PEDIDO)
      if (match && request.method === 'GET') {
        if (!env.PLANOS) return erro('Serviço indisponível.', 503, headers)
        const objecto = env.PLANOS.get(env.PLANOS.idFromName(match[1].toLowerCase()))
        const interno = new URL(match[2] ? 'https://interno/pdf' : 'https://interno/estado')
        if (match[2]) interno.searchParams.set('assinatura', url.searchParams.get('assinatura') || '')
        const upstream = await objecto.fetch(interno, { headers: { Authorization: request.headers.get('Authorization') || '' } })
        const resposta = new Response(upstream.body, upstream)
        for (const [k, v] of Object.entries(headers)) resposta.headers.set(k, v)
        return resposta
      }
      return erro('Rota inexistente.', 404, headers)
    } catch { return erro('Serviço temporariamente indisponível.', 503, headers) }
  }
}

export const teste = { criarPedido, assinatura, ligacaoPdf, gerarOpcional, estadoPublico, configuracaoEnvio, gerarToken }
