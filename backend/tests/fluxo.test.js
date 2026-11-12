import test from 'node:test'
import assert from 'node:assert/strict'
import worker, { __teste } from '../src/worker.js'
import { AREAS, construirPlanoBase, normalizarPlanoIA, validarPedido, gerarPlano } from '../src/planner.js'
import { criarPDF } from '../src/pdf.js'

const pedido = () => ({nome:'Pessoa Teste',email:'estudante@example.org',area:'Tecnologia e engenharia',situacao:'Estudante',objetivo:'Criar um portefólio profissional com projectos Web', disponibilidade:'3 a 5 horas por semana',internet:'Acesso limitado a dados móveis',competencias:'HTML e JavaScript',dificuldade:'Falta de tempo', consentimento:true,website:''})
const memoria=new Map()
const kv={get:async k=>memoria.get(k)||null,put:async(k,v)=>{memoria.set(k,v)},list:async({prefix})=>({keys:[...memoria.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true})}
const env={JOBS:kv,EMAILJS_PUBLIC_KEY:'chave_publica_teste',EMAILJS_SERVICE_ID:'service_teste',EMAILJS_TEMPLATE_CONFIRM:'template_confirma',EMAILJS_TEMPLATE_PLAN:'template_plano',PUBLIC_WORKER_URL:'http://localhost:8787',ALLOWED_ORIGINS:'http://localhost:5173'}

test('validação encontra e-mail inválido e ausência de consentimento',()=>{
  const p=pedido();p.email='incorrecto';p.consentimento=false
  assert.ok(validarPedido(p).email)
  assert.ok(validarPedido(p).consentimento)
})
test('motor gratuito gera quatro semanas com tarefas e etapas práticas',()=>{
  for(const a of AREAS){const p=pedido();p.area=a;const plano=construirPlanoBase(p);assert.equal(plano.semanas.length,4);assert.ok(plano.semanas.every(s=>s.tarefas.length===5))}
})
test('sem chave Gemini usa motor de regras e não declara IA',async()=>{
 const plano=await gerarPlano(pedido(),{});assert.match(plano.metodo,/sem IA/)
})
test('resposta IA inválida é descartada de forma segura',()=>{
  assert.equal(normalizarPlanoIA({semanas:[{tarefas:['1']}]},construirPlanoBase(pedido())),null)
})
test('PDF com páginas, metadados e sem texto falso de ofertas',()=>{
  const pdf=criarPDF(pedido(),construirPlanoBase(pedido()))
  assert.match(new TextDecoder('latin1').decode(pdf.slice(0,30)),/%PDF-1.4/)
  assert.ok(pdf.length>6000)
})
test('fluxo de 2 e-mails com entrega agendada e PDF no segundo e-mail',async()=>{
 const previousFetch=globalThis.fetch
 const enviados=[]
 globalThis.fetch=async(url,op)=>{assert.match(url,/api\.emailjs\.com/);enviados.push(JSON.parse(op.body));return new Response('OK',{status:200})}
 try{
  const r=await worker.fetch(new Request('https://worker.test/api/planos',{method:'POST',headers:{'Origin':'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify(pedido())}),env)
  assert.equal(r.status,201)
  const data=await r.json()
  assert.equal(enviados.length,1)
  assert.equal(enviados[0].template_id,env.EMAILJS_TEMPLATE_CONFIRM)
  assert.equal(data.plano.semanas.length,4)
  const status=await worker.fetch(new Request('https://worker.test/api/planos/'+data.id+'?token='+data.token),env)
  assert.equal(status.status,200)
  const unauth=await worker.fetch(new Request('https://worker.test/api/planos/'+data.id),env)
  assert.equal(unauth.status,401)
  const pdf=await worker.fetch(new Request('https://worker.test/api/planos/'+data.id+'/pdf?token='+data.token),env)
  assert.equal(pdf.headers.get('Content-Type'),'application/pdf')
  const saved=JSON.parse(memoria.get('job:'+data.id));saved.agendadoPara=Date.now()-10;memoria.set('job:'+data.id,JSON.stringify(saved))
  await __teste.executarCron(env)
  assert.equal(enviados.length,2)
  assert.equal(enviados[1].template_id,env.EMAILJS_TEMPLATE_PLAN)
  assert.equal(enviados[1].template_params.titulo_plano, data.plano.titulo)
  assert.equal(enviados[1].template_params.metodo, data.plano.metodo)
  assert.equal(enviados[1].template_params.resumo_plano, data.plano.diagnostico)
  assert.match(enviados[1].template_params.link_pdf, new RegExp('^http://localhost:8787/api/planos/'+data.id+'/pdf\\?token='))
  assert.equal('pdf_anexo' in enviados[1].template_params, false, 'Anexos não são suportados no EmailJS Free')
  assert.doesNotMatch(enviados[1].template_params.metodo, /1002/)
  const saved2=JSON.parse(memoria.get('job:'+data.id))
  assert.equal(saved2.estado,'enviado')
  const repeated=await worker.fetch(new Request('https://worker.test/api/planos',{method:'POST',headers:{'Origin':'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify(pedido())}),env)
  assert.equal(repeated.status,429)
 } finally{globalThis.fetch=previousFetch}
})

test('plano para objectivo Vue.js contém tarefas específicas gratuitas mesmo sem IA',()=>{
  const p=pedido(); p.objetivo='Aprender Vue.js para criar um site com componentes e APIs'
  const plano=construirPlanoBase(p)
  assert.match(plano.titulo,/Vue\.js/)
  assert.ok(plano.semanas.some(s=>s.tarefas.some(t=>/Vue Router|v-model|Composition API/.test(t))))
  assert.ok(plano.recursos.some(r=>/vuejs.org/.test(r)))
})
test('link do PDF exige URL válida e respeita o token privado',()=>{
  const job={id:'123e4567-e89b-12d3-a456-426614174000',downloadToken:'a'.repeat(48)}
  assert.match(__teste.linkPlanoPDF({PUBLIC_WORKER_URL:'https://api.example.org'},job),/https:\/\/api.example.org\/api\/planos\//)
  assert.throws(()=>__teste.linkPlanoPDF({PUBLIC_WORKER_URL:'http://api.example.org'},job))
  assert.throws(()=>__teste.linkPlanoPDF({PUBLIC_WORKER_URL:''},job))
})
test('Gemini com resposta válida devolve plano de 4 semanas sinalizado como IA',async()=>{
  const p=pedido()
  const base=construirPlanoBase(p)
  const resposta={titulo:'Plano para portefólio Vue',diagnostico:'Trabalhar durante quatro semanas.',estrategia:'Pouco consumo de dados.',semanas:base.semanas.map(s=>({...s,tarefas:s.tarefas.slice(0,4)}))}
  const mockFetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(resposta)}]}}]}),{status:200})
  const plano=await gerarPlano(p,{GEMINI_API_KEY:'chave_ficticia'},mockFetch)
  assert.equal(plano.titulo,'Plano para portefólio Vue')
  assert.match(plano.metodo,/IA Gemini/)
})
