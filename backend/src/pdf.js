import { marcaJpegBase64 } from './logo.js'
/** Gerador de PDF sem dependências e sem serviços pagos; Helvetica/WinAnsi (português). */
function ansi(s) {
  return String(s ?? '').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2022/g,'-').replace(/[\u{1F300}-\u{1FAFF}]/gu,'').replace(/[^\x20-\x7e\xA0-\xFF\n]/g,'?')
}
function safeText(s) { return ansi(s).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)') }
function bytes(s) { return Uint8Array.from([...s].map(c=>c.charCodeAt(0)&255)) }
function quebrar(t,max=91) { const out=[];let linha='';for(const word of ansi(t).split(/\s+/)){if(!word)continue;if((linha+' '+word).trim().length>max){if(linha)out.push(linha);linha=word;}else linha=(linha+' '+word).trim()}if(linha)out.push(linha);return out.length?out:[''] }
export function criarPDF(request, plano, options={}) {
  const date = options.date || new Date()
  const paginas=[];let cmds=[];let y=695;let pageNum=0
  function traco(x1,y1,x2,y2) {cmds.push('0.82 0.90 0.90 RG 1 w '+x1+' '+y1+' m '+x2+' '+y2+' l S')}
  function texto(s,x,yy,size=10,bold=false,color='0.12 0.20 0.29') {
    cmds.push(color+' rg BT /'+(bold?'FB':'F')+' '+size+' Tf 1 0 0 1 '+x+' '+yy+' Tm ('+safeText(s)+') Tj ET')
  }
  function iniciar() {
    if(cmds.length) paginas.push(cmds.join('\n'))
    cmds=[];pageNum++;y=695
    cmds.push('0.055 0.18 0.27 rg 0 751 595 91 re f')
    cmds.push('0.06 0.65 0.53 rg 0 744 595 7 re f')
    texto('RumoCerto MZ',48,793,24,true,'1 1 1')
    texto('Plano de desenvolvimento profissional | Grupo 8 - ISUTC',48,770,10,false,'0.75 0.95 0.89')
    texto('Plano educativo - 30 dias',48,724,9,true,'0.06 0.57 0.47')
    cmds.push('q 63 0 0 63 486 765 cm /ImLogo Do Q')
    cmds.push('0.89 0.94 0.95 rg 0 0 595 42 re f')
    texto('RumoCerto MZ | Formação e orientação - sem promessa de emprego',45,24,8)
    texto('Página '+pageNum,520,24,8)
  }
  function linha(s, opts={}) {
    const max = opts.max || 91; const sz=opts.size || 10
    for(const t of quebrar(s, max)) {
      if(y<85) iniciar()
      texto(t,49+(opts.indent||0),y,sz,Boolean(opts.bold),opts.color || '0.12 0.20 0.29')
      y-=opts.lineHeight||15
    }
    if(opts.after)y-=opts.after
  }
  function titulo(s) {if(y<130)iniciar();y-=7;linha(s,{size:14,bold:true,color:'0.05 0.51 0.45',after:5,max:70});traco(48,y+4,547,y+4);y-=11}
  iniciar()
  titulo(plano.titulo)
  linha('Data de geração: '+new Intl.DateTimeFormat('pt-PT',{dateStyle:'medium',timeZone:'UTC'}).format(date),{size:9,after:5})
  linha('Área: '+request.area+'  |  Situação: '+request.situacao,{bold:true,after:6,max:78})
  linha('Objectivo: '+request.objetivo,{after:7})
  linha('Disponibilidade: '+request.disponibilidade+'  |  Internet: '+request.internet,{after:7})
  if(request.dificuldade)linha('Dificuldade a considerar: '+request.dificuldade,{after:7})
  titulo('Diagnóstico e estratégia')
  linha(plano.diagnostico,{after:7})
  linha(plano.estrategia,{after:12})
  for(const s of plano.semanas){
    if(y<240)iniciar()
    titulo('SEMANA '+s.numero+' - '+s.titulo)
    linha(s.foco,{after:6})
    for(const [i,t] of s.tarefas.entries())linha((i+1)+'. '+t,{indent:8,max:83,after:3})
    linha('Evidência: '+s.entregavel,{bold:true,after:3})
    linha('Como medir: '+s.metrica,{after:10})
  }
  if(y<220)iniciar()
  titulo('Recursos e cuidados')
  for(const t of [...plano.recursos,...plano.avisos])linha('- '+t,{after:5})
  linha('Elaboração: '+plano.metodo,{size:9,after:5})
  linha('Fonte de indicadores nacionais: https://data.worldbank.org/indicator/SL.UEM.1524.ZS?locations=MZ',{size:8,max:110})
  paginas.push(cmds.join('\n'))
  const objects=[]
  function add(obj){objects.push(obj);return objects.length}
  const catalog=add(''); const pagesId=add('');const fontRegular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');const fontBold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const jpeg = atob(marcaJpegBase64)
  const imgId = add('<< /Type /XObject /Subtype /Image /Width 180 /Height 180 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n'+jpeg+'\nendstream')
  const pageIds=[]
  for(const str of paginas){const content=add('<< /Length '+bytes(str).length+' >>\nstream\n'+str+'\nendstream');const page=add('<< /Type /Page /Parent '+pagesId+' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F '+fontRegular+' 0 R /FB '+fontBold+' 0 R >> /XObject << /ImLogo '+imgId+' 0 R >> >> /Contents '+content+' 0 R >>');pageIds.push(page)}
  objects[catalog-1]='<< /Type /Catalog /Pages '+pagesId+' 0 R >>'
  objects[pagesId-1]='<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(n=>n+' 0 R').join(' ')+'] >>'
  let document='%PDF-1.4\n%âãÏÓ\n';const offsets=[0]
  for(let i=0;i<objects.length;i++){offsets.push(bytes(document).length);document+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n'}
  const xref=bytes(document).length
  document+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'
  for(const n of offsets.slice(1))document+=String(n).padStart(10,'0')+' 00000 n \n'
  document+='trailer\n<< /Size '+(objects.length+1)+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n'
  return bytes(document)
}
export function pdfBase64(pdfBytes){let str='';for(let i=0;i<pdfBytes.length;i+=16384)str+=String.fromCharCode(...pdfBytes.subarray(i,i+16384));return btoa(str)}
