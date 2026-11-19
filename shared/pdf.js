import { diaDaTarefa } from './planner.js'
import { carregarFonteTTF, larguraFonte, textoCodificado, objectosFonte, obterFonteUnicode, textoFonte } from './fonteUnicode.js'
function winAnsi(value) {
  return String(value ?? '').normalize('NFC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2022\u25cf]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/€/g, '\x80')
    .replace(/[✓✔]/g, ' [concluído] ')
    .replace(/✗/g, ' [não concluído] ')
    .replace(/[→➜↗]/g, ' -> ')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x20-\x7e\x80-\xff\n]/gu, simbolo => `[U+${simbolo.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}]`)
}

function pdfTexto(value) {
  return winAnsi(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function bytes(value) {
  return Uint8Array.from([...value].map(ch => ch.charCodeAt(0) & 255))
}

function largura(texto, tamanho, negrito = false) {
  let n = 0
  for (const ch of winAnsi(texto)) {
    if (ch === ' ') n += 0.278
    else if ('iIl1.,:;!|\'fjrt'.includes(ch)) n += 0.30
    else if ('MW@%#'.includes(ch)) n += 1.00
    else if ('mw'.includes(ch)) n += 0.77
    else if ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(ch) || /[À-Ý]/.test(ch)) n += 0.74
    else if ('0123456789'.includes(ch)) n += 0.62
    else n += 0.55
  }
  return n * tamanho * (negrito ? 1.065 : 1)
}

function quebrar(texto, tamanho, limite, negrito = false) {
  const palavras = winAnsi(texto).split(/\s+/).filter(Boolean)
  if (!palavras.length) return ['']
  const linhas = []
  let corrente = ''
  for (let palavra of palavras) {
    const candidata = corrente ? `${corrente} ${palavra}` : palavra
    if (largura(candidata, tamanho, negrito) <= limite) {
      corrente = candidata
      continue
    }
    if (corrente) {
      linhas.push(corrente)
      corrente = ''
    }
    while (palavra && largura(palavra, tamanho, negrito) > limite) {
      let parte = ''
      while (palavra && largura(parte + palavra[0], tamanho, negrito) <= limite) {
        parte += palavra[0]
        palavra = palavra.slice(1)
      }
      if (!parte) {
        parte = palavra[0]
        palavra = palavra.slice(1)
      }
      linhas.push(parte)
    }
    corrente = palavra
  }
  if (corrente) linhas.push(corrente)
  return linhas
}

export function gerarPdf(pedido, plano, opcoes = {}) {
  const fonte = opcoes.fonteBytes ? carregarFonteTTF(opcoes.fonteBytes) : null
  const preparar = texto => fonte ? textoFonte(texto, fonte) : winAnsi(texto)
  const medir = (texto, tamanho, negrito = false) => fonte ? larguraFonte(texto, tamanho, fonte) * (negrito ? 1.035 : 1) : largura(texto, tamanho, negrito)
  const quebras = (texto, tamanho, limite, negrito = false) => {
    if (!fonte) return quebrar(texto, tamanho, limite, negrito)
    const palavras = preparar(texto).split(/\s+/).filter(Boolean)
    const linhas = []
    let actual = ''
    for (let palavra of palavras) {
      const candidato = actual ? actual + ' ' + palavra : palavra
      if (medir(candidato, tamanho, negrito) <= limite) { actual = candidato; continue }
      if (actual) linhas.push(actual)
      actual = ''
      while (palavra && medir(palavra, tamanho, negrito) > limite) {
        let parte = ''
        for (const ch of palavra) {
          if (medir(parte + ch, tamanho, negrito) > limite) break
          parte += ch
        }
        if (!parte) parte = [...palavra][0]
        linhas.push(parte)
        palavra = palavra.slice(parte.length)
      }
      actual = palavra
    }
    if (actual) linhas.push(actual)
    return linhas.length ? linhas : ['']
  }
  if (!plano?.semanas?.length || plano.semanas.length !== 4) throw new Error('Plano inválido para PDF')
  const folhas = []
  let comandos = []
  let pagina = 0
  let y = 713
  const corTexto = '0.12 0.20 0.29'
  const corCinza = '0.32 0.41 0.46'
  const larguraUtil = 484

  function rect(x, yy, w, h, rgb) {
    comandos.push(`${rgb} rg ${x.toFixed(1)} ${yy.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`)
  }

  function escrever(texto, x, yy, tamanho = 10, negrito = false, cor = corTexto) {
    if (fonte) {
      const conteudo = textoCodificado(texto, fonte)
      comandos.push(`${cor} rg BT /U ${tamanho} Tf ${negrito ? '0.28 w 2 Tr' : '0 Tr'} 1 0 0 1 ${x.toFixed(1)} ${yy.toFixed(1)} Tm ${conteudo} Tj ET`)
    } else comandos.push(`${cor} rg BT /${negrito ? 'B' : 'R'} ${tamanho} Tf 1 0 0 1 ${x.toFixed(1)} ${yy.toFixed(1)} Tm (${pdfTexto(texto)}) Tj ET`)
  }

  function novaPagina() {
    if (comandos.length) folhas.push(comandos.join('\n'))
    comandos = []
    pagina += 1
    rect(0, 752, 595, 90, '0.063 0.142 0.247')
    rect(0, 748, 595, 5, '0.10 0.65 0.55')
    escrever('RumoCerto MZ', 49, 793, 23, true, '1 1 1')
    escrever('PLANO DE DESENVOLVIMENTO PROFISSIONAL  |  30 DIAS', 49, 768, 9, false, '0.78 0.91 0.89')
    rect(0, 0, 595, 72, '0.94 0.97 0.97')
    escrever('Fonte de contexto: Banco Mundial / OIT, país MOZ', 49, 49, 8, false, corCinza)
    escrever('RumoCerto MZ  |  Documento educativo sem garantia de emprego', 49, 28, 8, false, corCinza)
    escrever(`Página ${pagina}`, 510, 28, 8, false, corCinza)
    y = 712
  }

  function reservar(altura) {
    if (y - altura < 93) novaPagina()
  }

  function paragrafo(texto, { tamanho = 10, negrito = false, recuo = 0, espaco = 7, entrelinha = tamanho * 1.48, cor = corTexto } = {}) {
    const linhas = quebras(texto, tamanho, larguraUtil - recuo, negrito)
    for (const linha of linhas) {
      reservar(entrelinha)
      escrever(linha, 49 + recuo, y, tamanho, negrito, cor)
      y -= entrelinha
    }
    y -= espaco
    return linhas.length * entrelinha + espaco
  }

  function secao(titulo) {
    const partes = quebras(titulo, 14, larguraUtil, true)
    reservar(partes.length * 21 + 17)
    y -= 8
    for (const parte of partes) {
      escrever(parte, 49, y, 14, true, '0.06 0.45 0.40')
      y -= 21
    }
    y -= 6
  }

  function linhasSemana(semana) {
    const partes = []
    partes.push({ texto: semana.foco, size: 9.6, gap: 6, cor: corCinza })
    partes.push({ texto: `Tempo previsto para esta semana: ${semana.minutosSugeridos} minutos`, size: 9.3, bold: true, gap: 9, cor: '0.06 0.45 0.40' })
    semana.tarefas.forEach((t, i) => {
      const duracao = semana.minutosPorTarefa?.[i]
      partes.push({ texto: `Dia ${diaDaTarefa(semana, i)}.  ${t}${duracao ? ` (${duracao} min)` : ''}`, size: 9.5, gap: 5, recuo: 9 })
    })
    partes.push({ texto: `Resultado esperado: ${semana.entregavel}`, size: 9.4, bold: true, gap: 5 })
    partes.push({ texto: `Critério de progresso: ${semana.indicador}`, size: 9.2, gap: 13, cor: corCinza })
    return partes
  }

  function alturaSemana(semana) {
    const titulo = `SEMANA ${String(semana.numero).padStart(2, '0')}  |  ${semana.titulo}`
    let h = 16 + quebras(titulo, 11.8, 470, true).length * 17 + 16
    for (const bloco of linhasSemana(semana)) {
      h += quebras(bloco.texto, bloco.size, larguraUtil - (bloco.recuo || 0), Boolean(bloco.bold)).length * bloco.size * 1.48 + bloco.gap
    }
    return h
  }

  function desenharSemana(semana) {
    const total = alturaSemana(semana)
    if (total <= 600 && y - total < 93) novaPagina()
    const titulo = `SEMANA ${String(semana.numero).padStart(2, '0')}  |  ${semana.titulo}`
    const partes = quebras(titulo, 11.8, 470, true)
    reservar(partes.length * 17 + 22)
    const topo = y + 7
    const alturaTitulo = partes.length * 17 + 13
    rect(49, topo - alturaTitulo, 497, alturaTitulo, '0.90 0.96 0.94')
    rect(49, topo - alturaTitulo, 4, alturaTitulo, '0.10 0.65 0.55')
    y -= 6
    for (const parte of partes) {
      escrever(parte, 61, y, 11.8, true, '0.04 0.37 0.34')
      y -= 17
    }
    y -= 14
    for (const bloco of linhasSemana(semana)) {
      paragrafo(bloco.texto, {
        tamanho: bloco.size,
        negrito: Boolean(bloco.bold),
        recuo: bloco.recuo || 0,
        espaco: bloco.gap,
        cor: bloco.cor || corTexto
      })
    }
  }

  novaPagina()
  secao(plano.titulo)
  const data = new Date(plano.criadoEm || Date.now())
  paragrafo(`Gerado em: ${new Intl.DateTimeFormat('pt-MZ', { dateStyle: 'long', timeZone: 'Africa/Maputo' }).format(data)}`, { tamanho: 9, espaco: 10, cor: corCinza })
  paragrafo(`Área: ${pedido.area}  |  Situação: ${pedido.situacao}`, { negrito: true })
  paragrafo(`Objectivo: ${pedido.objetivo}`)
  paragrafo(`Disponibilidade: ${pedido.disponibilidade}  |  Internet: ${pedido.internet}`)
  if (pedido.dificuldade) paragrafo(`Dificuldade a considerar: ${pedido.dificuldade}`)
  secao('Diagnóstico e estratégia')
  paragrafo(plano.diagnostico, { espaco: 8 })
  paragrafo(plano.estrategia, { espaco: 20 })
  for (const semana of plano.semanas) desenharSemana(semana)
  secao('Recursos e limites')
  for (const frase of [...plano.recursos, ...plano.avisos]) paragrafo(`- ${frase}`, { tamanho: 9.5, espaco: 6 })
  folhas.push(comandos.join('\n'))

  return montarPdf(folhas, fonte)
}

function montarPdf(folhas, fonte = null) {
  const objetos = []
  const add = s => (objetos.push(s), objetos.length)
  const root = add('')
  const pages = add('')
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const unicode = fonte ? objectosFonte(fonte, add) : null
  const ids = []
  for (const conteudo of folhas) {
    const stream = add(`<< /Length ${bytes(conteudo).length} >>\nstream\n${conteudo}\nendstream`)
    ids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /R ${regular} 0 R /B ${bold} 0 R ${unicode ? `/U ${unicode} 0 R` : ''} >> >> /Contents ${stream} 0 R >>`))
  }
  objetos[root - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`
  objetos[pages - 1] = `<< /Type /Pages /Count ${ids.length} /Kids [${ids.map(i => `${i} 0 R`).join(' ')}] >>`
  let doc = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets = [0]
  for (let i = 0; i < objetos.length; i++) {
    offsets.push(bytes(doc).length)
    doc += `${i + 1} 0 obj\n${objetos[i]}\nendobj\n`
  }
  const tabela = bytes(doc).length
  doc += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const pos of offsets.slice(1)) doc += `${String(pos).padStart(10, '0')} 00000 n \n`
  doc += `trailer\n<< /Size ${objetos.length + 1} /Root ${root} 0 R >>\nstartxref\n${tabela}\n%%EOF\n`
  return bytes(doc)
}

export async function gerarPdfUnicode(pedido, plano, opcoes = {}) {
  const dadosFonte = opcoes.fonteBytes || await obterFonteUnicode()
  return gerarPdf(pedido, plano, { fonteBytes: dadosFonte })
}

export function gerarPdfCurriculo(curriculo) {
  const folhas = []
  let comandos = []
  let y
  function escrever(texto, tamanho, cor, negrito) {
    comandos.push(`${cor} rg BT /${negrito ? 'B' : 'R'} ${tamanho} Tf 1 0 0 1 49 ${y.toFixed(1)} Tm (${pdfTexto(texto)}) Tj ET`)
  }
  function novaPagina() {
    if (comandos.length) folhas.push(comandos.join('\n'))
    comandos = ['0.063 0.142 0.247 rg 0 827 595 15 re f', '0.10 0.65 0.55 rg 0 822 595 5 re f']
    y = 36
    escrever(`Currículo  |  ${folhas.length + 1}`, 9, '0.32 0.41 0.46', false)
    y = 773
  }
  function bloco(texto, { tamanho = 11, negrito = false, cor = '0.12 0.20 0.29' } = {}) {
    for (const paragrafo of String(texto).split('\n')) {
      for (const linha of quebrar(paragrafo, tamanho, 490, negrito)) {
        if (y < 64) novaPagina()
        escrever(linha, tamanho, cor, negrito)
        y -= tamanho * 1.46
      }
    }
    y -= 7
  }
  if (!curriculo?.nome?.trim()) throw new Error('Indique o nome profissional antes de exportar.')
  novaPagina()
  bloco(curriculo.nome, { tamanho: 26, negrito: true })
  if (curriculo.cargo) bloco(curriculo.cargo, { tamanho: 14 })
  const contactos = [curriculo.localidade, curriculo.email, curriculo.telefone, curriculo.portefolio].filter(Boolean)
  if (contactos.length) bloco(contactos.join('  |  '), { tamanho: 10, cor: '0.32 0.41 0.46' })
  const secoes = {
    resumo: 'Resumo profissional', formacao: 'Formação académica', experiencia: 'Experiência profissional',
    competencias: 'Competências', certificacoes: 'Certificações', idiomas: 'Idiomas', projectos: 'Projectos'
  }
  for (const [campo, titulo] of Object.entries(secoes)) {
    if (!curriculo[campo]?.trim()) continue
    if (y < 112) novaPagina()
    y -= 5
    bloco(titulo, { tamanho: 14, negrito: true, cor: '0.06 0.45 0.40' })
    bloco(curriculo[campo])
  }
  folhas.push(comandos.join('\n'))
  return montarPdf(folhas)
}
