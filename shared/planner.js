import { planoValido } from './contratoPlano.js'
import { escolherPerfil } from './perfis.js'
export const AREAS = ['Tecnologia e engenharia','Administração e gestão','Educação','Saúde','Comunicação e artes','Comércio e empreendedorismo','Outra área']
export const SITUACOES = ['Estudante','Recém-formado(a)','À procura do primeiro emprego','Trabalho e estudo','Outra situação']
export const DISPONIBILIDADES = ['Até 2 horas por semana','3 a 5 horas por semana','6 a 10 horas por semana','Mais de 10 horas por semana']
export const INTERNET = ['Acesso limitado a dados móveis','Internet razoável','Internet frequente']
export function limparTexto(v, max = 450) { return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g,' ').trim().slice(0,max) }
export function validarPerfil(p, { exigirEmail = false } = {}) {
  const e = {}
  if (!p || typeof p !== 'object') return { geral: 'Preencha os campos obrigatórios do formulário.' }
  if (!AREAS.includes(p.area)) e.area = 'Seleccione a área profissional.'
  if (!SITUACOES.includes(p.situacao)) e.situacao = 'Seleccione a situação actual.'
  if (!DISPONIBILIDADES.includes(p.disponibilidade)) e.disponibilidade = 'Seleccione a disponibilidade semanal.'
  if (!INTERNET.includes(p.internet)) e.internet = 'Seleccione a condição de acesso à Internet.'
  const objetivo = limparTexto(p.objetivo)
  if (objetivo.length < 12 || String(p.objetivo || '').length > 450) e.objetivo = 'Descreva um objectivo entre 12 e 450 caracteres.'
  if (String(p.competencias || '').length > 300) e.competencias = 'Limite de 300 caracteres.'
  if (String(p.dificuldade || '').length > 450) e.dificuldade = 'Limite de 450 caracteres.'
  if (String(p.nome || '').length > 90) e.nome = 'Limite de 90 caracteres.'
  if (exigirEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email || '')) || String(p.email || '').length > 150) e.email = 'Introduza um endereço de e-mail válido.'
    if (p.consentimento !== true) e.consentimento = 'É necessário autorizar o tratamento dos dados para envio por e-mail.'
    if (p.website) e.geral = 'Pedido inválido.'
  }
  return e
}
const basePorArea = {
  'Tecnologia e engenharia': ['Rever um conceito técnico essencial e resolver dois exercícios','Construir um pequeno exemplo prático e guardar o código','Documentar um projecto para o portefólio','Preparar uma explicação de três minutos do projecto'],
  'Administração e gestão': ['Identificar e mapear um processo simples','Criar uma folha de cálculo com metas e custos','Propor uma melhoria mensurável no processo','Preparar uma apresentação curta com resultados'],
  'Educação': ['Definir uma competência a ensinar','Preparar um plano de aula de vinte minutos','Criar um material de apoio reutilizável','Ensaiar a explicação e recolher feedback'],
  'Saúde': ['Pesquisar informação de literacia em saúde em fontes oficiais','Resumir orientações educativas sem aconselhamento clínico','Preparar um folheto informativo compreensível','Pedir revisão do material a um orientador qualificado'],
  'Comunicação e artes': ['Definir público, mensagem e suporte','Criar duas propostas visuais e compará-las','Produzir uma peça curta para portefólio','Rever a peça após comentários de um colega'],
  'Comércio e empreendedorismo': ['Definir um problema real de um cliente','Estimar custos de uma solução simples','Preparar um protótipo ou proposta de valor','Pedir feedback e rever preços e argumentos'],
  'Outra área': ['Identificar três competências exigidas na área','Encontrar recursos gratuitos e seleccionar dois','Realizar um exercício prático demonstrável','Preparar um portefólio ou resumo de aprendizagem']
}
const titulos = ['Definir o ponto de partida','Aprender e praticar','Criar uma evidência','Rever e avançar']
const focos = ['Objectivo e competências prioritárias','Prática orientada e consistência','Aplicação do conhecimento num resultado visível','Revisão e preparação da etapa seguinte']
const entregaveis = ['Lista de três micro-objectivos','Registo de exercícios e aprendizagens','Peça prática ou demonstração documentada','Resumo de resultados e próxima meta']
export function gerarPlano(p, options = {}) {
  const erros = validarPerfil(p)
  if (Object.keys(erros).length) throw new Error(Object.values(erros)[0])
  const objetivo = limparTexto(p.objetivo)
  const dificuldades = limparTexto(p.dificuldade, 250)
  const competencias = limparTexto(p.competencias, 250)
  const minutosSemanais = [90, 240, 450, 660][DISPONIBILIDADES.indexOf(p.disponibilidade)]
  const tempos = [0.22, 0.22, 0.22, 0.17].map(peso => 5 * Math.round(minutosSemanais * peso / 5))
  tempos.push(minutosSemanais - tempos.reduce((s, m) => s + m, 0))
  const modoOffline = p.internet === INTERNET[0]
  const base = basePorArea[p.area] || basePorArea['Outra área']
  const rotinas = [
    'Reservar uma sessão curta para executar a tarefa principal.',
    modoOffline ? 'Guardar materiais leves para consultar sem dados móveis.' : 'Consultar uma fonte gratuita e registar notas úteis.',
    'Registar o resultado num ficheiro ou caderno para acompanhar a evolução.'
  ]
  const especialista = escolherPerfil(p)
  const vue = /\bvue(?:\.js)?\b/i.test(objetivo) && p.area === 'Tecnologia e engenharia'
  const tarefasVue = [
    ['Rever JavaScript: funções, eventos e arrays','Criar o primeiro componente Vue 3 com <script setup>','Experimentar v-model e v-for num formulário'],
    ['Separar uma interface em três componentes','Passar dados por props e emitir um evento','Validar um formulário e mostrar mensagens acessíveis'],
    ['Criar duas rotas com Vue Router','Consultar uma API pública com tratamento de erro','Publicar um mini-projecto e escrever um README'],
    ['Testar os caminhos principais e o layout móvel','Pedir feedback e corrigir duas dificuldades','Preparar uma demonstração de três minutos']
  ]
  const semanas = Array.from({length:4},(_,i)=>({
    numero:i+1, titulo:titulos[i], foco:focos[i],
    tarefas:[i===0?`Dividir a meta «${objetivo}» em três resultados pequenos.`:vue?tarefasVue[i][0]:base[i],
      vue?tarefasVue[i][i===0?1:1]: i===0?(competencias?`Identificar lacunas a partir das competências: ${competencias}.`:'Identificar os pontos fortes e as competências a melhorar.'):base[(i+1)%4],
      vue?tarefasVue[i][2]:(i===0&&dificuldades?`Propor uma solução para a dificuldade: ${dificuldades}.`:rotinas[1]),
      rotinas[0],rotinas[2]],
    minutosSugeridos: minutosSemanais,
    minutosPorTarefa: [...tempos],
    entregavel:entregaveis[i],
    indicador: i===0?'Três resultados definidos':i===1?'Dois exercícios concluídos':i===2?'Uma evidência produzida':'Uma revisão e uma próxima meta registadas'
  }))
  if (especialista) {
    for (const [i, semana] of semanas.entries()) {
      semana.titulo = titulos[i]
      semana.foco = especialista.focos[i]
      semana.tarefas = [...especialista.tarefas[i], rotinas[2]]
      semana.entregavel = especialista.entregaveis[i]
    }
  }
  return {
    versao:4, titulo:`Plano de 30 dias — ${especialista?.nome || p.area}`, metodo:'Plano de desenvolvimento profissional', criadoEm:options.criadoEm || new Date().toISOString(),
    diagnostico:`Objectivo: ${objetivo.replace(/[.!?]+$/, '')}. Situação actual: ${p.situacao}. Disponibilidade: ${p.disponibilidade.toLowerCase()}.`,
    estrategia: modoOffline ? 'O plano prioriza sessões curtas e materiais que podem ser guardados para consulta offline.' : 'O plano combina prática, evidências verificáveis e revisão semanal.',
    semanas,
    recursos:[...(especialista?.recursos || []), 'Seleccionar materiais de acesso livre e registar a origem de cada recurso.', 'Registar os resultados semanais e solicitar uma avaliação quando possível.'],
    avisos:['Este plano é educativo; não garante emprego, estágio ou colocação profissional.','Os indicadores nacionais do Banco Mundial não representam previsões individuais.']
  }
}
export function calcularProgresso(plano, marcadas=[]) {
  const total = plano?.semanas?.reduce((n,s)=>n+s.tarefas.length,0) || 0
  const validas = new Set(marcadas.filter(i=>/^\d-\d$/.test(String(i))))
  const feitas = [...validas].filter(k=>{const [s,t]=k.split('-').map(Number);return s>=0&&s<4&&t>=0&&t<(plano?.semanas?.[s]?.tarefas?.length||0)}).length
  return {total, feitas, percentagem: total?Math.round(feitas/total*100):0}
}

const REVISOES = [
  'Rever as notas das actividades anteriores e anotar uma questão para consultar.',
  'Escolher um resultado desta semana e escrever como poderá ser demonstrado.',
  'Organizar os ficheiros de trabalho e verificar se consegue abrir as evidências guardadas.',
  'Comparar o resultado com o objectivo e anotar um ajuste concreto para a próxima sessão.'
]

const diasDaSemana = numero => numero === 4 ? 9 : 7

export function podeConverterPlano(plano) {
  return planoValido(plano) && plano.semanas.every(semana => semana.tarefas.length === 5)
}

function distribuirPlanoDiario(plano) {
  const correspondencias = new Map()
  const semanas = plano.semanas.map(semana => {
    const dias = diasDaSemana(semana.numero)
    const numero = semana.tarefas.length
    const tarefas = []
    const tempos = []
    const posicoesRevisao = []
    const totalCoerente = semana.minutosPorTarefa.reduce((total, minutos) => total + minutos, 0) === semana.minutosSugeridos
    let indice = 0
    for (let dia = 0; dia < dias; dia++) {
      if (indice < numero && dia === Math.floor(indice * dias / numero)) {
        tarefas.push(semana.tarefas[indice])
        const minutos = semana.minutosPorTarefa[indice]
        tempos.push(totalCoerente ? Math.floor(minutos * 0.8) : minutos)
        const prefixo = semana.numero - 1
        correspondencias.set(`${prefixo}-${indice}`, `${prefixo}-${dia}`)
        indice++
      } else {
        tarefas.push(REVISOES[posicoesRevisao.length])
        posicoesRevisao.push(dia)
        tempos.push(0)
      }
    }
    if (totalCoerente) {
      const restantes = semana.minutosSugeridos - tempos.reduce((total, minutos) => total + minutos, 0)
      const extra = posicoesRevisao.length
      posicoesRevisao.forEach((dia, index) => {
        tempos[dia] = Math.floor(restantes / extra) + (index < restantes % extra ? 1 : 0)
      })
    }
    return { ...semana, tarefas, minutosPorTarefa: tempos }
  })
  return { plano: { ...plano, semanas }, correspondencias }
}

export function gerarPlanoDiario(perfil, opcoes) {
  return distribuirPlanoDiario(gerarPlano(perfil, opcoes)).plano
}

export function converterPlanoDiario(plano, concluidas) {
  if (!podeConverterPlano(plano)) return null
  const { plano: novo, correspondencias } = distribuirPlanoDiario(plano)
  novo.criadoEm = new Date().toISOString()
  const marcadas = [...new Set(concluidas)].flatMap(chave =>
    correspondencias.has(chave) ? [correspondencias.get(chave)] : [])
  return { plano: novo, concluidas: marcadas }
}

export function diaDaTarefa(semana, indice) {
  const dias = diasDaSemana(semana.numero)
  return (semana.numero - 1) * 7 + 1 + Math.floor(indice * dias / semana.tarefas.length)
}
