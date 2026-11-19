import { ligacaoHttps } from './oportunidades.js'

export const CONTACTOS_CV = [
  ['nome', 'Nome profissional', 'text', 90], ['cargo', 'Título profissional', 'text', 120],
  ['localidade', 'Localidade', 'text', 120], ['email', 'E-mail profissional', 'email', 254],
  ['telefone', 'Telefone profissional', 'tel', 36], ['portefolio', 'Ligação do portefólio', 'url', 500]
]
export const CONTEUDO_CV = [
  ['resumo', 'Resumo profissional', 'textarea', 1200], ['formacao', 'Formação académica', 'textarea', 2200],
  ['experiencia', 'Experiência profissional', 'textarea', 3200], ['competencias', 'Competências', 'textarea', 1400],
  ['certificacoes', 'Certificações', 'textarea', 1600], ['idiomas', 'Idiomas', 'textarea', 700],
  ['projectos', 'Projectos', 'textarea', 2400]
]
const campos = [...CONTACTOS_CV, ...CONTEUDO_CV]

export function normalizarCurriculo(dados = {}) {
  return Object.fromEntries(campos.map(([campo, , , maximo]) => [
    campo, typeof dados?.[campo] === 'string' ? dados[campo].replace(/[^\S\r\n]/g, ' ').trim().slice(0, maximo) : ''
  ]))
}
export function validarCurriculo(dados) {
  if (dados.nome.length < 2) return 'Indique o seu nome profissional.'
  if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return 'Indique um e-mail válido.'
  if (dados.telefone && (!/^\+?[0-9 ()-]{7,36}$/.test(dados.telefone) || dados.telefone.replace(/\D/g, '').length < 7)) return 'Indique um número de telefone válido.'
  if (dados.portefolio && !ligacaoHttps(dados.portefolio)) return 'Use uma ligação HTTPS para o portefólio.'
  return ''
}
