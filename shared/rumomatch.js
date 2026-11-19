function chave(valor) {
  return String(valor ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function compararListas(preferidas = [], oferecidas = []) {
  const conjunto = new Set(preferidas.map(chave).filter(Boolean))
  return oferecidas.some(opcao => conjunto.has(chave(opcao)))
}

function criterio(nome, peso, conhecido, compativel, detalhe, obrigatorio = false) {
  return { nome, peso, estado: conhecido ? (compativel ? 'compatível' : 'incompatível') : 'por confirmar', detalhe, obrigatorio }
}

const numero = valor => Number.isInteger(valor)

export function calcularCorrespondencia(perfil, preferencias, oportunidade) {
  const o = oportunidade
  const tecnicas = perfil.competencias || []
  const exigidas = o.competencias_obrigatorias || []
  const sugeridas = o.competencias || []
  const provincias = preferencias.provincias?.length ? preferencias.provincias : [perfil.provincia].filter(Boolean)
  const modalidades = preferencias.modalidades || []
  const tipos = preferencias.tipos || []
  const faltam = exigidas.filter(skill => !compararListas(tecnicas, [skill]))
  const criterios = [
    criterio('Área', 25, perfil.area && o.area, chave(perfil.area) === chave(o.area), o.area || 'Área por indicar'),
    criterio('Escolaridade', 12, numero(perfil.escolaridade) && numero(o.escolaridade), perfil.escolaridade >= o.escolaridade,
      numero(o.escolaridade) ? 'Compare a formação mínima indicada' : 'Formação mínima por indicar', numero(o.escolaridade)),
    criterio('Competências', 15, tecnicas.length && sugeridas.length, compararListas(tecnicas, sugeridas), sugeridas.join(', ') || 'Competências por indicar'),
    criterio('Experiência', 12, numero(perfil.experiencia_meses) && numero(o.experiencia_meses), perfil.experiencia_meses >= o.experiencia_meses,
      numero(o.experiencia_meses) ? `${o.experiencia_meses} meses de experiência mínima` : 'Experiência mínima por indicar', numero(o.experiencia_meses)),
    criterio('Província', 8, provincias.length && o.provincia, compararListas(provincias, [o.provincia]), o.provincia || 'Localização por indicar'),
    criterio('Modalidade', 8, modalidades.length && o.modalidade, compararListas(modalidades, [o.modalidade]), o.modalidade || 'Modalidade por indicar'),
    criterio('Tipo de oportunidade', 8, tipos.length && o.tipo, compararListas(tipos, [o.tipo]), o.tipo || 'Tipo por indicar'),
    criterio('Competências obrigatórias', 12, tecnicas.length && exigidas.length, !faltam.length, exigidas.join(', ') || 'Competências obrigatórias por indicar', Boolean(exigidas.length))
  ]
  const peso = estado => criterios.filter(c => c.estado === estado).reduce((total, c) => total + c.peso, 0)
  const pontuacao = peso('compatível')
  const cobertura = 100 - peso('por confirmar')
  const impedimento = criterios.some(c => c.obrigatorio && c.estado !== 'compatível')
  const recomendacoes = criterios.filter(c => c.estado === 'incompatível').map(c => `Reveja o critério «${c.nome}» antes de se candidatar.`)
  if (faltam.length) recomendacoes.push(`Confirme ou desenvolva estas competências: ${faltam.join(', ')}.`)
  if (o.requisitos?.length) recomendacoes.push('Leia os requisitos da entidade e confirme os documentos ou condições adicionais.')
  if (cobertura < 60) recomendacoes.push('Complete o perfil e consulte o anúncio original para confirmar os dados em falta.')
  return { criterios, pontuacao, cobertura, aptaParaAlerta: !impedimento && pontuacao >= 60, recomendacoes }
}

export function ordenarCorrespondencias(perfil, preferencias, oportunidades) {
  return oportunidades.map(oportunidade => ({ oportunidade, ...calcularCorrespondencia(perfil, preferencias, oportunidade) }))
    .sort((a, b) => Number(b.aptaParaAlerta) - Number(a.aptaParaAlerta) ||
      b.pontuacao - a.pontuacao || b.cobertura - a.cobertura || a.oportunidade.titulo.localeCompare(b.oportunidade.titulo, 'pt'))
}
