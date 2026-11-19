import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { chromium } from 'playwright-core'
import vue from '@vitejs/plugin-vue'
import { createServer } from 'vite'
import { gerarPlano } from '../shared/planner.js'

const projectUrl = 'https://supabase.example.test'
const utilizador = { id: '10000000-0000-4000-8000-000000000001', email: 'jovem@example.test',
  aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-11-19T09:00:00Z',
  app_metadata: {}, user_metadata: {} }
const [vaga] = JSON.parse(await readFile(new URL('../src/assets/dados/oportunidades.json', import.meta.url), 'utf8'))
vaga.id = '30000000-0000-4000-8000-000000000001'

async function iniciar(t, comConta, { catalogoVazio = false, admin = false } = {}) {
  const vite = await createServer({
    configFile: false, plugins: [vue()], base: '/rumocerto-mz/', server: { host: '127.0.0.1', hmr: false },
    define: {
      'import.meta.env.VITE_WORKER_URL': '""',
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(comConta ? projectUrl : ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(comConta ? 'sb_publishable_apenas_teste' : '')
    }
  })
  t.after(() => vite.close())
  await vite.listen()
  const url = vite.resolvedUrls.local[0]
  const browser = await chromium.launch(process.env.RUMOCERTO_CHROME ? { executablePath: process.env.RUMOCERTO_CHROME } : { channel: 'chrome' })
  t.after(() => browser.close())
  const pagina = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await pagina.clock.setFixedTime(new Date('2026-11-19T10:00:00Z'))
  pagina.setDefaultTimeout(12000)
  const erros = []
  let favoritado = false
  let alerta = null
  let fonte = null
  let auditoria = []
  pagina.on('pageerror', erro => erros.push(erro.message))
  const chamadas = []
  await pagina.route('**/*', async route => {
    const destino = new URL(route.request().url())
    const caminho = destino.pathname
    if (destino.origin === new URL(url).origin) return route.continue()
    if (destino.hostname === 'api.worldbank.org') return route.fulfill({
      json: [{ page: 1 }, [{ date: '2025', value: 11.61 }]], headers: { 'access-control-allow-origin': '*' }
    })
    if (destino.origin !== projectUrl || !comConta) return route.abort()
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const data = route.request().postDataJSON()
    const metodo = route.request().method()
    chamadas.push({ caminho, data, metodo })
    const jwtParte = x => Buffer.from(JSON.stringify(x)).toString('base64url')
    const sessao = { access_token: jwtParte({ alg:'HS256', typ:'JWT' }) + '.' +
      jwtParte({ sub: utilizador.id, exp: Math.floor(new Date('2026-11-19T10:00:00Z').getTime() / 1000) + 1800, role: 'authenticated' }) + '.fixture',
      refresh_token: 'fixture', token_type: 'bearer', expires_in: 1800, user: utilizador }
    let json = []
    if (caminho === '/auth/v1/token' || caminho === '/auth/v1/verify') json = sessao
    if (caminho === '/auth/v1/user') json = utilizador
    if (caminho.endsWith('/e_admin')) json = admin
    if (caminho.endsWith('/pesquisar_oportunidades')) json = catalogoVazio || (data?.p_tipo && data.p_tipo !== vaga.tipo) ? [] : [vaga]
    if (caminho.endsWith('/catalogo_oportunidades')) json = [vaga]
    if (caminho.endsWith('/perfis')) json = [{ nome: 'Lúcia João', area: vaga.area, competencias: vaga.competencias }]
    if (caminho.endsWith('/favoritos')) {
      if (metodo === 'POST') favoritado = true
      if (metodo === 'DELETE') favoritado = false
      json = favoritado ? [{ oportunidade_id: vaga.id }] : []
    }
    if (caminho.endsWith('/materializar_alertas')) alerta ??= { id: 1, titulo: 'Prazo de teste',
      tipo: 'prazo', oportunidade_id: vaga.id, criada_em: '2026-11-19T10:00:00Z', lida_em: null }
    if (caminho.endsWith('/marcar_notificacoes')) alerta.lida_em = '2026-11-19T10:05:00Z'
    if (caminho.endsWith('/notificacoes')) json = alerta ? [alerta] : []
    if (caminho.endsWith('/preferencias_comunicacao') && data) json = data
    if (caminho.endsWith('/relatorio_admin')) json = { publicadas: 0, estados: {}, fontes: fonte ? 1 : 0,
      notificacoes: 0, pedidos_eliminacao: 0, envios: {}, ultimas_falhas: [] }
    if (caminho.endsWith('/fontes')) {
      if (data) {
        fonte = { ...data, id: 'fonte-teste' }
        auditoria = [{ id: 1, entidade: 'fontes', acao: 'INSERT', operador: utilizador.id,
          criado_em: '2026-11-19T10:00:00Z', registo: fonte.id, estado: 'activa' }]
      }
      json = data ? { id: fonte.id } : (fonte ? [fonte] : [])
    }
    if (caminho.endsWith('/auditoria')) json = auditoria
    if (caminho.endsWith('/configuracao_alertas')) json = { internos: true, resumos: false }
    if (caminho.endsWith('/curriculos') && data) json = data
    if (caminho.endsWith('/candidaturas') && data) json = { id: 'fixture' }
    if (caminho.endsWith('/resumo_candidaturas')) json = {}
    if (caminho.endsWith('/guardar_perfil') || caminho.endsWith('/materializar_alertas') || caminho.endsWith('/logout')) {
      return route.fulfill({ status: 204, headers: cors })
    }
    return route.fulfill({ json, headers: cors })
  })
  return { pagina, url, erros, chamadas }
}

async function verificarPdf(pagina, texto, nome) {
  const pendente = pagina.waitForEvent('download')
  await pagina.getByRole('button', { name: texto }).click()
  const download = await pendente
  assert.equal(download.suggestedFilename(), nome)
  const caminho = await download.path()
  assert.equal((await readFile(caminho)).subarray(0, 8).toString(), '%PDF-1.4')
  if (process.env.RUMOCERTO_PDFS) await download.saveAs(process.env.RUMOCERTO_PDFS + '/' + nome)
}

test('Chrome móvel: navegação por hash, catálogo público, formulário, progresso e PDF', { timeout: 90000 }, async t => {
  const { pagina, url, erros } = await iniciar(t, false)
  await pagina.goto(url)
  const heading = pagina.getByRole('heading', { level: 1 })
  await heading.waitFor()
  assert.match(await heading.innerText(), /futuro profissional/)
  await pagina.keyboard.press('Tab')
  await pagina.keyboard.press('Enter')
  assert.equal(await pagina.evaluate(() => document.activeElement.id), 'conteudo')
  await pagina.getByRole('button', { name: 'Menu' }).click()
  await pagina.getByRole('navigation', { name: 'Navegação principal' }).getByText('Oportunidades').click()
  await pagina.getByRole('link', { name: 'Bolsas de mestrado JDS no Japão' }).waitFor()
  await pagina.getByText('Mais filtros').click()
  await pagina.getByLabel('Tipo de oportunidade').selectOption('Bolsa')
  await pagina.getByRole('button', { name: 'Pesquisar', exact: true }).click()
  await pagina.getByRole('link', { name: 'Bolsas de mestrado JDS no Japão' }).click()
  await heading.waitFor()
  assert.match(await heading.innerText(), /JDS/)
  assert.equal(await pagina.getByText('16:00 (Maputo)', { exact:false }).count(), 1)
  assert.ok(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await pagina.reload()
  await pagina.getByRole('heading', { name: 'Bolsas de mestrado JDS no Japão' }).waitFor()
  await pagina.goto(url + '#/plano')
  await pagina.getByRole('button', { name: 'Continuar' }).click()
  assert.equal(await pagina.locator('#area').getAttribute('aria-invalid'), 'true')
  await pagina.locator('#area').selectOption('Tecnologia e engenharia')
  await pagina.locator('#situacao').selectOption('Estudante')
  await pagina.getByRole('button', { name: 'Continuar' }).click()
  await pagina.locator('#objetivo').fill('Preparar um portefólio em Vue com projectos de Moçambique')
  await pagina.getByRole('button', { name: 'Continuar' }).click()
  await pagina.getByRole('button', { name: 'Gerar plano' }).click()
  await pagina.getByText('Plano criado.', { exact:false }).waitFor()
  await verificarPdf(pagina, /Descarregar PDF/, 'RumoCerto_MZ_Plano_30_Dias.pdf')
  await pagina.getByRole('link', { name: /Acompanhar actividades/ }).click()
  assert.match(await pagina.locator('.progress-summary').innerText(), /0 de 30/)
  await pagina.getByRole('checkbox').first().check()
  assert.match(await pagina.locator('.progress-summary').innerText(), /1 de 30/)
  await pagina.reload()
  assert.match(await pagina.locator('.progress-summary').innerText(), /1 de 30/)
  await pagina.goto(url + '#/conta/cv')
  await pagina.getByRole('heading', { name: 'Entrar', exact: true }).waitFor()
  await pagina.goto(url + '#/pagina-desconhecida')
  await pagina.getByRole('heading', { name: 'Esta página não existe.' }).waitFor()
  assert.deepEqual(erros, [])
})

test('Chrome: formulários privados com Supabase simulado e PDF de CV local', { timeout: 90000 }, async t => {
  const { pagina, url, erros, chamadas } = await iniciar(t, true)
  await pagina.goto(url + '#/conta/cv')
  await pagina.getByLabel('E-mail', { exact:true }).fill('jovem@example.test')
  await pagina.getByLabel('Palavra-passe', { exact:true }).fill('TesteSomente2026!')
  await pagina.getByRole('button', { name:'Entrar', exact:true }).click()
  await pagina.getByRole('heading', { name:'Criador de CV' }).waitFor()
  await pagina.getByLabel('Nome profissional').fill('Lúcia João')
  await pagina.getByLabel('Resumo profissional').fill('Formação e comunicação em Moçambique.')
  await pagina.getByRole('button', { name:'Guardar na conta' }).click()
  await pagina.getByText('Currículo guardado.', { exact:true }).waitFor()
  await verificarPdf(pagina, 'Descarregar PDF', 'RumoCerto_MZ_Curriculo.pdf')
  await pagina.goto(url + '#/conta/perfil')
  await pagina.getByLabel('Nome', { exact:true }).fill('Lúcia João')
  await pagina.getByLabel('Província', { exact:true }).selectOption('Sofala')
  await pagina.getByRole('button', { name:'Guardar perfil' }).click()
  await pagina.getByText('Perfil e preferências guardados.').waitFor()
  await pagina.goto(url + '#/conta/rumomatch')
  await pagina.getByText(/de 100 pontos/).waitFor()
  await pagina.getByText('Como foi calculado?').click()
  await pagina.getByText(/pontos possíveis/).first().waitFor()
  await pagina.goto(url + '#/oportunidades/' + vaga.id)
  await pagina.getByRole('button', { name: 'Guardar favorito' }).click()
  await pagina.getByRole('button', { name: 'Remover favorito' }).waitFor()
  await pagina.goto(url + '#/conta/favoritos')
  await pagina.getByRole('link', { name: vaga.titulo }).waitFor()
  await pagina.getByRole('button', { name: 'Remover favorito' }).click()
  await pagina.getByText('Ainda não existem resultados nesta página.').waitFor()
  await pagina.goto(url + '#/conta/notificacoes')
  await pagina.getByRole('button', { name: 'Actualizar alertas' }).click()
  await pagina.getByRole('heading', { name: 'Prazo de teste' }).waitFor()
  await pagina.getByRole('button', { name: 'Marcar como lida' }).click()
  await pagina.getByText('Prazo · Lida', { exact: true }).waitFor()
  await pagina.goto(url + '#/conta/definicoes')
  await pagina.getByLabel('Lembretes de tarefas').uncheck()
  await pagina.getByRole('button', { name: 'Guardar preferências' }).click()
  await pagina.getByText('Preferências guardadas.').waitFor()
  assert.equal(chamadas.find(c => c.caminho.endsWith('/preferencias_comunicacao') && c.data).data.tarefas, false)
  await pagina.goto(url + '#/conta/candidaturas')
  await pagina.getByRole('button', { name:'Nova candidatura' }).click()
  await pagina.getByLabel('Título', { exact:true }).fill('Estágio de teste')
  await pagina.getByLabel('Estado', { exact:true }).selectOption('enviada')
  await pagina.getByRole('button', { name:'Guardar candidatura' }).click()
  assert.ok(!chamadas.some(c => c.caminho.endsWith('/candidaturas') && c.data))
  await pagina.getByLabel('Confirmo que este estado corresponde ao que aconteceu.').check()
  await pagina.getByRole('button', { name:'Guardar candidatura' }).click()
  await pagina.getByText('Candidatura registada.', { exact:true }).waitFor()
  assert.equal(chamadas.find(c => c.caminho.endsWith('/candidaturas') && c.data).data.estado, 'enviada')
  await pagina.goto(url + '#/admin')
  await pagina.getByText('Esta área exige autorização administrativa.').waitFor()
  assert.deepEqual(erros, [])
})


test('Chrome: mantém o plano v3.6, permite cancelar e conserva o original após converter', { timeout: 90000 }, async t => {
  const { pagina, url, erros } = await iniciar(t, false)
  const perfil = { area: 'Tecnologia e engenharia', situacao: 'Estudante',
    objetivo: 'Preparar um portefólio em Vue com projectos de Moçambique',
    disponibilidade: '3 a 5 horas por semana', internet: 'Acesso limitado a dados móveis' }
  const legado = { perfil, perfilDoPlano: perfil, plano: gerarPlano(perfil), concluidas: ['0-3','3-4'] }
  const chave = 'rumocerto:v3:estado'
  await pagina.addInitScript(({ chave, legado }) => {
    if (!localStorage.getItem(chave)) localStorage.setItem(chave, JSON.stringify(legado))
  }, { chave, legado })
  await pagina.goto(url + '#/plano')
  await pagina.getByRole('button', { name: 'Continuar', exact: false }).click()
  await pagina.getByRole('button', { name: 'Continuar', exact: false }).click()
  await pagina.getByRole('button', { name: 'Gerar plano' }).click()
  await pagina.getByText('O plano anterior continua disponível', { exact:false }).waitFor()
  await pagina.getByRole('link', { name: /Acompanhar actividades/ }).click()
  const resumo = pagina.locator('.progress-summary')
  assert.match(await resumo.innerText(), /2 de 20/)
  await pagina.getByRole('button', { name: 'Converter para 30 tarefas' }).click()
  await pagina.getByRole('button', { name: 'Cancelar conversão' }).click()
  assert.match(await resumo.innerText(), /2 de 20/)
  await pagina.getByRole('button', { name: 'Converter para 30 tarefas' }).click()
  await pagina.getByRole('button', { name: 'Confirmar conversão' }).click()
  await resumo.getByText('2 de 30 tarefas concluídas').waitFor()
  await pagina.reload()
  await resumo.getByText('2 de 30 tarefas concluídas').waitFor()
  const guardado = await pagina.evaluate(chave => JSON.parse(localStorage.getItem(chave)), chave)
  assert.deepEqual(guardado.concluidas, ['0-4','3-7'])
  assert.deepEqual(guardado.historico[0].dados.concluidas, ['0-3','3-4'])
  await pagina.getByRole('button', { name: /20 tarefas/ }).click()
  await resumo.getByText('2 de 20 tarefas concluídas').waitFor()
  assert.deepEqual(erros, [])
})

test('Chrome: catálogo remoto vazio mantém pesquisa da cópia local e links antigos em leitura', { timeout: 90000 }, async t => {
  const { pagina, url, erros, chamadas } = await iniciar(t, true, { catalogoVazio: true })
  await pagina.goto(url + '#/entrar')
  await pagina.getByLabel('E-mail', { exact: true }).fill('jovem@example.test')
  await pagina.getByLabel('Palavra-passe', { exact: true }).fill('TesteSomente2026!')
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click()
  await pagina.waitForURL('**/#/conta')
  await pagina.goto(url + '#/oportunidades')
  await pagina.getByText('Nenhuma oportunidade verificada nesta página.').waitFor()
  await pagina.getByRole('button', { name: 'Consultar a cópia local' }).click()
  await pagina.getByRole('link', { name: 'Bolsas de mestrado JDS no Japão' }).waitFor()
  await pagina.getByRole('button', { name: 'Voltar ao catálogo da conta' }).click()
  await pagina.getByText('Nenhuma oportunidade verificada nesta página.').waitFor()
  await pagina.goto(url + '#/oportunidades/jds-mocambique-2027')
  await pagina.getByRole('heading', { name: 'Bolsas de mestrado JDS no Japão' }).waitFor()
  assert.equal(await pagina.getByRole('link', { name: /anúncio original/ }).count(), 1)
  assert.equal(await pagina.getByRole('button', { name: /favorito/i }).count(), 0)
  assert.equal(await pagina.getByRole('link', { name: 'Registar candidatura' }).count(), 0)
  assert.ok(!chamadas.some(c => c.caminho.endsWith('/favoritos') || c.caminho.endsWith('/catalogo_oportunidades')))
  assert.deepEqual(erros, [])
})

test('Chrome: operador vê relatórios, valida uma fonte e consulta auditoria', { timeout: 90000 }, async t => {
  const { pagina, url, erros, chamadas } = await iniciar(t, true, { admin: true })
  await pagina.goto(url + '#/admin')
  await pagina.getByLabel('E-mail', { exact: true }).fill('operador@example.test')
  await pagina.getByLabel('Palavra-passe', { exact: true }).fill('TesteSomente2026!')
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click()
  await pagina.getByRole('heading', { name: 'Administração' }).waitFor()
  await pagina.getByRole('button', { name: 'Fontes', exact: true }).click()
  await pagina.getByRole('button', { name: 'Nova fonte' }).click()
  await pagina.getByLabel('Nome da fonte').fill('Entidade de teste')
  await pagina.getByLabel('URL da fonte').fill('http://example.test/')
  await pagina.getByRole('button', { name: 'Guardar fonte' }).click()
  await pagina.getByText('Indique o nome e uma ligação HTTPS válida.').waitFor()
  assert.ok(!chamadas.some(c => c.caminho.endsWith('/fontes') && c.data))
  await pagina.getByLabel('URL da fonte').fill('https://example.test/')
  await pagina.getByLabel('Confirmei a entidade responsável e a página oficial.').check()
  await pagina.getByRole('button', { name: 'Guardar fonte' }).click()
  await pagina.getByText('Fonte guardada.').waitFor()
  assert.ok(chamadas.find(c => c.caminho.endsWith('/fontes') && c.data).data.verificada_em)
  await pagina.getByRole('button', { name: 'Auditoria', exact: true }).click()
  await pagina.getByText('fontes · INSERT').waitFor()
  await pagina.getByRole('button', { name: 'Serviços e relatórios' }).click()
  await pagina.getByRole('heading', { name: 'Resumo agregado' }).waitFor()
  await pagina.getByText('URL por configurar').waitFor()
  assert.deepEqual(erros, [])
})

test('Chrome: limpa credenciais novas e antigas antes de chamar o Auth', { timeout: 90000 }, async t => {
  const { pagina, url, erros, chamadas } = await iniciar(t, true)
  for (const separador of ['#', '?']) {
    const pedido = pagina.waitForRequest(r => new URL(r.url()).pathname === '/auth/v1/verify')
    await pagina.goto(url + separador + 'token_hash=fixture&' + 'type=email')
    await pedido
    assert.equal(pagina.url(), url + '#/entrar')
    await pagina.getByText('Endereço de e-mail confirmado.').waitFor()
  }
  assert.equal(chamadas.filter(c => c.caminho === '/auth/v1/verify').length, 2)
  assert.deepEqual(erros, [])
})
