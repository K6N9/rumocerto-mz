import test from 'node:test'
import assert from 'node:assert/strict'
import { gerarPlano, validarPerfil, calcularProgresso, AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from '../shared/planner.js'
import { gerarPdf } from '../shared/pdf.js'
import { indicadores, normalizarSerieBancoMundial, criarCSV, formatarTaxa } from '../shared/indicadores.js'

const perfil = () => ({
  nome: 'Ana', area: AREAS[0], situacao: SITUACOES[0],
  objetivo: 'Aprender Vue e publicar um pequeno projecto funcional',
  disponibilidade: DISPONIBILIDADES[1], internet: INTERNET[0],
  competencias: 'JavaScript básico', dificuldade: 'Internet limitada', usarIA: false
})

test('valida perfil completo', () => assert.deepEqual(validarPerfil(perfil()), {}))
test('rejeita area desconhecida', () => assert.ok(validarPerfil({ ...perfil(), area: 'Desconhecida' }).area))
test('rejeita objectivo curto', () => assert.ok(validarPerfil({ ...perfil(), objetivo: 'Oi' }).objetivo))
test('rejeita objectivo extenso', () => assert.ok(validarPerfil({ ...perfil(), objetivo: 'x'.repeat(451) }).objetivo))
test('rejeita campos ausentes', () => assert.ok(Object.keys(validarPerfil({})).length > 1))
test('verifica consentimento para e-mail', () => assert.ok(validarPerfil({ ...perfil(), email: 'a@b.com' }, { exigirEmail: true }).consentimento))
test('verifica formato de e-mail', () => assert.ok(validarPerfil({ ...perfil(), email: 'sem-arroba', consentimento: true }, { exigirEmail: true }).email))
test('aceita e-mail e consentimento correctos', () => assert.deepEqual(validarPerfil({ ...perfil(), email: 'ana@exemplo.com', consentimento: true }, { exigirEmail: true }), {}))
test('rejeita honeypot preenchido', () => assert.ok(validarPerfil({ ...perfil(), email: 'ana@exemplo.com', consentimento: true, website: 'bot' }, { exigirEmail: true }).geral))
test('plano possui quatro semanas', () => assert.equal(gerarPlano(perfil()).semanas.length, 4))
test('cada semana possui tarefas e resultado', () => assert.ok(gerarPlano(perfil()).semanas.every(x => x.tarefas.length === 5 && x.entregavel)))
test('personaliza percurso Vue.js', () => assert.ok(gerarPlano(perfil()).semanas.flatMap(x => x.tarefas).some(x => /componente Vue 3/.test(x))))
test('adapta acesso limitado', () => assert.match(gerarPlano(perfil()).estrategia, /offline/))
test('diferencia areas', () => assert.notDeepEqual(gerarPlano(perfil()).semanas[1].tarefas, gerarPlano({ ...perfil(), area: AREAS[1] }).semanas[1].tarefas))
test('minutos de cada tarefa somam exactamente ao tempo semanal definido', () => {
  for (const [i, tempo] of [90, 240, 450, 660].entries()) {
    const plano = gerarPlano({ ...perfil(), disponibilidade: DISPONIBILIDADES[i] })
    assert.ok(plano.semanas.every(s => s.minutosSugeridos === tempo && s.minutosPorTarefa.reduce((a,b)=>a+b,0)===tempo))
  }
})
test('progresso começa em zero', () => assert.equal(calcularProgresso(gerarPlano(perfil()), []).percentagem, 0))
test('progresso contabiliza tarefas validas uma vez', () => {
  const x = calcularProgresso(gerarPlano(perfil()), ['0-0', '0-0', '1-2', '9-9'])
  assert.equal(x.feitas, 2)
  assert.equal(x.total, 20)
  assert.equal(x.percentagem, 10)
})
test('progresso completo atinge cem', () => {
  const marcas = Array.from({ length: 20 }, (_, i) => `${Math.floor(i / 5)}-${i % 5}`)
  assert.equal(calcularProgresso(gerarPlano(perfil()), marcas).percentagem, 100)
})
test('PDF gerado tem cabecalho valido', () => {
  const resultado = gerarPdf(perfil(), gerarPlano(perfil()))
  assert.equal(new TextDecoder('latin1').decode(resultado.slice(0, 8)), '%PDF-1.4')
  assert.ok(resultado.length > 5000)
})
test('PDF preserva caracteres portugueses precompostos', () => {
  const p = { ...perfil(), objetivo: 'Organização, criação de páginas e aplicações para jovens em Moçambique' }
  const pdf = gerarPdf(p, gerarPlano(p))
  const texto = new TextDecoder('latin1').decode(pdf)
  assert.match(texto, /Área: Tecnologia e engenharia/)
  assert.match(texto, /Diagnóstico e estratégia/)
  assert.match(texto, /Situação: Estudante/)
})
test('PDF rejeita plano vazio', () => assert.throws(() => gerarPdf(perfil(), {})))
test('define tres series de Mocambique', () => assert.equal(indicadores.length, 3))
test('normaliza resposta da API por ano', () => {
  const entrada = [{ page: 1 }, [{ date: '2024', value: 12.8 }, { date: '2023', value: 13.2 }, { date: '2022', value: null }]]
  const x = normalizarSerieBancoMundial(entrada)
  assert.deepEqual(x.map(i => i.ano), [2023, 2024])
})
test('resposta malformada da API gera erro controlado', () => assert.throws(() => normalizarSerieBancoMundial({ message: [] }), /Formato inesperado/))
test('CSV preserva cabecalhos e anos', () => assert.match(criarCSV([{ ano: 2024, valor: 11.6 }]), /2024/))
test('formata taxa com percentagem', () => assert.match(formatarTaxa(11.6), /%/))

test('preserva valor monetário e sinal de tarefa como texto legível no PDF', () => {
  const p = { ...perfil(), objetivo: 'Preparar CV com 50€ de orçamento e tarefas ✓ para candidatura' }
  const pdf = new TextDecoder('latin1').decode(gerarPdf(p, gerarPlano(p)))
  assert.match(pdf, /50[\x80\u20AC]/)
  assert.match(pdf, /\[concluído\]/)
})
test('recupera plano especializado de redes informáticas', () => {
  const p = { ...perfil(), objetivo: 'Aprender redes e configurar uma VLAN para simulação' }
  const resultado = gerarPlano(p)
  assert.ok(resultado.semanas.flatMap(s=>s.tarefas).some(t=>/rede|IPv4|topologia|simula/i.test(t)))
})
test('recupera plano especializado de preparação para entrevistas', () => {
  const p = { ...perfil(), objetivo: 'Preparar uma entrevista de emprego com exercícios práticos' }
  const resultado = gerarPlano(p)
  assert.ok(resultado.semanas.flatMap(s=>s.tarefas).some(t=>/simulad|entrevista/i.test(t)))
})

test('gerador de PDF Unicode incorpora mapa de caracteres e fonte TrueType quando disponível', async t => {
  const { existsSync, readFileSync } = await import('node:fs')
  const caminho = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf'].find(existsSync)
  if (!caminho) { t.skip('Fonte TrueType de teste não instalada neste sistema'); return }
  const p = { ...perfil(), objetivo: 'Preparar CV com 50€, marca ✓ e saudação Привет.' }
  const { gerarPdfUnicode } = await import('../shared/pdf.js')
  const bytes = await gerarPdfUnicode(p, gerarPlano(p), { fonteBytes: readFileSync(caminho) })
  const texto = new TextDecoder('latin1').decode(bytes)
  assert.match(texto, /\/Subtype \/Type0/)
  assert.match(texto, /\/ToUnicode/)
  assert.match(texto, /<20ac>/i)
  assert.match(texto, /<041f>/i)
  assert.ok(bytes.byteLength > 100000)
})

test('caracteres sem glifo aparecem identificados sem perder o ponto Unicode', async () => {
  const { textoFonte } = await import('../shared/fonteUnicode.js')
  const mock = { glifo: cp => cp >= 32 && cp < 127 ? 1 : 0 }
  assert.equal(textoFonte('CV 📌', mock), 'CV [U+1F4CC]')
})
