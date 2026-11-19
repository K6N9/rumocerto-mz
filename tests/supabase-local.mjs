import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { gerarPlano } from '../shared/planner.js'

function urlLocal(variavel) {
  const valor = process.env[variavel]
  const url = valor && new URL(valor)
  if (!url || url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.username || url.password) throw new Error('Indique uma URL HTTP local em ' + variavel)
  return url
}

async function mensagemPara(mailpit, email, excluir = '') {
  for (let i = 0; i < 20; i++) {
    const resposta = await fetch(new URL('/api/v1/messages', mailpit))
    const { messages } = await resposta.json()
    const item = messages.find(m => m.ID !== excluir && m.To.some(to => to.Address === email))
    if (item) {
      const detalhe = await (await fetch(new URL('/api/v1/message/' + item.ID, mailpit))).json()
      const url = detalhe.HTML.match(/href="([^"]*token_hash[^"]*)"/)?.[1]
      if (!url) throw new Error('A mensagem de Auth não contém o template local com token_hash.')
      return { id: item.ID, url: new URL(url.replaceAll('&amp;', '&')) }
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('A mensagem fictícia não foi captada pelo Mailpit.')
}

test('Supabase local: registo, confirmação, recuperação e acesso ao plano noutro navegador', { timeout: 120000 }, async t => {
  const api = urlLocal('RUMOCERTO_SUPABASE_URL')
  const mailpit = urlLocal('RUMOCERTO_MAILPIT_URL')
  const chave = process.env.RUMOCERTO_SUPABASE_CHAVE_PUBLICA
  assert.ok(chave, 'Indique a chave pública da stack isolada.')
  const vite = await createServer({
    configFile: false, plugins: [vue()], server: { host: '127.0.0.1', hmr: false },
    define: {
      'import.meta.env.VITE_WORKER_URL': '""',
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(api.origin),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(chave)
    }
  })
  t.after(() => vite.close())
  await vite.listen()
  const site = vite.resolvedUrls.local[0]
  const browser = await chromium.launch(process.env.RUMOCERTO_CHROME ? { executablePath: process.env.RUMOCERTO_CHROME } : { channel: 'chrome' })
  t.after(() => browser.close())
  const erros = []
  async function abrir() {
    const pagina = await browser.newPage()
    pagina.setDefaultTimeout(15000)
    pagina.on('pageerror', e => erros.push(e.message))
    await pagina.route('**/*', route => [api.origin, new URL(site).origin].includes(new URL(route.request().url()).origin) ?
      route.continue() : route.abort())
    return pagina
  }
  async function abrirLigacao(pagina, ligacao, tipo, destino) {
    assert.equal(ligacao.search, '')
    const parametros = new URLSearchParams(ligacao.hash.slice(1))
    assert.equal(parametros.get('type'), tipo)
    assert.ok(parametros.has('token_hash'))
    const verificacao = pagina.waitForRequest(pedido => new URL(pedido.url()).pathname === '/auth/v1/verify')
    const documento = await pagina.goto(site + ligacao.hash)
    const pedido = await verificacao
    assert.equal(new URL(documento.request().url()).search, '')
    assert.equal(pedido.headers().referer, undefined)
    await pagina.waitForURL(site + destino)
  }
  const email = 'rumocerto-qa-' + randomUUID() + '@example.com'
  const senha = 'Qa!1_' + randomUUID()
  const outraSenha = 'Qa!2_' + randomUUID()
  const registo = await abrir()
  await registo.goto(site + '#/registar')
  await registo.getByLabel('E-mail', { exact:true }).fill(email)
  await registo.getByLabel('Palavra-passe', { exact:true }).fill(senha)
  await registo.getByLabel('Confirmar palavra-passe').fill(senha)
  await registo.getByRole('button', { name:'Criar conta' }).click()
  await registo.getByText('Consulte a caixa de entrada', { exact:false }).waitFor()
  const confirmacao = await mensagemPara(mailpit, email)
  const primeira = await abrir()
  await abrirLigacao(primeira, confirmacao.url, 'email', '#/entrar')
  await primeira.getByText('Endereço de e-mail confirmado.').waitFor()
  assert.equal(new URL(primeira.url()).search, '')
  await primeira.getByRole('link', { name:'Continuar para a conta' }).click()
  await primeira.getByRole('link', { name:'Perfil profissional' }).click()
  await primeira.getByLabel('Nome', { exact:true }).fill('Pessoa de Teste')
  await primeira.getByLabel('Província', { exact:true }).selectOption('Sofala')
  await primeira.getByRole('button', { name:'Guardar perfil' }).click()
  await primeira.getByText('Perfil e preferências guardados.').waitFor()
  await primeira.goto(site + '#/plano')
  await primeira.locator('#area').selectOption('Tecnologia e engenharia')
  await primeira.locator('#situacao').selectOption('Estudante')
  await primeira.getByRole('button', { name:'Continuar' }).click()
  await primeira.locator('#objetivo').fill('Criar um portefólio digital para candidaturas em Moçambique')
  await primeira.getByRole('button', { name:'Continuar' }).click()
  await primeira.getByRole('button', { name:'Gerar plano' }).click()
  await primeira.getByRole('button', { name:'Guardar plano na conta' }).click()
  await primeira.getByText('Plano e progresso guardados na conta.').waitFor()
  await primeira.getByRole('link', { name:/Acompanhar actividades/ }).click()
  await primeira.getByRole('checkbox').first().check()
  await primeira.getByText('Plano e progresso guardados na conta.').waitFor()
  const perfilLegado = { area: 'Tecnologia e engenharia', situacao: 'Estudante',
    objetivo: 'Preparar um portefólio para um estágio em Moçambique',
    disponibilidade: '3 a 5 horas por semana', internet: 'Acesso limitado a dados móveis' }
  const planoLegado = { ...gerarPlano(perfilLegado), titulo: 'Plano legado de teste' }
  const idLegado = randomUUID()
  const rejeitado = await primeira.evaluate(async ({ perfil, plano }) => {
    const { rpc } = await import('/src/services/dados.js')
    try {
      await rpc('guardar_plano', { p_id: crypto.randomUUID(), p_plano: { titulo: plano.titulo, semanas: plano.semanas },
        p_perfil: perfil, p_concluidas: [] })
    } catch (erro) { return erro.code }
    return null
  }, { perfil: perfilLegado, plano: planoLegado })
  assert.equal(rejeitado, '22023')
  await primeira.evaluate(async ({ id, perfil, plano }) => {
    const { rpc } = await import('/src/services/dados.js')
    await rpc('guardar_plano', { p_id: id, p_plano: plano, p_perfil: perfil, p_concluidas: ['0-3', '3-4'] })
  }, { id: idLegado, perfil: perfilLegado, plano: planoLegado })
  await primeira.goto(site + '#/progresso?plano=' + idLegado)
  await primeira.locator('.progress-summary').getByText('2 de 20 tarefas concluídas').waitFor()
  await primeira.getByRole('button', { name: 'Converter para 30 tarefas' }).click()
  await primeira.getByRole('button', { name: 'Confirmar conversão' }).click()
  await primeira.locator('.progress-summary').getByText('2 de 30 tarefas concluídas').waitFor()
  await primeira.getByRole('button', { name: 'Guardar plano na conta' }).click()
  await primeira.getByText('Plano e progresso guardados na conta.').waitFor()
  const versoes = await primeira.evaluate(async id => {
    const { consultar } = await import('/src/services/dados.js')
    const linhas = await consultar(db => db.from('planos').select('id,dados').eq('titulo', 'Plano legado de teste'))
    return linhas.map(p => [p.id === id, p.dados.semanas.flatMap(s => s.tarefas).length]).sort((a, b) => a[1] - b[1])
  }, idLegado)
  assert.deepEqual(versoes, [[true, 20], [false, 30]])
  await registo.goto(site + '#/recuperar')
  await registo.getByLabel('E-mail', { exact:true }).fill(email)
  await registo.getByRole('button', { name:'Pedir ligação' }).click()
  await registo.getByText('Se o endereço estiver registado', { exact:false }).waitFor()
  const recuperacao = await mensagemPara(mailpit, email, confirmacao.id)
  const segunda = await abrir()
  await abrirLigacao(segunda, recuperacao.url, 'recovery', '#/redefinir-palavra-passe')
  await segunda.getByLabel('Palavra-passe', { exact:true }).fill(outraSenha)
  await segunda.getByLabel('Confirmar palavra-passe').fill(outraSenha)
  await segunda.getByRole('button', { name:'Definir palavra-passe' }).click()
  await segunda.getByText('Palavra-passe actualizada.').waitFor()
  await segunda.getByRole('button', { name:'Terminar sessão' }).click()
  await segunda.goto(site + '#/entrar')
  await segunda.getByLabel('E-mail', { exact:true }).fill(email)
  await segunda.getByLabel('Palavra-passe', { exact:true }).fill(outraSenha)
  await segunda.getByRole('button', { name:'Entrar', exact:true }).click()
  await segunda.getByRole('heading', { name:'Olá, Pessoa de Teste' }).waitFor()
  await segunda.getByRole('link', { name:/Plano de 30 dias/ }).click()
  await segunda.getByText('Plano da conta carregado.').waitFor()
  assert.match(await segunda.locator('.progress-summary').innerText(), /1 de 30/)
  await segunda.goto(site + '#/admin')
  await segunda.getByText('Esta área exige autorização administrativa.').waitFor()
  assert.deepEqual(erros, [])
})
