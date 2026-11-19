<script setup>
import { computed, ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { usePlano } from '../composables/usePlano.js'
import { AREAS, SITUACOES, DISPONIBILIDADES, INTERNET, validarPerfil, gerarPlanoDiario } from '../../shared/planner.js'
import { gerarPdf, gerarPdfUnicode } from '../../shared/pdf.js'
import { conta } from '../services/supabase.js'
import { normalizarPerfil } from '../../shared/persistencia.js'
import { erroPlano } from '../../shared/contratoPlano.js'
import { classificarSaudeWorker } from '../../shared/versao.js'
const {perfil,perfilDoPlano,plano,desactualizado,guardarPlano,limpar,guardarNaConta,estadoSync,ocupado,convertivel}=usePlano()
const passo=ref(1),email=ref(''),consentimento=ref(false),website=ref(''),erro=ref({}),mensagem=ref(''),estado=ref('parado'),pedido=ref(null),token=ref(''),planoRemoto=ref(null)
const candidato = ref(null)
const api=String(import.meta.env.VITE_WORKER_URL || '').replace(/\/$/,'')
const situacaoServico=ref(api ? 'a_verificar' : 'indisponivel')
const enviarDisponivel=computed(()=>situacaoServico.value==='disponivel')
const descricaoServico=computed(()=>({a_verificar:'A verificar o serviço de e-mail…',disponivel:'Serviço de e-mail disponível',incompativel:'A versão da API de e-mail é incompatível com esta aplicação. O PDF continua disponível.',indisponivel:'Serviço de e-mail indisponível. O plano permanece disponível em PDF.'})[situacaoServico.value])
const ambito = computed(() => conta.utilizador?.id || '')
const chaveLocal = (base, utilizador = ambito.value) => utilizador ? `${base}:${utilizador}` : base
let versaoPedido = 0
const pedir = ref(false)
const CHAVE_SUBMISSAO='rumocerto:submissao:v34'
async function identificarSubmissao(dados, utilizador){
  const texto=JSON.stringify({nome:dados.nome,area:dados.area,situacao:dados.situacao,objetivo:dados.objetivo,disponibilidade:dados.disponibilidade,internet:dados.internet,competencias:dados.competencias,dificuldade:dados.dificuldade,usarIA:dados.usarIA,email:dados.email})
  const bruto=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto))
  const assinatura=[...new Uint8Array(bruto)].map(b=>b.toString(16).padStart(2,'0')).join('')
  let existente=null
  try{existente=JSON.parse(localStorage.getItem(chaveLocal(CHAVE_SUBMISSAO, utilizador))||'null')}catch{}
  if(existente?.assinatura===assinatura && /^[0-9a-f-]{36}$/i.test(existente?.id||'') && Date.now()-existente.criadoEm<7*24*60*60*1000)return existente.id
  const id=crypto.randomUUID()
  try{localStorage.setItem(chaveLocal(CHAVE_SUBMISSAO, utilizador),JSON.stringify({id,assinatura,criadoEm:Date.now()}))}catch{}
  return id
}
const passos = [{ numero: 1, titulo: 'Perfil' }, { numero: 2, titulo: 'Objectivo' }, { numero: 3, titulo: 'Plano' }]
let timer=null
const loading=computed(()=>pedir.value || estado.value==='enviando')
const estadoLegivel=computed(()=>({por_confirmar:'Pedido a aguardar confirmação',a_confirmar:'A enviar a confirmação',pendente:'Confirmação aceite; entrega agendada',enviando:'A enviar a mensagem final',enviado:'Mensagem aceite pelo serviço de correio',falhou:'O serviço não concluiu o envio',incerto:'Resultado do envio por confirmar'})[pedido.value?.estado]||'Em processamento')
async function consultarComPrazo(url, opcoes = {}, milissegundos = 15000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), milissegundos)
  try {
    return await fetch(url, { ...opcoes, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
function validarEtapa(n){
  const e=validarPerfil(perfil.value)
  const chaves=n===1?['area','situacao']:n===2?['objetivo','disponibilidade','internet','competencias','dificuldade']:[]
  erro.value=Object.fromEntries(Object.entries(e).filter(([k])=>chaves.includes(k)))
  return !Object.keys(erro.value).length
}
async function avancar(){if(!validarEtapa(passo.value)){await nextTick();document.querySelector('[aria-invalid="true"]')?.focus();return}passo.value=Math.min(3,passo.value+1);mensagem.value='';window.scrollTo({top:0,behavior:'smooth'})}
function voltar(){candidato.value=null;passo.value=Math.max(1,passo.value-1);erro.value={};mensagem.value=''}
function criarPrevia(){
  const e=validarPerfil(perfil.value)
  if(Object.keys(e).length){erro.value=e;passo.value=e.area||e.situacao?1:2;mensagem.value='Revise os campos assinalados antes de gerar o plano.';return}
  candidato.value = null
  if (convertivel.value && !desactualizado.value) {
    estado.value = 'previa'
    mensagem.value = 'O plano anterior continua disponível com o progresso guardado. Abra o progresso para o continuar ou converter.'
    return
  }
  try {
    const result = gerarPlanoDiario(perfil.value)
    if (guardarPlano(result)) informarPlanoCriado()
    else if (!ocupado.value) candidato.value = { plano: result, perfil: { ...perfil.value } }
  } catch (ex) { estado.value = 'erro'; mensagem.value = ex.message }
}
function informarPlanoCriado() {
  estado.value = 'previa'
  mensagem.value = 'Plano criado. Consulte as actividades ou descarregue o documento em PDF.'
}
function confirmarNovoPlano() {
  if (!candidato.value) return
  if (guardarPlano(candidato.value.plano, { confirmado: true, perfilPlano: candidato.value.perfil })) {
    candidato.value = null
    informarPlanoCriado()
  }
}
async function descarregar(){
  if(!plano.value)return
  let pdf
  try { pdf=await gerarPdfUnicode(perfilDoPlano.value||perfil.value,plano.value) }
  catch { pdf=gerarPdf(perfilDoPlano.value||perfil.value,plano.value); mensagem.value='O PDF foi gerado. Alguns símbolos podem ser apresentados em formato alternativo.' }
  const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}))
  const a=document.createElement('a')
  a.href=url;a.download='RumoCerto_MZ_Plano_30_Dias.pdf';a.click()
  setTimeout(()=>URL.revokeObjectURL(url),3000)
}
async function verificarServico(){
  if (!api) { situacaoServico.value='indisponivel';return false }
  situacaoServico.value='a_verificar'
  try {
    const r=await consultarComPrazo(api+'/api/saude',{},9000)
    const servico=await r.json()
    situacaoServico.value=classificarSaudeWorker(r.ok, servico)
  } catch { situacaoServico.value='indisponivel' }
  return situacaoServico.value==='disponivel'
}
function mensagemEstadoEnvio(res){
  if(res.estado==='incerto')return res.faseIncerta==='confirmacao' ?
    'Não foi possível confirmar a aceitação da mensagem inicial. Verifique a caixa de entrada e a pasta de spam. O pedido não será reenviado automaticamente.' :
    'Não foi possível confirmar a aceitação da mensagem final. Verifique a caixa de entrada e a pasta de spam antes de efectuar outro pedido.'
  if(res.estado==='falhou')return 'O envio não foi concluído. O plano e o PDF continuam disponíveis neste dispositivo.'
  if(res.estado==='enviado')return 'A mensagem foi aceite pelo serviço de e-mail. Confirme a recepção na caixa de entrada ou na pasta de spam.'
  if(res.estado==='por_confirmar' || res.estado==='a_confirmar')return 'Pedido registado. A confirmação está em processamento. Não é necessário enviar novamente.'
  return res.recuperado ? 'O pedido já se encontrava registado. Não foram geradas mensagens adicionais.' :
    'A confirmação foi aceite pelo serviço de e-mail. A mensagem final está prevista para cerca de 5 a 7 minutos.'
}
async function pedirPorEmail(){
  if (pedir.value || passo.value !== 3) return
  const versao = versaoPedido
  const utilizador = ambito.value
  const dados={...perfil.value,email:email.value.trim(),consentimento:consentimento.value,website:website.value}
  const e=validarPerfil(dados,{exigirEmail:true})
  erro.value=e
  if(Object.keys(e).length){
    estado.value='erro'
    mensagem.value='Revise os campos assinalados. O progresso guardado foi preservado.'
    if(e.area||e.situacao)passo.value=1
    else if(e.objetivo||e.disponibilidade||e.internet||e.competencias||e.dificuldade)passo.value=2
    return
  }
  pedir.value = true
  estado.value='enviando';mensagem.value='A verificar a disponibilidade do serviço…'
  try{
    const disponivel = await verificarServico()
    if (versao !== versaoPedido) return
    if (!disponivel) throw new Error(descricaoServico.value)
    dados.submissaoId = await identificarSubmissao(dados, utilizador)
    if (versao !== versaoPedido) return
    mensagem.value='A enviar o pedido…'
    const r=await consultarComPrazo(api+'/api/planos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)},30000)
    const resposta=await r.json()
    if (versao !== versaoPedido) return
    if(!r.ok)throw new Error(resposta.erro||'Pedido não aceite pelo servidor')
    const problema = erroPlano(resposta.plano)
    if (problema) throw new Error('O servidor devolveu um plano inválido. ' + problema)
    const perfilRemoto = normalizarPerfil(dados)
    if (!plano.value) guardarPlano(resposta.plano, { perfilPlano: perfilRemoto })
    else if (plano.value.diagnostico !== resposta.plano.diagnostico || plano.value.estrategia !== resposta.plano.estrategia || plano.value.metodo !== resposta.plano.metodo || JSON.stringify(plano.value.semanas.map(s=>s.tarefas)) !== JSON.stringify(resposta.plano.semanas.map(s=>s.tarefas))) planoRemoto.value={ plano: resposta.plano, perfil: perfilRemoto }
    pedido.value={id:resposta.id,agendadoPara:resposta.agendadoPara,estado:resposta.estado};token.value=resposta.token
    guardarPedidoPendente()
    estado.value=r.status===202?'enviando_confirmacao':resposta.estado==='enviado'?'concluido':['incerto','falhou'].includes(resposta.estado)?'erro':'agendado'
    mensagem.value=mensagemEstadoEnvio(resposta)
    if(timer)clearInterval(timer);if(!['enviado','incerto','falhou'].includes(resposta.estado)){timer=setInterval(actualizarEstado,30000)}
  }catch(ex){if (versao === versaoPedido) { estado.value='erro';mensagem.value=ex.name==='AbortError'?'O serviço não respondeu dentro do prazo. O plano permanece disponível neste dispositivo. Verifique o e-mail antes de repetir o pedido.':ex.message }}
  finally { if (versao === versaoPedido) pedir.value = false }
}
const CHAVE_PEDIDO='rumocerto:pedido:pendente'
function guardarPedidoPendente(){
  try { if(pedido.value?.id && token.value) sessionStorage.setItem(chaveLocal(CHAVE_PEDIDO),JSON.stringify({pedido:pedido.value,token:token.value})) } catch {}
}
function removerPedidoPendente(){try{sessionStorage.removeItem(chaveLocal(CHAVE_PEDIDO))}catch{}}
async function actualizarEstado(){
  if(!pedido.value?.id||!api||!token.value)return
  const versao = versaoPedido
  try{
    const r=await consultarComPrazo(`${api}/api/planos/${pedido.value.id}`,{headers:{Authorization:`Bearer ${token.value}`}},12000)
    if (versao !== versaoPedido) return
    if(r.status===404||r.status===401){clearInterval(timer);removerPedidoPendente();pedido.value=null;token.value='';mensagem.value='O pedido anterior expirou. O plano permanece disponível neste navegador.';return}
    if(!r.ok)return
    const res=await r.json()
    if (versao !== versaoPedido || !pedido.value) return
    pedido.value.estado=res.estado
    pedido.value.faseIncerta=res.faseIncerta
    guardarPedidoPendente()
    if(['enviado','falhou','incerto'].includes(res.estado)){
      clearInterval(timer)
      if(res.estado!=='incerto')removerPedidoPendente()
      estado.value=res.estado==='enviado'?'concluido':'erro'
      mensagem.value=mensagemEstadoEnvio(res)
    }
  }catch{}
}
function adoptarPlanoRemoto(){
  if(!planoRemoto.value)return
  const confirmar= !plano.value || window.confirm('Deseja abrir a versão recebida por e-mail? O plano actual fica disponível no histórico com o seu progresso.')
  if(!confirmar)return
  if (!guardarPlano(planoRemoto.value.plano, { confirmado: true, perfilPlano: planoRemoto.value.perfil })) return
  planoRemoto.value=null
  mensagem.value='O plano recebido por e-mail está disponível para acompanhamento.'
}
function limparFormulario() {
  versaoPedido++
  candidato.value = null
  clearInterval(timer)
  passo.value=1;email.value='';consentimento.value=false;website.value='';erro.value={};mensagem.value=''
  estado.value='parado';pedido.value=null;token.value='';planoRemoto.value=null;pedir.value=false
}
function apagarLocal() {
  if (!window.confirm('Eliminar o rascunho e o progresso abertos neste navegador? Os planos na conta e pedidos enviados ao servidor continuam guardados.')) return
  limpar()
  limparFormulario()
  removerPedidoPendente()
  try { localStorage.removeItem(chaveLocal(CHAVE_SUBMISSAO)) } catch {}
  mensagem.value = 'Rascunho aberto eliminado.'
}
function recuperarPedido() {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(chaveLocal(CHAVE_PEDIDO)) || 'null')
    if (salvo?.pedido?.id && /^[0-9a-f]{48}$/.test(salvo?.token || '')) {
      pedido.value=salvo.pedido;token.value=salvo.token
      passo.value=3;actualizarEstado()
      timer=setInterval(actualizarEstado,30000)
    }
  } catch {}
}
watch(ambito, () => { limparFormulario(); recuperarPedido() }, { flush: 'sync' })
onMounted(() => { verificarServico(); recuperarPedido() })
onUnmounted(() => { versaoPedido++; clearInterval(timer) })
</script>

<template>
  <div class="container inner-page plan-page">
    <div class="page-heading plan-heading">
      <span class="eyebrow">DESENVOLVIMENTO PROFISSIONAL</span>
      <h1>Plano de desenvolvimento personalizado</h1>
      <p>Organize um objectivo profissional em quatro semanas de actividades, através de três etapas.</p>
    </div>

    <div class="wizard-layout">
      <section class="wizard-card" aria-labelledby="formulario-titulo">
        <div class="stepper" aria-label="Etapas da criação">
          <div v-for="s in passos" :key="s.numero" class="stepper-item" :class="{ 'step-current': passo === s.numero, 'step-complete': passo > s.numero }" :aria-current="passo === s.numero ? 'step' : undefined">
            <span>{{ passo > s.numero ? '✓' : s.numero }}</span><strong>{{ s.titulo }}</strong>
          </div>
        </div>

        <form @submit.prevent="passo < 3 ? avancar() : pedirPorEmail()" novalidate>
          <div v-if="passo === 1">
            <div class="form-heading"><span class="eyebrow">PASSO 01 · PERFIL</span><h2 id="formulario-titulo">Informações do perfil</h2><p>Indique a área profissional e a situação actual.</p></div>
            <div class="field"><label for="nome">Nome de preferência <span>(opcional)</span></label><input id="nome" v-model.trim="perfil.nome" maxlength="90" autocomplete="off" placeholder="Ex.: Ana" /></div>
            <div class="field"><label for="area">Área profissional *</label><select id="area" v-model="perfil.area" :aria-invalid="Boolean(erro.area)"><option value="">Seleccione uma área</option><option v-for="a in AREAS" :key="a">{{ a }}</option></select><small v-if="erro.area" class="error-text">{{ erro.area }}</small></div>
            <div class="field"><label for="situacao">Situação actual *</label><select id="situacao" v-model="perfil.situacao" :aria-invalid="Boolean(erro.situacao)"><option value="">Seleccione a situação actual</option><option v-for="s in SITUACOES" :key="s">{{ s }}</option></select><small v-if="erro.situacao" class="error-text">{{ erro.situacao }}</small></div>
            <button type="submit" class="btn btn-primary full-button">Continuar <span aria-hidden="true">↗</span></button>
          </div>

          <div v-else-if="passo === 2">
            <div class="form-heading"><span class="eyebrow">PASSO 02 · OBJECTIVO</span><h2 id="formulario-titulo">Definição do objectivo</h2><p>Descreva o resultado pretendido e indique a disponibilidade semanal.</p></div>
            <div class="field"><label for="objetivo">Objectivo para os próximos 30 dias *</label><textarea id="objetivo" v-model.trim="perfil.objetivo" maxlength="450" rows="3" placeholder="Ex.: Preparar um portefólio para candidaturas de estágio." :aria-invalid="Boolean(erro.objetivo)" /><small v-if="erro.objetivo" class="error-text">{{ erro.objetivo }}</small><small class="field-hint">{{ perfil.objetivo.length }}/450 caracteres</small></div>
            <div class="field-grid"><div class="field"><label for="disponibilidade">Tempo por semana *</label><select id="disponibilidade" v-model="perfil.disponibilidade"><option v-for="x in DISPONIBILIDADES" :key="x">{{ x }}</option></select></div><div class="field"><label for="internet">Acesso à Internet *</label><select id="internet" v-model="perfil.internet"><option v-for="x in INTERNET" :key="x">{{ x }}</option></select></div></div>
            <details class="form-disclosure"><summary>Informações adicionais <span>(opcional)</span></summary><div class="form-disclosure-content"><div class="field"><label for="competencias">Competências existentes</label><textarea id="competencias" v-model.trim="perfil.competencias" maxlength="300" rows="2" placeholder="Ex.: JavaScript básico, trabalhar em equipa…" /><small v-if="erro.competencias" class="error-text">{{ erro.competencias }}</small></div><div class="field"><label for="dificuldade">Maior dificuldade</label><textarea id="dificuldade" v-model.trim="perfil.dificuldade" maxlength="450" rows="2" placeholder="Ex.: Pouco tempo livre ou Internet limitada." /><small v-if="erro.dificuldade" class="error-text">{{ erro.dificuldade }}</small></div></div></details>
            <div class="wizard-actions"><button type="button" class="btn btn-outline" @click="voltar">← Voltar</button><button type="submit" class="btn btn-primary">Continuar ↗</button></div>
          </div>

          <div v-else>
            <div class="form-heading"><span class="eyebrow">PASSO 03 · CONFIRMAÇÃO</span><h2 id="formulario-titulo">Revisão e criação do plano</h2><p>Revise as informações antes de gerar o plano. Não é necessário criar uma conta.</p></div>
            <div class="review-box"><div><small>ÁREA</small><strong>{{ perfil.area }}</strong></div><div><small>OBJECTIVO</small><strong>{{ perfil.objetivo }}</strong></div><div><small>TEMPO</small><strong>{{ perfil.disponibilidade }}</strong></div></div>
            <button class="btn btn-primary full-button" type="button" :disabled="ocupado" @click="criarPrevia">Gerar plano ↗</button>
            <p class="form-helper">O plano inicial é gerado no navegador, sem recurso a serviços externos de IA.</p>
            <details class="optional-panel"><summary>Solicitar envio por e-mail <span aria-hidden="true">⌄</span></summary><div class="optional-panel-content"><p>O envio é opcional. Será enviada uma confirmação e, posteriormente, uma ligação privada para descarregar o PDF.</p><div class="hp-field" aria-hidden="true"><label for="website">Não preencher<input id="website" v-model="website" type="text" autocomplete="off" tabindex="-1" /></label></div><div class="field"><label for="email">Endereço de e-mail</label><input id="email" v-model.trim="email" type="email" placeholder="nome@exemplo.com" autocomplete="email" :aria-invalid="Boolean(erro.email)" /><small v-if="erro.email" class="error-text">{{ erro.email }}</small></div><label class="choice-label"><input v-model="perfil.usarIA" type="checkbox" /><span><strong>Personalização com IA Gemini (opcional)</strong><small>Se esta opção for activada, a área, a situação, o objectivo, as competências e as dificuldades poderão ser enviados à Google. O endereço de e-mail não é partilhado com a IA. Se o serviço estiver indisponível, será utilizada a geração de plano sem IA.</small></span></label><label class="choice-label choice-consent"><input v-model="consentimento" type="checkbox" :aria-invalid="Boolean(erro.consentimento)" /><span>Autorizo o tratamento dos meus dados para receber os dois e-mails. Sei que este plano não garante emprego.</span></label><small v-if="erro.consentimento" class="error-text">{{ erro.consentimento }}</small><p class="integration-notice" role="status">{{ descricaoServico }}</p><button type="submit" class="btn btn-outline full-button" :disabled="loading || !enviarDisponivel">{{ loading ? 'A enviar…' : 'Confirmar pedido de envio' }}</button></div></details>
            <div class="wizard-actions final-actions"><button type="button" class="text-button" @click="voltar">← Rever informações</button><button type="button" class="text-button danger" @click="apagarLocal">Limpar dados locais</button></div>
          </div>
          <div v-if="candidato" class="remote-choice">
            <p>Pretende abrir um novo plano? O plano actual e o respectivo progresso ficam disponíveis no histórico.</p>
            <div class="rc-actions">
              <button type="button" class="btn btn-primary" :disabled="ocupado" @click="confirmarNovoPlano">Confirmar novo plano</button>
              <button type="button" class="btn btn-outline" @click="candidato = null">Cancelar</button>
            </div>
          </div>
          <div v-if="planoRemoto" class="remote-choice" role="status"><strong>A versão recebida por e-mail apresenta actividades diferentes.</strong><p>O plano actual foi preservado. É possível adoptar a versão recebida mediante confirmação.</p><button type="button" class="btn btn-outline" @click="adoptarPlanoRemoto">Adoptar plano recebido</button></div><p v-if="mensagem" class="feedback" :class="{ 'feedback-error': estado === 'erro' }" :role="estado === 'erro' ? 'alert' : 'status'">{{ mensagem }}</p>
          <div v-if="pedido" class="sent-status" :class="{ 'sent-status-warning': pedido.estado === 'incerto' || pedido.estado === 'falhou' }" role="status"><strong>Estado: {{ estadoLegivel }}</strong><p>Envio previsto: {{ new Date(pedido.agendadoPara).toLocaleString('pt-MZ') }}. O navegador pode ser fechado.</p><button type="button" class="text-button" @click="actualizarEstado">Actualizar estado ↻</button></div>
        </form>
      </section>

      <aside class="wizard-side">
        <div class="side-top"><span class="eyebrow">ESTRUTURA DO PLANO</span><h2>Actividades <em>organizadas por etapas.</em></h2></div>
        <div class="side-benefits"><div><span aria-hidden="true">01</span><p><strong>4 semanas</strong><small>Objectivos e actividades por semana.</small></p></div><div><span aria-hidden="true">02</span><p><strong>Actividades planeadas</strong><small>Distribuição de tempo por actividade.</small></p></div><div><span aria-hidden="true">03</span><p><strong>Documento e progresso</strong><small>Descarregue o PDF e registe as tarefas concluídas.</small></p></div></div>
        <p class="side-privacy">O rascunho é guardado neste navegador. Se tiver sessão, pode guardar o plano na conta. O e-mail só é utilizado mediante pedido de envio.</p>
      </aside>
    </div>

    <section v-if="plano" class="plan-result" aria-labelledby="resultado-titulo">
      <p v-if="desactualizado" class="feedback feedback-error" role="status">As informações foram alteradas após a criação do plano. Pode gerar um plano para o novo objectivo e continuar a consultar o anterior no histórico.</p>
      <div class="plan-result-head"><div><span class="eyebrow">PLANO DISPONÍVEL</span><h2 id="resultado-titulo">{{ plano.titulo }}</h2><p>{{ plano.diagnostico }}</p></div><div class="plan-result-actions"><RouterLink class="btn btn-primary" to="/progresso">Acompanhar actividades ↗</RouterLink><button type="button" class="btn btn-outline" @click="descarregar">Descarregar PDF ↓</button></div></div>
      <div v-if="conta.utilizador" class="rc-actions">
        <button type="button" class="btn btn-outline" :disabled="ocupado" @click="guardarNaConta">Guardar plano na conta</button>
        <p v-if="estadoSync" role="status">{{ estadoSync }}</p>
      </div>
      <div class="week-overview"><div v-for="s in plano.semanas" :key="s.numero" class="week-overview-item"><span>SEMANA {{ String(s.numero).padStart(2, '0') }}</span><strong>{{ s.titulo }}</strong><small>{{ s.minutosSugeridos }} minutos de actividades</small></div></div>
    </section>
  </div>
</template>
