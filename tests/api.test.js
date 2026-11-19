import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { PlanoJob, LimiteEnvios, teste } from '../backend/worker.js'
import { AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from '../shared/planner.js'

const dados = () => ({
  nome: 'Ana', area: AREAS[0], situacao: SITUACOES[0],
  objetivo: 'Criar um pequeno projecto com Vue', disponibilidade: DISPONIBILIDADES[1],
  internet: INTERNET[0], competencias: '', dificuldade: '', usarIA: false,
  consentimento: true, email: 'ana@example.com', website: '', submissaoId: crypto.randomUUID()
})
function estadoSimulado() {
  const map = new Map()
  let serial = Promise.resolve()
  let alarme = null
  return {
    storage: {
      async get(k) { return structuredClone(map.get(k)) },
      async put(k, v) { map.set(k, structuredClone(v)) },
      async setAlarm(valor) { alarme = valor },
      async deleteAll() { map.clear() },
      async getAlarm() { return alarme }
    },
    blockConcurrencyWhile(fn) {
      const atual = serial.then(fn)
      serial = atual.catch(() => {})
      return atual
    }
  }
}
function ambiente() {
  const planos = new Map(), limites = new Map()
  const env = {
    ALLOWED_ORIGINS: 'https://k6n9.github.io,http://localhost:5173',
    PUBLIC_WORKER_URL: 'https://rumocerto.example.com',
    EMAILJS_SERVICE_ID: 'service_demo', EMAILJS_PUBLIC_KEY: 'public_demo',
    EMAILJS_TEMPLATE_CONFIRM: 'confirm_demo', EMAILJS_TEMPLATE_PLAN: 'plan_demo',
    RATE_SALT: 'salt-seguro-para-testes-2026', DOWNLOAD_SECRET: 'uma-frase-secreta-de-pelo-menos-24-caracteres'
  }
  env.PLANOS = {
    idFromName: nome => nome,
    get(id) {
      if (!planos.has(id)) {
        const state = estadoSimulado()
        const object = new PlanoJob(state, env)
        planos.set(id, { object, state, fetch: (url, init) => object.fetch(new Request(url,init)) })
      }
      return planos.get(id)
    }
  }
  env.LIMITES = {
    idFromName: nome => nome,
    get(id) {
      if (!limites.has(id)) {
        const object = new LimiteEnvios(estadoSimulado())
        limites.set(id, { fetch: (url, init) => object.fetch(new Request(url,init)) })
      }
      return limites.get(id)
    }
  }
  return { env, planos, limites }
}
function request(path, method='GET', data, origin='https://k6n9.github.io', auth='', ip='127.0.0.1') {
  return new Request('https://rumocerto.example.com' + path, {
    method, headers: { Origin: origin, 'Content-Type': 'application/json',
      'CF-Connecting-IP': ip, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {})
  })
}

test('saude declara protocolo e disponibilidade do envio', async () => {
  const { env } = ambiente()
  const response = await worker.fetch(request('/api/saude'), env)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.versao, '3.5')
  assert.equal(body.envioDisponivel, true)
})
test('bloqueia origem desconhecida e responde a preflight', async () => {
  const { env } = ambiente()
  assert.equal((await worker.fetch(request('/api/saude', 'GET', null, 'https://outro.example'), env)).status, 403)
  const res = await worker.fetch(request('/api/planos','OPTIONS'), env)
  assert.equal(res.status, 204)
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /Authorization/)
})
test('rejeita perfil, consentimento e honeypot inválidos', async () => {
  for (const invalido of [{ email:'invalido' },{ consentimento:false },{ website:'sou-bot' }]) {
    const { env } = ambiente()
    assert.equal((await worker.fetch(request('/api/planos','POST',{ ...dados(),...invalido }), env)).status, 422)
  }
})
test('rejeita configuração insegura do endereço PDF', async () => {
  const { env } = ambiente()
  await assert.rejects(teste.ligacaoPdf({ ...env, PUBLIC_WORKER_URL: 'http://inseguro.example' }, crypto.randomUUID()))
})
test('assinatura PDF é exclusiva por pedido', async () => {
  const { env } = ambiente()
  const a = crypto.randomUUID(), b = crypto.randomUUID()
  assert.notEqual(await teste.assinatura(env,a), await teste.assinatura(env,b))
  assert.match(await teste.ligacaoPdf(env,a), /assinatura=[0-9a-f]{64}/)
})
test('guarda pedido primeiro, envia confirmação e entrega PDF protegido', async () => {
  const antigo = globalThis.fetch
  const mensagens = []
  globalThis.fetch = async (_url, init) => {
    mensagens.push(JSON.parse(init.body))
    return new Response('OK', { status: 200 })
  }
  try {
    const { env, planos } = ambiente()
    const response = await worker.fetch(request('/api/planos','POST',dados()), env)
    assert.equal(response.status, 201)
    const recebido = await response.json()
    assert.equal(recebido.estado, 'pendente')
    assert.equal(mensagens.length, 1)
    const internal = planos.get(recebido.id)
    assert.equal((await internal.state.storage.get('job')).estado,'pendente')
    assert.equal((await worker.fetch(request(`/api/planos/${recebido.id}`),env)).status,401)
    assert.equal((await worker.fetch(request(`/api/planos/${recebido.id}`,'GET',null,'https://k6n9.github.io',recebido.token),env)).status,200)
    const link = await teste.ligacaoPdf(env, recebido.id)
    const pdfUrl = new URL(link)
    const pdf = await worker.fetch(request(pdfUrl.pathname + pdfUrl.search), env)
    assert.equal(pdf.status,200)
    assert.equal(pdf.headers.get('Content-Type'),'application/pdf')
    assert.equal((await worker.fetch(request(pdfUrl.pathname+'?assinatura=invalid'), env)).status,401)
    const job = await internal.state.storage.get('job')
    job.agendadoPara=Date.now()-1
    await internal.state.storage.put('job',job)
    await Promise.all([internal.object.alarm(),internal.object.alarm()])
    assert.equal(mensagens.length,2)
    assert.equal(mensagens[1].template_id,'plan_demo')
    assert.equal((await internal.state.storage.get('job')).estado, 'enviado')
    assert.equal((await worker.fetch(request('/api/planos','POST',dados()),env)).status,429)
  } finally { globalThis.fetch=antigo }
})
test('duas solicitações simultâneas no mesmo IP são limitadas', async () => {
  const antigo = globalThis.fetch
  globalThis.fetch = async () => new Response('OK',{status:200})
  try {
    const { env } = ambiente()
    const results = await Promise.all([
      worker.fetch(request('/api/planos','POST',dados()),env),
      worker.fetch(request('/api/planos','POST',{ ...dados(), email:'outro@example.com' }),env)
    ])
    assert.deepEqual(results.map(x=>x.status).sort(),[201,429])
  } finally { globalThis.fetch=antigo }
})
test('falha no envio de confirmação não agenda a entrega', async () => {
  const antigo = globalThis.fetch
  globalThis.fetch = async () => new Response('erro',{status:502})
  try {
    const { env, planos } = ambiente()
    const r = await worker.fetch(request('/api/planos','POST',dados()),env)
    assert.equal(r.status,202)
    const recuperacao = await r.json()
    assert.equal(recuperacao.estado,'incerto')
    assert.equal(recuperacao.faseIncerta,'confirmacao')
    assert.match(recuperacao.token,/^[0-9a-f]{48}$/)
    const job = await [...planos.values()][0].state.storage.get('job')
    assert.equal(job.estado,'incerto')
  } finally { globalThis.fetch=antigo }
})
test('segundo envio recusado resulta em falha, sem reenvio duplicado', async () => {
  const antigo = globalThis.fetch
  let num=0
  globalThis.fetch = async () => new Response('ok',{status:++num===1?200:502})
  try {
    const { env, planos } = ambiente()
    const r = await worker.fetch(request('/api/planos','POST',dados()),env)
    const response = await r.json()
    const object = planos.get(response.id)
    const job = await object.state.storage.get('job')
    job.agendadoPara = Date.now()-1
    await object.state.storage.put('job',job)
    await object.object.alarm()
    await object.object.alarm()
    assert.equal(num,2)
    assert.equal((await object.state.storage.get('job')).estado,'incerto')
  } finally { globalThis.fetch=antigo }
})

test('saude nao anuncia email sem as credenciais obrigatorias', async () => {
  for (const chave of ['EMAILJS_SERVICE_ID', 'EMAILJS_PUBLIC_KEY', 'EMAILJS_TEMPLATE_CONFIRM', 'PUBLIC_WORKER_URL']) {
    const { env } = ambiente()
    delete env[chave]
    const response = await worker.fetch(request('/api/saude'), env)
    assert.equal((await response.json()).envioDisponivel, false, chave)
    assert.equal((await worker.fetch(request('/api/planos', 'POST', dados()), env)).status, 503, chave)
  }
})

test('guardar agenda recuperacao mesmo antes de tentar enviar confirmacao', async () => {
  const { env, planos } = ambiente()
  const id = crypto.randomUUID()
  const object = env.PLANOS.get(env.PLANOS.idFromName(id))
  const criado = await object.fetch('https://interno/guardar', {
    method: 'POST', body: JSON.stringify({ id, estado: 'por_confirmar', expiraEm: Date.now() + 7 * 86400000,
      agendadoPara: Date.now() + 300000, pedido: dados(), email: 'ana@example.com', plano: { semanas: [{ tarefas: ['passo'] }] } })
  })
  assert.equal(criado.status, 201)
  assert.ok(await planos.get(id).state.storage.getAlarm())
})

test('alarme recupera confirmacao que nao chegou a iniciar', async () => {
  const antigo = globalThis.fetch
  let enviados = 0
  globalThis.fetch = async () => { enviados++; return new Response('ok', { status: 200 }) }
  try {
    const { env, planos } = ambiente()
    const id = crypto.randomUUID()
    const object = env.PLANOS.get(env.PLANOS.idFromName(id))
    const job = { id, estado: 'por_confirmar', expiraEm: Date.now() + 7 * 86400000,
      agendadoPara: Date.now() + 300000, pedido: dados(), email: 'ana@example.com',
      plano: { semanas: [{ tarefas: ['passo'] }] } }
    assert.equal((await object.fetch('https://interno/guardar', { method: 'POST', body: JSON.stringify(job) })).status, 201)
    await planos.get(id).object.alarm()
    assert.equal(enviados, 1)
    assert.equal((await planos.get(id).state.storage.get('job')).estado, 'pendente')
  } finally { globalThis.fetch = antigo }
})

test('repetir identificador do pedido recupera sem enviar novos emails', async () => {
  const antigo = globalThis.fetch
  let enviados = 0
  globalThis.fetch = async () => { enviados++; return new Response('ok', { status: 200 }) }
  try {
    const { env } = ambiente()
    const formulario = dados()
    const resposta = await worker.fetch(request('/api/planos', 'POST', formulario), env)
    const original = await resposta.json()
    assert.equal(resposta.status, 201)
    const repetida = await worker.fetch(request('/api/planos', 'POST', formulario), env)
    assert.equal(repetida.status, 200)
    const recuperado = await repetida.json()
    assert.equal(recuperado.id, original.id)
    assert.equal(recuperado.token, original.token)
    assert.deepEqual(recuperado.plano, original.plano)
    assert.equal(enviados, 1)
  } finally { globalThis.fetch = antigo }
})

test('recusa reutilizacao do mesmo identificador para um perfil diferente', async () => {
  const antigo = globalThis.fetch
  globalThis.fetch = async () => new Response('ok', { status: 200 })
  try {
    const { env } = ambiente()
    const formulario = dados()
    assert.equal((await worker.fetch(request('/api/planos', 'POST', formulario), env)).status, 201)
    assert.equal((await worker.fetch(request('/api/planos', 'POST', {
      ...formulario, email: 'intruso@example.com'
    }), env)).status, 409)
  } finally { globalThis.fetch = antigo }
})

test('falha de rede deixa estado incerto em vez de reenviar automaticamente', async () => {
  const antigo = globalThis.fetch
  let chamados = 0
  globalThis.fetch = async () => {
    chamados++
    if (chamados === 1) return new Response('ok', { status: 200 })
    throw new TypeError('ligacao perdida depois da submissao')
  }
  try {
    const { env, planos } = ambiente()
    const resposta = await worker.fetch(request('/api/planos', 'POST', dados()), env)
    const original = await resposta.json()
    const object = planos.get(original.id)
    const job = await object.state.storage.get('job')
    job.agendadoPara = Date.now() - 1
    await object.state.storage.put('job', job)
    await object.object.alarm()
    await object.object.alarm()
    assert.equal(chamados, 2)
    assert.equal((await object.state.storage.get('job')).estado, 'incerto')
    assert.ok(await object.state.storage.getAlarm())
  } finally { globalThis.fetch = antigo }
})

test('alarme reconhece confirmacao interrompida sem reenviar', async () => {
  const antigo = globalThis.fetch
  let enviados = 0
  globalThis.fetch = async () => { enviados++; return new Response('ok',{status:200}) }
  try {
    const { env, planos } = ambiente()
    const id = crypto.randomUUID()
    const stub = env.PLANOS.get(id)
    const job = { id, estado: 'a_confirmar', confirmacaoIniciada: Date.now()-90000,
      expiraEm: Date.now()+3600000, agendadoPara: Date.now()+300000 }
    await stub.state.storage.put('job',job)
    await stub.object.alarm()
    assert.equal((await planos.get(id).state.storage.get('job')).estado,'incerto')
    assert.equal(enviados,0)
  } finally { globalThis.fetch=antigo }
})

test('alarme limpa pedido expirado sem tentar enviar', async () => {
  const { env, planos } = ambiente()
  const id = crypto.randomUUID()
  const stub = env.PLANOS.get(id)
  await stub.state.storage.put('job', { id, estado:'pendente', expiraEm: Date.now()-1 })
  await stub.object.alarm()
  assert.equal(await planos.get(id).state.storage.get('job'),undefined)
})

test('e-mail bloqueado noutro IP não bloqueia utilizador independente', async () => {
  const anterior = globalThis.fetch
  let enviados = 0
  globalThis.fetch = async () => { enviados++; return new Response('OK', { status: 200 }) }
  try {
    const { env } = ambiente()
    const a = dados()
    const primeira = await worker.fetch(request('/api/planos','POST',a,'https://k6n9.github.io','','203.0.113.10'),env)
    assert.equal(primeira.status,201)
    const repetida = await worker.fetch(request('/api/planos','POST',{...a,submissaoId:crypto.randomUUID()},'https://k6n9.github.io','','203.0.113.20'),env)
    assert.equal(repetida.status,429)
    const b = {...dados(),email:'b@example.com'}
    const terceira = await worker.fetch(request('/api/planos','POST',b,'https://k6n9.github.io','','203.0.113.20'),env)
    assert.equal(terceira.status,201)
    assert.equal(enviados,2)
  } finally { globalThis.fetch = anterior }
})

test('reserva de e-mail é libertada quando o IP já está limitado', async () => {
  const anterior=globalThis.fetch
  globalThis.fetch=async()=>new Response('OK',{status:200})
  try {
    const {env}=ambiente()
    assert.equal((await worker.fetch(request('/api/planos','POST',dados(),'https://k6n9.github.io','','198.51.100.8'),env)).status,201)
    const segundo={...dados(),email:'segundo@example.com'}
    assert.equal((await worker.fetch(request('/api/planos','POST',segundo,'https://k6n9.github.io','','198.51.100.8'),env)).status,429)
    assert.equal((await worker.fetch(request('/api/planos','POST',{...segundo,submissaoId:crypto.randomUUID()},'https://k6n9.github.io','','198.51.100.9'),env)).status,201)
  } finally { globalThis.fetch=anterior }
})

test('a reserva não pode ser libertada por outro identificador', async () => {
  const {env}=ambiente()
  const gate=env.LIMITES.get(env.LIMITES.idFromName('limite-privado'))
  const id=crypto.randomUUID()
  const opcoes=(reserva)=>({method:'POST',body:JSON.stringify({reserva})})
  assert.equal((await gate.fetch('https://interno/reservar',opcoes(id))).status,200)
  assert.deepEqual(await (await gate.fetch('https://interno/libertar',opcoes(crypto.randomUUID()))).json(),{libertado:false})
  assert.equal((await gate.fetch('https://interno/reservar',opcoes(crypto.randomUUID()))).status,429)
  assert.deepEqual(await (await gate.fetch('https://interno/libertar',opcoes(id))).json(),{libertado:true})
  assert.equal((await gate.fetch('https://interno/reservar',opcoes(crypto.randomUUID()))).status,200)
})

test('frontend rejeita saúde legada, versão errada e booleanos inválidos', async () => {
  const { classificarSaudeWorker } = await import('../shared/versao.js')
  assert.equal(classificarSaudeWorker(true, { ok: true, gratuito: true }), 'incompativel')
  for (const val of ['true', 'false', 1, null]) {
    assert.equal(classificarSaudeWorker(true, { ok: true, versao: '3.5', envioDisponivel: val }), 'incompativel')
  }
  assert.equal(classificarSaudeWorker(true, { ok: true, versao: '3.4', envioDisponivel: true }), 'incompativel')
  assert.equal(classificarSaudeWorker(false, { ok: true, versao: '3.5', envioDisponivel: true }), 'indisponivel')
  assert.equal(classificarSaudeWorker(true, { ok: true, versao: '3.5', envioDisponivel: false }), 'indisponivel')
  assert.equal(classificarSaudeWorker(true, { ok: true, versao: '3.5', envioDisponivel: true }), 'disponivel')
})

test('preflight para o estado autenticado permite Authorization apenas na origem autorizada', async () => {
  const { env } = ambiente()
  const url = 'https://rumocerto.example.com/api/planos/' + crypto.randomUUID()
  const para = (origin, campos) => new Request(url, { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': campos
  } })
  const valido = await worker.fetch(para('https://k6n9.github.io', 'authorization'), env)
  assert.equal(valido.status, 204)
  assert.equal(valido.headers.get('Access-Control-Allow-Origin'), 'https://k6n9.github.io')
  assert.match(valido.headers.get('Access-Control-Allow-Headers'), /Authorization/)
  assert.match(valido.headers.get('Vary'), /Access-Control-Request-Headers/)
  assert.equal((await worker.fetch(para('https://outro.example', 'authorization'), env)).status, 403)
  assert.equal((await worker.fetch(para('https://k6n9.github.io', 'x-externo'), env)).status, 403)
})

test('Worker recusa pedidos inválidos antes de reservar Durable Objects', async () => {
  const { env, planos, limites } = ambiente()
  const url = 'https://rumocerto.example.com/api/planos'
  const enviar = (body, tipo = 'application/json') => worker.fetch(new Request(url, {
    method: 'POST', headers: { 'Content-Type': tipo }, body
  }), env)
  assert.equal((await enviar('{}', 'text/plain')).status, 415)
  for (const body of ['null', '[]', '{']) assert.equal((await enviar(body)).status, 400)
  assert.equal((await enviar(JSON.stringify({ ...dados(), outro: 'á'.repeat(4200) }))).status, 413)
  for (const campo of [{ submissaoId: [crypto.randomUUID()] }, { email: ['ana@example.com'] }, { usarIA: 'true' }]) {
    assert.equal((await enviar(JSON.stringify({ ...dados(), ...campo }))).status, 422)
  }
  assert.equal(planos.size, 0)
  assert.equal(limites.size, 0)
})
