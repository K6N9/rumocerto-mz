// Indicadores oficiais da API do Banco Mundial (país MOZ).
// O indicador de desemprego refere-se à FORÇA DE TRABALHO de 15 a 24 anos;
// não corresponde à percentagem de todos os jovens sem emprego.
export const indicadores = Object.freeze([
  {
    codigo: 'SL.UEM.1524.ZS',
    titulo: 'Desemprego juvenil — total',
    subtitulo: 'Jovens dos 15 aos 24 anos, ambos os sexos',
    resumo: 'Percentagem de desempregados na força de trabalho juvenil (estimativa modelada pela OIT).',
    cor: '#2b8c85',
    icone: '◉',
  },
  {
    codigo: 'SL.UEM.1524.FE.ZS',
    titulo: 'Desemprego juvenil — mulheres',
    subtitulo: 'Mulheres dos 15 aos 24 anos',
    resumo: 'Percentagem de desempregadas na força de trabalho feminina jovem (estimativa OIT).',
    cor: '#8c63b8',
    icone: '◈',
  },
  {
    codigo: 'SL.UEM.1524.MA.ZS',
    titulo: 'Desemprego juvenil — homens',
    subtitulo: 'Homens dos 15 aos 24 anos',
    resumo: 'Percentagem de desempregados na força de trabalho masculina jovem (estimativa OIT).',
    cor: '#dd9251',
    icone: '◍',
  },
])

export function obterIndicador(codigo) {
  return indicadores.find((i) => i.codigo === codigo) || null
}
