export const TIPOS = ['Emprego', 'Estágio', 'Bolsa', 'Formação', 'Programa de desenvolvimento']
export const MODALIDADES = ['Presencial', 'Remoto', 'Híbrido']
export const PROVINCIAS = ['Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo Cidade', 'Maputo Província', 'Nampula', 'Niassa', 'Sofala', 'Tete', 'Zambézia']
export const ESCOLARIDADES = ['Ensino primário', 'Ensino básico', 'Ensino secundário', 'Ensino técnico-profissional', 'Ensino superior']
export const ESTADOS_CANDIDATURA = {
  guardada: 'Guardada', em_preparacao: 'Em preparação', enviada: 'Candidatura enviada',
  em_analise: 'Em análise', entrevista: 'Entrevista', seleccionado: 'Seleccionado',
  nao_seleccionado: 'Não seleccionado', arquivada: 'Arquivada'
}

export const dataMaputo = (data = new Date()) => new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Maputo'
}).format(data)
export const dataLegivel = data => data ? new Intl.DateTimeFormat('pt-MZ', {
  dateStyle: 'medium', timeZone: 'Africa/Maputo'
}).format(new Date(data)) : 'Por indicar'

export function ligacaoHttps(valor) {
  try {
    const url = new URL(valor)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export function dividirLista(texto, limite = 25) {
  return [...new Set(String(texto ?? '').split(/[\n,]+/).map(item => item.trim()).filter(Boolean))].slice(0, limite)
}

export function filtrosCatalogo(filtros = {}) {
  const parametros = {}
  for (const [chave, maximo] of Object.entries({ texto: 120, area: 90, provincia: 30, entidade: 150, tipo: 35, modalidade: 20 })) {
    const valor = String(filtros[chave] ?? '').trim().slice(0, maximo)
    if (valor) parametros['p_' + chave] = valor
  }
  for (const [chave, minimo, maximo] of [['escolaridade', 1, 5], ['experiencia', 0, 720], ['prazo', 0, 90]]) {
    const valor = filtros[chave]
    if (valor === '' || valor == null) continue
    if (Number.isInteger(Number(valor)) && Number(valor) >= minimo && Number(valor) <= maximo) parametros['p_' + chave] = Number(valor)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filtros.publicacao ?? '')) parametros.p_publicacao = filtros.publicacao
  return parametros
}

export function prazoLegivel(oportunidade) {
  return dataLegivel(oportunidade.prazo) + (oportunidade.prazo_hora ? ` · ${oportunidade.prazo_hora.slice(0, 5)} (Maputo)` : '')
}

export function estaVigente(oportunidade, instante = new Date()) {
  const hoje = dataMaputo(instante)
  const revisao = Date.parse(oportunidade.verificada_em)
  const expiracao = oportunidade.prazo && oportunidade.prazo_hora
    ? Date.parse(`${oportunidade.prazo}T${oportunidade.prazo_hora.slice(0,5)}:00+02:00`) : Infinity
  return oportunidade.estado === 'activa' && revisao <= instante.getTime() &&
    instante.getTime() - revisao <= 30 * 86400000 &&
    (!oportunidade.prazo || oportunidade.prazo >= hoje) && instante.getTime() < expiracao &&
    (!oportunidade.data_publicacao || oportunidade.data_publicacao <= hoje)
}

export function filtrarOportunidadesLocais(registos, filtros, instante = new Date()) {
  const p = filtrosCatalogo(filtros)
  const diaFinal = p.p_prazo === undefined ? null : dataMaputo(new Date(instante.getTime() + p.p_prazo * 86400000))
  return registos.filter(item => {
    if (!estaVigente(item, instante)) return false
    const texto = [item.titulo, item.entidade, item.descricao, ...item.competencias, ...item.requisitos].join(' ').toLowerCase()
    return (!p.p_texto || texto.includes(p.p_texto.toLowerCase())) &&
      (!p.p_entidade || item.entidade.toLowerCase().includes(p.p_entidade.toLowerCase())) &&
      ['area','provincia','tipo','modalidade'].every(campo => !p['p_' + campo] || item[campo] === p['p_' + campo]) &&
      (p.p_escolaridade === undefined || (item.escolaridade !== null && item.escolaridade <= p.p_escolaridade)) &&
      (p.p_experiencia === undefined || (item.experiencia_meses !== null && item.experiencia_meses <= p.p_experiencia)) &&
      (!diaFinal || (item.prazo && item.prazo <= diaFinal)) &&
      (!p.p_publicacao || (item.data_publicacao && item.data_publicacao >= p.p_publicacao))
  }).sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'))
}
