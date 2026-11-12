export function formatarPercentagem(valor) {
  return typeof valor === 'number' && Number.isFinite(valor)
    ? `${new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valor)}%`
    : 'Sem dados'
}

export function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim())
}

export function normalizarSerieBancoMundial(json) {
  if (!Array.isArray(json) || !Array.isArray(json[1])) throw new Error('O formato dos dados recebidos não é válido.')
  return json[1]
    .filter((item) => /^\d{4}$/.test(String(item.date)) && typeof item.value === 'number' && Number.isFinite(item.value))
    .map((item) => ({ ano: Number(item.date), valor: item.value }))
    .sort((a, b) => a.ano - b.ano)
}

export function validarPlano(plano) {
  const erros = {}
  if (!String(plano.area || '').trim()) erros.area = 'Escolhe uma área de interesse.'
  if (!String(plano.situacao || '').trim()) erros.situacao = 'Indica a tua situação actual.'
  if (String(plano.objetivo || '').trim().length < 10) erros.objetivo = 'Descreve um objectivo com pelo menos 10 caracteres.'
  return erros
}

// Exporta uma série pública num ficheiro CSV compatível com folhas de cálculo.
export function criarCsvSerie(serie) {
  const linhas = ['Ano;Percentagem'];
  for (const item of serie) {
    if (Number.isInteger(item.ano) && Number.isFinite(item.valor)) {
      linhas.push(`${item.ano};${String(item.valor).replace('.', ',')}`);
    }
  }
  return '\uFEFF' + linhas.join('\r\n') + '\r\n';
}
