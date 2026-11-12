<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { usePlano } from '../composables/usePlano.js'
import { recursos } from '../data/recursos.js'
import { AREAS, SITUACOES, DISPONIBILIDADES, INTERNET, validarPedido, construirPlanoBase } from '../../backend/src/planner.js'
import { criarPDF } from '../../backend/src/pdf.js'

const rota = useRoute()
const { plano, foiGuardado, limpar } = usePlano()
const email = ref('')
const consentimento = ref(false)
const website = ref('')
const erros = ref({})
const estado = ref('parado')
const mensagem = ref('')
const gerado = ref(null)
const trabalho = ref(null)
const token = ref('')
const backend = String(import.meta.env.VITE_WORKER_URL || '').replace(/\/$/,'')
let timer = null
const areaRecurso = computed(() => recursos.find(r=>r.id===plano.recursoId) || recursos[0])
watch(()=>rota.query.recurso,id=>{if(recursos.some(r=>r.id===id))plano.recursoId=id},{immediate:true})
function pedido(){return {
  nome:plano.nome, email:email.value.trim(), area:plano.area, situacao:plano.situacao,
  disponibilidade:plano.disponibilidade, internet:plano.internet, objetivo:plano.objetivo,
  competencias:plano.competencias, dificuldade:plano.dificuldade, consentimento:consentimento.value, website:website.value,
}}
function verificar(){erros.value=validarPedido(pedido());return Object.keys(erros.value).length===0}
function criarPrevia(){
  if(!plano.area || !plano.situacao || (plano.objetivo||'').trim().length<12){mensagem.value='Indica área, situação e objectivo (mínimo de 12 caracteres) para visualizar uma prévia.';return}
  gerado.value=construirPlanoBase(plano)
  mensagem.value='Prévia gratuita criada no navegador. Para receber dois e-mails, configura o Worker no servidor.'
  estado.value='previa'
}
async function pedirPlano(){
  mensagem.value=''
  if(!verificar()){mensagem.value='Verifica os campos assinalados.';estado.value='erro';return}
  if(!backend){mensagem.value='O backend de envios agendados ainda não foi configurado. Podes criar uma prévia local e descarregar o PDF.';estado.value='erro';return}
  estado.value='enviando'
  try {
    const resposta=await fetch(backend+'/api/planos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pedido())})
    const conteudo=await resposta.json()
    if(!resposta.ok){erros.value=conteudo.erros||{};throw new Error(conteudo.erro||'Não foi possível criar o plano.')}
    gerado.value=conteudo.plano
    trabalho.value={id:conteudo.id,agendadoPara:conteudo.agendadoPara,estado:conteudo.estado}
    token.value=conteudo.token
    estado.value='agendado'
    mensagem.value='O EmailJS aceitou o primeiro e-mail. Verifica a recepção na caixa de entrada. O segundo envio foi agendado para aproximadamente 5 a 7 minutos após o pedido. Podes fechar o navegador.'
    email.value=''
    if(timer)clearInterval(timer)
    timer=setInterval(consultarEstado,30000)
  }catch(e){estado.value='erro';mensagem.value=e.message}
}
async function consultarEstado(){
  if(!trabalho.value || !backend || !token.value)return
  try{
    const r=await fetch(`${backend}/api/planos/${trabalho.value.id}?token=${token.value}`)
    if(!r.ok)return
    const dados=await r.json()
    trabalho.value.estado=dados.estado
    if(dados.estado==='enviado'){estado.value='concluido';mensagem.value='O EmailJS aceitou o segundo envio. Confirma a recepção na caixa de entrada ou no spam.';clearInterval(timer)}
    if(dados.estado==='falhou'){estado.value='erro';mensagem.value='O envio final falhou após as tentativas. O PDF continua disponível nesta página.';clearInterval(timer)}
  }catch{/* Indicador de estado facultativo; o envio continua no servidor. */}
}
function limparTudo(){
  limpar();email.value='';consentimento.value=false;website.value='';erros.value={};gerado.value=null;trabalho.value=null;token.value='';estado.value='parado';mensagem.value='';if(timer)clearInterval(timer)
}
function descarregar(){
  if(!gerado.value)return
  const bytes=criarPDF(plano,gerado.value)
  const blob=new Blob([bytes],{type:'application/pdf'})
  const href=URL.createObjectURL(blob)
  const a=document.createElement('a');a.href=href;a.download='RumoCerto_MZ_Plano_30_Dias.pdf';a.click()
  setTimeout(()=>URL.revokeObjectURL(href),30000)
}
onUnmounted(()=>{if(timer)clearInterval(timer)})
</script>
<template>
  <div class="container inner-page">
    <div class="page-heading"><span class="eyebrow section-kicker">ORIENTAÇÃO PROFISSIONAL PERSONALIZADA</span><h1>O teu plano de carreira, à tua medida.</h1><p>Descreve a tua realidade. Recebe um primeiro e-mail de confirmação e, aproximadamente 5 a 7 minutos depois, uma ligação privada para descarregar o plano de 30 dias em PDF. A prévia local funciona mesmo sem serviços externos.</p></div>
    <div class="plan-layout">
      <section class="plan-form-card" aria-labelledby="dados-titulo">
        <div class="card-heading"><div><span class="eyebrow">ETAPA 01</span><h2 id="dados-titulo">Conta-nos sobre ti</h2></div><span class="privacy-chip">Sem pagamento</span></div>
        <form @submit.prevent="pedirPlano" novalidate>
          <div class="field"><label for="nome">Nome ou forma de tratamento (opcional)</label><input id="nome" v-model.trim="plano.nome" maxlength="90" placeholder="Como gostarias de ser tratado(a)?"/></div>
          <div class="field-grid">
            <div class="field"><label for="area">Área profissional *</label><select id="area" v-model="plano.area" :aria-invalid="Boolean(erros.area)"><option value="">Escolhe uma área</option><option v-for="a in AREAS" :key="a">{{ a }}</option></select><small class="field-error" v-if="erros.area">{{ erros.area }}</small></div>
            <div class="field"><label for="situacao">Situação actual *</label><select id="situacao" v-model="plano.situacao" :aria-invalid="Boolean(erros.situacao)"><option value="">Escolhe uma situação</option><option v-for="s in SITUACOES" :key="s">{{ s }}</option></select><small class="field-error" v-if="erros.situacao">{{ erros.situacao }}</small></div>
          </div>
          <div class="field"><label for="objetivo">Principal objectivo para os próximos 30 dias *</label><textarea id="objetivo" v-model.trim="plano.objetivo" maxlength="450" rows="3" placeholder="Ex.: montar um portefólio e preparar-me para entrevistas de estágio." :aria-invalid="Boolean(erros.objetivo)"/><small class="field-error" v-if="erros.objetivo">{{ erros.objetivo }}</small></div>
          <div class="field-grid">
            <div class="field"><label for="tempo">Tempo que tens por semana *</label><select id="tempo" v-model="plano.disponibilidade"><option v-for="op in DISPONIBILIDADES" :key="op">{{ op }}</option></select></div>
            <div class="field"><label for="acesso">Como acedes à Internet? *</label><select id="acesso" v-model="plano.internet"><option v-for="op in INTERNET" :key="op">{{ op }}</option></select></div>
          </div>
          <div class="field"><label for="competencias">O que já sabes fazer? (opcional)</label><textarea id="competencias" v-model.trim="plano.competencias" maxlength="300" rows="2" placeholder="Ex.: JavaScript básico, trabalhar em equipa, Word..."/></div>
          <div class="field"><label for="dificuldade">Qual é a maior dificuldade que enfrentas? (opcional)</label><textarea id="dificuldade" v-model.trim="plano.dificuldade" maxlength="450" rows="2" placeholder="Ex.: tenho poucas horas livres e dados móveis limitados."/></div>
          <div class="field"><label for="email">E-mail onde queres receber os dois envios *</label><input id="email" v-model.trim="email" type="email" autocomplete="email" placeholder="exemplo@email.com" :aria-invalid="Boolean(erros.email)"/><small class="field-error" v-if="erros.email">{{ erros.email }}</small></div>
          <div class="field hidden-honeypot" aria-hidden="true"><label>Deixa este campo vazio<input v-model="website" tabindex="-1" autocomplete="off"/></label></div>
          <label class="plan-consent"><input v-model="consentimento" type="checkbox"/><span>Autorizo o envio de dois e-mails com os dados que forneci. Sei que a IA é opcional, que o plano é educativo e que os dados serão processados por serviços externos quando a funcionalidade de envio estiver activa.</span></label>
          <small class="field-error" v-if="erros.consentimento">{{ erros.consentimento }}</small>
          <div class="plan-submit-actions"><button class="btn btn-primary" type="submit" :disabled="estado==='enviando'">{{ estado==='enviando'?'A criar e a confirmar…':'Pedir o plano e os 2 e-mails ↗' }}</button><button class="btn btn-outline" type="button" @click="criarPrevia">Prévia gratuita</button><button type="button" class="link-button danger-link" @click="limparTudo">Limpar dados</button></div>
          <p class="data-note">{{foiGuardado?'Dados do formulário guardados neste navegador (excepto e-mail).':'Os dados do formulário ficam neste navegador.'}} Nenhum pagamento é necessário. A geração automática pode recorrer à IA gratuita ou ao motor educativo de regras, conforme a disponibilidade.</p>
          <p v-if="mensagem" role="status" :class="estado==='erro'?'field-error':'success-message'">{{ mensagem }}</p>
        </form>
      </section>
      <aside class="plan-steps-card" aria-label="Percurso do pedido">
        <div class="card-heading"><div><span class="eyebrow">ETAPA 02</span><h2>O que vais receber</h2></div><span class="privacy-chip">30 dias</span></div>
        <div class="delivery-timeline"><div><strong>01 · Confirmação</strong><p>Logo após submeteres os dados, recebes um e-mail com as escolhas registadas.</p></div><div><strong>02 · Plano detalhado</strong><p>Aproximadamente 5 a 7 minutos depois, um segundo e-mail com quatro semanas de tarefas, metas e uma ligação privada para descarregar o PDF.</p></div><div><strong>03 · Continuidade</strong><p>Consulta o teu PDF e acompanha o progresso ao longo do mês. O plano não garante oportunidades de emprego.</p></div></div>
        <div v-if="trabalho" class="job-status" role="status"><strong>Estado do pedido: {{trabalho.estado}}</strong><p>Envio previsto: {{new Date(trabalho.agendadoPara).toLocaleString('pt-PT')}} (hora local do navegador). O servidor continua a processar mesmo que saias desta página.</p><button type="button" class="link-button" @click="consultarEstado">Actualizar estado</button></div>
        <div v-if="gerado" class="plan-preview"><span class="eyebrow">O PLANO PREPARADO</span><h3>{{gerado.titulo}}</h3><p>{{gerado.diagnostico}}</p><span class="privacy-chip">{{ gerado.metodo }}</span><div class="mini-week" v-for="s in gerado.semanas" :key="s.numero"><h4>Semana {{s.numero}} — {{s.titulo}}</h4><p>{{s.foco}}</p><ul><li v-for="(t,i) in s.tarefas" :key="i">{{t}}</li></ul><small>Entregável: {{s.entregavel}}</small></div><button type="button" class="btn btn-primary pdf-button" @click="descarregar">Descarregar PDF do plano ↓</button></div>
        <div v-else class="plan-preview-empty"><span class="eyebrow">ANTES DE COMEÇARES</span><h3>Um plano útil adapta-se à vida real.</h3><p>Não sugerimos cursos pagos, candidaturas inventadas nem metas impossíveis para quem tem pouco tempo ou acesso limitado à Internet.</p><p><strong>Fonte de contexto:</strong> indicadores de desemprego juvenil para Moçambique publicados pelo Banco Mundial; não são previsões individuais.</p></div>
      </aside>
    </div>
    <div class="section-head below-plan"><div><span class="eyebrow section-kicker">APRENDER SEM PAGAR</span><h2>Ideias práticas para começar</h2></div></div>
    <div class="resources-grid"><article class="resource-card"><span class="pill">Gratuito</span><h3>{{areaRecurso.categoria}}</h3><p>{{areaRecurso.descricao}}</p><router-link class="text-link" to="/indicadores">Contexto do mercado de trabalho ↗</router-link></article><article class="resource-card"><span class="pill">Acessível</span><h3>Estuda com pouco tráfego</h3><p>Descarrega materiais leves, reutiliza notas offline e faz sessões curtas. As sugestões foram concebidas para não exigir gastos.</p></article><article class="resource-card"><span class="pill">Prático</span><h3>Um resultado por semana</h3><p>Transforma cada bloco do plano numa evidência que consigas mostrar: documento, pequeno projecto ou resumo de aprendizagem.</p></article></div>
  </div>
</template>
