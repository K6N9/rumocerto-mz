import { planoValido } from './contratoPlano.js'
export { planoValido } from './contratoPlano.js'
import { assinaturaPerfil } from './estado.js'
import { AREAS, SITUACOES, DISPONIBILIDADES, INTERNET } from './planner.js'

export const PERFIL_INICIAL = {
  nome: '', area: '', situacao: '', objetivo: '', disponibilidade: DISPONIBILIDADES[1],
  internet: INTERNET[0], competencias: '', dificuldade: '', usarIA: false
}

const LIMITE = { nome: 90, objetivo: 450, competencias: 300, dificuldade: 450 }
const LISTAS = { area: AREAS, situacao: SITUACOES, disponibilidade: DISPONIBILIDADES, internet: INTERNET }

export function normalizarPerfil(valor) {
  const origem = valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : {}
  const perfil = { ...PERFIL_INICIAL }
  for (const [campo, padrao] of Object.entries(PERFIL_INICIAL)) {
    const v = origem[campo]
    if (campo === 'usarIA') perfil[campo] = v === true
    else if (typeof v !== 'string') perfil[campo] = padrao
    else if (LISTAS[campo]) perfil[campo] = LISTAS[campo].includes(v) ? v : padrao
    else perfil[campo] = v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, LIMITE[campo] || 450)
  }
  return perfil
}

export function estadoInicial() {
  return { perfil: { ...PERFIL_INICIAL }, plano: null, perfilDoPlano: null, concluidas: [], assinatura: '' }
}

export function normalizarEstadoSalvo(salvo) {
  if (!salvo || typeof salvo !== 'object' || Array.isArray(salvo)) return estadoInicial()
  const perfil = normalizarPerfil(salvo.perfil)
  const plano = planoValido(salvo.plano) ? salvo.plano : null
  if (!plano) return { ...estadoInicial(), perfil }
  const perfilDoPlano = normalizarPerfil(salvo.perfilDoPlano || perfil)
  const concluidas = Array.isArray(salvo.concluidas) ? [...new Set(salvo.concluidas.filter(chave => {
    if (typeof chave !== 'string' || !/^[0-3]-\d$/.test(chave)) return false
    const [semana, tarefa] = chave.split('-').map(Number)
    return tarefa < plano.semanas[semana].tarefas.length
  }))] : []
  return {
    perfil, plano, perfilDoPlano, concluidas,
    assinatura: assinaturaPerfil(perfilDoPlano)
  }
}
