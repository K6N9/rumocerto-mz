import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { calcularCorrespondencia, ordenarCorrespondencias } from '../shared/rumomatch.js'
import { dividirLista, filtrarOportunidadesLocais, filtrosCatalogo, ligacaoHttps } from '../shared/oportunidades.js'
import { normalizarCurriculo, validarCurriculo } from '../shared/curriculo.js'
import { gerarPdfCurriculo } from '../shared/pdf.js'
import { gerarPlanoDiario, diaDaTarefa, AREAS, DISPONIBILIDADES, SITUACOES, INTERNET } from '../shared/planner.js'
import { normalizarEstadoSalvo } from '../shared/persistencia.js'
import { avaliarAcesso, destinoSeguro } from '../src/router/acesso.js'
import { executarAlertas } from '../backend/alertas.js'

const oportunidade = { titulo:'Estágio', area:'Tecnologia', escolaridade: 4, competencias: ['JavaScript'],
  experiencia_meses: 2, provincia: 'Maputo', modalidade: 'Híbrido', tipo: 'Estágio',
  competencias_obrigatorias: ['Comunicação'], requisitos: ['Consultar o anúncio'] }
const perfil = { area:'tecnologia', escolaridade: 4, competencias:['JavaScript', 'comunicacao'],
  experiencia_meses: 3, provincia: 'Maputo' }
const preferencias = { modalidades:['Híbrido'], tipos:['Estágio'] }

test('RumoMatch explica lacunas, trata acentos e veta requisito obrigatório em falta', () => {
  assert.equal(calcularCorrespondencia(perfil, preferencias, oportunidade).pontuacao, 100)
  const semCompetencias = calcularCorrespondencia({ ...perfil, competencias: [] }, preferencias, oportunidade)
  assert.equal(semCompetencias.aptaParaAlerta, false)
  assert.equal(semCompetencias.criterios.at(-1).estado, 'por confirmar')
  const experiencia = calcularCorrespondencia({ ...perfil, experiencia_meses: 0 }, preferencias, oportunidade)
  assert.equal(experiencia.criterios.find(c => c.nome === 'Experiência').estado, 'incompatível')
  assert.equal(experiencia.aptaParaAlerta, false)
  assert.equal(ordenarCorrespondencias(perfil, preferencias, [{ ...oportunidade, titulo:'A', escolaridade:5 }, oportunidade])[0].oportunidade.titulo, 'Estágio')
})

test('filtros preservam zero e URLs externas rejeitam esquemas e credenciais', () => {
  assert.deepEqual(filtrosCatalogo({ texto:'  formação  ', experiencia:0, prazo:0, modalidade:'', escolaridade:8 }),
    { p_texto:'formação', p_experiencia:0, p_prazo:0 })
  assert.equal(ligacaoHttps('https://example.org'), 'https://example.org/')
  assert.equal(ligacaoHttps('javascript:alert(1)'), '')
  assert.equal(ligacaoHttps('https://utilizador:senha@example.org'), '')
  assert.deepEqual(dividirLista('JavaScript, JavaScript\nPortuguês'), ['JavaScript', 'Português'])
})

test('catálogo local filtra tipo, prazo com hora e verificações caducadas', async () => {
  const lista = JSON.parse(await readFile(new URL('../src/assets/dados/oportunidades.json', import.meta.url), 'utf8'))
  assert.equal(filtrarOportunidadesLocais(lista, {}, new Date('2026-11-19T14:00:00Z')).length, 3)
  assert.equal(filtrarOportunidadesLocais(lista, { tipo:'Bolsa' }, new Date('2026-12-15T13:59:59Z')).length, 1)
  assert.equal(filtrarOportunidadesLocais(lista, { tipo:'Bolsa' }, new Date('2026-12-15T14:00:00Z')).length, 0)
  assert.equal(filtrarOportunidadesLocais(lista, {}, new Date('2026-12-31T07:00:00Z')).length, 0)
})

test('plano v4 cobre os 30 dias e mantém tempo e progresso válido', () => {
  const dados = { area:AREAS[0], situacao:SITUACOES[0], disponibilidade:DISPONIBILIDADES[1], internet:INTERNET[0],
    objetivo:'Melhorar JavaScript e preparar um portefólio em Vue' }
  const plano = gerarPlanoDiario(dados)
  assert.deepEqual(plano.semanas.flatMap(s => s.tarefas.map((_, i) => diaDaTarefa(s,i))), Array.from({length:30}, (_, i) => i + 1))
  assert.ok(plano.semanas.every(s => s.tarefas.every(Boolean) && s.minutosPorTarefa.reduce((a,b) => a+b,0) === 240))
  assert.deepEqual(normalizarEstadoSalvo({ perfil:dados, plano, concluidas:['3-8','3-9'] }).concluidas, ['3-8'])
})

test('CV valida contactos e PDF conserva acentos e usa mais de uma página quando necessário', () => {
  const dados = normalizarCurriculo({ nome:'Lúcia João', resumo:'Formação e comunicação em Moçambique.',
    experiencia:'Acompanhamento e gestão de projectos.\n'.repeat(80), portefolio:'https://example.test' })
  assert.equal(validarCurriculo(dados), '')
  assert.notEqual(validarCurriculo({ ...dados, telefone:'000' }), '')
  const pdf = new TextDecoder('latin1').decode(gerarPdfCurriculo(dados))
  assert.match(pdf, /^%PDF-1.4/)
  assert.match(pdf, /Lúcia João/)
  assert.match(pdf, /Formação e comunicação em Moçambique/)
  assert.match(pdf, /\/Count [2-9]/)
})

test('rotas privadas recusam sessões ausentes e admin depende de verificação no servidor', async () => {
  const rota = { fullPath:'/admin', meta:{ privada:true, admin:true } }
  const deps = { iniciar: async () => {}, sessao: () => null, admin: async () => false }
  assert.equal(await avaliarAcesso({ meta:{} }, deps), true)
  assert.deepEqual(await avaliarAcesso(rota, deps), { name:'entrar', query:{ destino:'/admin' } })
  deps.sessao = () => ({ id:'jovem' })
  assert.equal((await avaliarAcesso(rota, deps)).query.motivo, 'restrito')
  deps.admin = async () => { throw new Error('Rede') }
  assert.equal((await avaliarAcesso(rota, deps)).query.motivo, 'indisponivel')
  deps.admin = async () => true
  assert.equal(await avaliarAcesso(rota, deps), true)
  assert.equal(destinoSeguro('//example.test'), '/conta')
  assert.equal(destinoSeguro('/conta/cv'), '/conta/cv')
})

test('alertas são desactivados por omissão e falhas de rede não simulam aceitação', async t => {
  const chamadas = []
  t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    const caminho = new URL(url).pathname
    chamadas.push({ caminho, opcoes })
    if (caminho.endsWith('/configuracao_alertas')) return Response.json([{ internos:false, resumos:true }])
    if (caminho.endsWith('/criar_resumos')) return new Response(null, { status:204 })
    if (caminho.endsWith('/reservar_resumo')) return Response.json(['60000000-0000-4000-8000-000000000001'])
    if (caminho.endsWith('/dados_resumo')) return Response.json([{ email:'teste@example.test', total:2 }])
    if (caminho.endsWith('/email/send')) throw new TypeError('Ligação interrompida')
    return new Response(null, { status:204 })
  })
  await executarAlertas({})
  assert.equal(chamadas.length, 0)
  await executarAlertas({ ALERTAS_AGENDADOS:'true', SUPABASE_URL:'https://dados.example.test', SUPABASE_SERVICE_ROLE_KEY:'sb_secret_apenas_teste',
    RESUMOS_EMAIL:'true', EMAILJS_SERVICE_ID:'teste', EMAILJS_PUBLIC_KEY:'teste', EMAILJS_TEMPLATE_RESUMO:'teste',
    EMAILJS_RESUMO_LIMITE_DIA:'3', PUBLIC_APP_URL:'https://app.example.test/rumocerto/' }, Date.parse('2026-11-23T07:00:00Z'))
  assert.equal(chamadas.filter(c => c.caminho.endsWith('/email/send')).length, 1)
  assert.deepEqual(JSON.parse(chamadas.at(-1).opcoes.body), { estado:'incerto', motivo:'rede' })
  const params = JSON.parse(chamadas.find(c => c.caminho.endsWith('/email/send')).opcoes.body).template_params
  assert.equal(params.link_preferencias, 'https://app.example.test/rumocerto/#/conta/definicoes')
  assert.ok(chamadas.some(c => c.caminho.endsWith('/criar_resumos')))
})
