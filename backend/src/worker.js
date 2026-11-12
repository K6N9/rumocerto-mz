import { gerarPlano, validarPedido } from './planner.js'
import { criarPDF } from './pdf.js'

const minutos5 = 5 * 60 * 1000
const prazoSegundos = 7 * 24 * 60 * 60
const json = (o,status=200,extra={}) => new Response(JSON.stringify(o),{status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}})
const err = (msg,status=400,extra={}) => json({erro:msg},status,extra)
function cors(request,env) {
  const origin=request.headers.get('Origin') || ''
  const allowed=String(env.ALLOWED_ORIGINS||'http://localhost:5173,http://localhost:4173').split(',').map(s=>s.trim())
  return allowed.includes(origin) ? {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'} : {}
}
function padraoEnvio(job) {return {to_email:job.email, nome:job.nome||'Jovem', area:job.pedido.area, situacao:job.pedido.situacao, objetivo:job.pedido.objetivo, passos:job.plano.semanas[0].tarefas.slice(0,3).map((s,i)=>`${i+1}. ${s}`).join('\n'), notas:job.pedido.dificuldade||'Sem notas adicionais', subject:'Recebemos as tuas escolhas — RumoCerto MZ', prazo:'Cerca de 5 minutos'}}
async function emailJS(env,template,params) {
  if(!env.EMAILJS_SERVICE_ID || !env.EMAILJS_PUBLIC_KEY || !template)throw new Error('E-mail não configurado no Worker')
  const body={service_id:env.EMAILJS_SERVICE_ID,template_id:template,user_id:env.EMAILJS_PUBLIC_KEY,template_params:params}
  if(env.EMAILJS_PRIVATE_KEY) body.accessToken=env.EMAILJS_PRIVATE_KEY
  const r=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  if(!r.ok)throw new Error('EmailJS: '+r.status+' '+(await r.text()).slice(0,120))
}
async function digest(token) {
  const bytes=new TextEncoder().encode(token)
  const hash=await crypto.subtle.digest('SHA-256',bytes)
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')
}
function token() {const b=crypto.getRandomValues(new Uint8Array(24));return [...b].map(n=>n.toString(16).padStart(2,'0')).join('')}
function publicStatus(job) {return {id:job.id,estado:job.estado,agendadoPara:new Date(job.agendadoPara).toISOString(),enviadoEm:job.enviadoEm||null,metodo:job.plano.metodo,titulo:job.plano.titulo}}
async function criar(request,env) {
  if(!env.JOBS)return err('Base de dados KV por configurar.',503)
  if(!env.EMAILJS_TEMPLATE_CONFIRM || !env.EMAILJS_TEMPLATE_PLAN)return err('Configura os dois templates do EmailJS no Worker.',503)
  try {linkPlanoPDF(env,{id:crypto.randomUUID(),downloadToken:token()})} catch{return err('Configura PUBLIC_WORKER_URL para criar um link PDF válido.',503)}
  const size=Number(request.headers.get('Content-Length')||'0')
  if(size>8000)return err('Pedido demasiado grande.',413)
  let data
  try {const body=await request.text();if(body.length>8000)return err('Pedido demasiado grande.',413);data=JSON.parse(body)} catch{return err('JSON inválido.')}
  const erros=validarPedido(data)
  if(Object.keys(erros).length)return json({erro:'Verifica o formulário.',erros},422)
  const ip=request.headers.get('CF-Connecting-IP')||'local'
  const ipkey='limite:'+await digest(ip + ':'+ String(env.RATE_SALT||'rumocerto'))
  const ultimo=Number(await env.JOBS.get(ipkey)||0)
  if(Date.now()-ultimo<90_000)return err('Aguarda pelo menos 90 segundos antes de pedir outro plano.',429)
  // Não confiar em afirmações de IA: é uma orientação educativa, sem garantias de contratação.
  const pedido={nome:String(data.nome||'').trim(),area:data.area,situacao:data.situacao,objetivo:String(data.objetivo).trim(),disponibilidade:data.disponibilidade,internet:data.internet,competencias:String(data.competencias||'').trim(),dificuldade:String(data.dificuldade||'').trim()}
  const plano=await gerarPlano(pedido,env)
  const id=crypto.randomUUID()
  const auth=token()
  const now=Date.now()
  const job={id,hash:await digest(auth),downloadToken:auth,nome:pedido.nome,email:String(data.email).trim(),pedido,plano,estado:'pendente',agendadoPara:now+minutos5,criadoEm:new Date(now).toISOString(),tentativas:0}
  // Confirmação enviada antes de se aceitar a tarefa na fila.
  try{await emailJS(env,env.EMAILJS_TEMPLATE_CONFIRM,padraoEnvio(job))}
  catch(e){console.error('Falha ao enviar confirmação',e.message);return err('Não foi possível enviar o primeiro e-mail. Verifica a configuração do serviço.',502)}
  await env.JOBS.put('job:'+id,JSON.stringify(job),{expirationTtl:prazoSegundos})
  await env.JOBS.put(ipkey,String(now),{expirationTtl:150})
  return json({mensagem:'Confirmação aceite pelo EmailJS. Plano agendado para entrega por e-mail.',...publicStatus(job),token:auth,plano},201)
}
async function obter(request,env,id,download=false) {
  if(!env.JOBS)return err('Serviço não configurado.',503)
  const token=new URL(request.url).searchParams.get('token')||''
  if(!/^[0-9a-f]{48}$/.test(token))return err('Acesso não autorizado.',401)
  const txt=await env.JOBS.get('job:'+id)
  if(!txt)return err('Plano não encontrado ou expirado.',404)
  const job=JSON.parse(txt)
  if(await digest(token)!==job.hash)return err('Acesso não autorizado.',401)
  if(!download)return json(publicStatus(job))
  const pdf=criarPDF(job.pedido,job.plano)
  return new Response(pdf,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="RumoCerto_MZ_Plano_30_Dias.pdf"','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})
}
/** Ligação de PDF criada pelo servidor; não é possível enviar URLs locais em produção. */
function linkPlanoPDF(env,job) {
  const base=String(env.PUBLIC_WORKER_URL||'').trim().replace(/\/$/,'')
  let url
  try {url=new URL(base)} catch {throw new Error('PUBLIC_WORKER_URL não configurado')}
  if(!['https:','http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)throw new Error('PUBLIC_WORKER_URL inválido')
  if(url.protocol==='http:' && !['localhost','127.0.0.1'].includes(url.hostname))throw new Error('PUBLIC_WORKER_URL deve usar HTTPS em produção')
  const endereco=new URL(`${url.pathname.replace(/\/$/,'')}/api/planos/${job.id}/pdf`,url.origin)
  endereco.searchParams.set('token',job.downloadToken)
  return endereco.toString()
}
async function enviarPendente(job,env){
  const downloadUrl=linkPlanoPDF(env,job)
  // EmailJS Free não permite anexos; não enviar pdf_anexo nem desencadear tentativas duplicadas.
  const parametros={
    to_email:String(job.email),
    nome:String(job.nome||'Jovem'),
    titulo_plano:String(job.plano.titulo),
    resumo_plano:String(job.plano.diagnostico),
    metodo:String(job.plano.metodo),
    link_pdf:downloadUrl,
    area:String(job.pedido.area),
    situacao:String(job.pedido.situacao),
    objetivo:String(job.pedido.objetivo),
    prazo:new Date(job.agendadoPara).toISOString(),
  }
  await emailJS(env,env.EMAILJS_TEMPLATE_PLAN,parametros)
}
async function executarCron(env){
  if(!env.JOBS)return
  let cursor
  do{
    const list=await env.JOBS.list({prefix:'job:',limit:100,...cursor?{cursor}:{}})
    for(const entry of list.keys){
      const s=await env.JOBS.get(entry.name)
      if(!s)continue
      const job=JSON.parse(s)
      if(job.estado==='enviado'||job.estado==='falhou')continue
      if(job.agendadoPara>Date.now())continue
      if(job.estado==='enviando' && (Date.now()-job.enviandoEm<2*60_000))continue
      if(job.tentativas>=3){job.estado='falhou';await env.JOBS.put(entry.name,JSON.stringify(job),{expirationTtl:prazoSegundos});continue}
      job.estado='enviando';job.enviandoEm=Date.now();job.tentativas++
      await env.JOBS.put(entry.name,JSON.stringify(job),{expirationTtl:prazoSegundos})
      try{
        await enviarPendente(job,env)
        job.estado='enviado';job.enviadoEm=new Date().toISOString()
      }catch(e){console.error('Envio adiado falhou',job.id,e.message);job.estado='pendente';job.agendadoPara=Date.now()+2*60_000}
      await env.JOBS.put(entry.name,JSON.stringify(job),{expirationTtl:prazoSegundos})
    }
    cursor=list.list_complete?null:list.cursor
  }while(cursor)
}

export default {
  async fetch(request,env) {
    const h=cors(request,env)
    const origin=request.headers.get('Origin')
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:h})
    if(origin && !h['Access-Control-Allow-Origin'])return err('Origem não autorizada.',403)
    const url=new URL(request.url)
    try{
      if(url.pathname==='/api/saude' && request.method==='GET')return json({ok:true,aplicacao:'RumoCerto MZ',gratuito:true},200,h)
      if(url.pathname==='/api/planos'&&request.method==='POST'){const r=await criar(request,env);Object.entries(h).forEach(([k,v])=>r.headers.set(k,v));return r}
      const m=url.pathname.match(/^\/api\/planos\/([a-f\d-]{36})(\/pdf)?$/)
      if(m&&request.method==='GET'){const r=await obter(request,env,m[1],Boolean(m[2]));Object.entries(h).forEach(([k,v])=>r.headers.set(k,v));return r}
      return err('Rota não encontrada.',404,h)
    }catch(e){console.error('Erro de API',e.message);return err('O serviço está temporariamente indisponível.',503,h)}
  },
  async scheduled(event,env,ctx){ctx.waitUntil(executarCron(env))},
}

export const __teste={executarCron,digest,criar,publicStatus,linkPlanoPDF}
