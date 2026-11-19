<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { conta } from '../services/supabase.js'
import { consultar } from '../services/dados.js'
import { usePlano } from '../composables/usePlano.js'
import WeekCard from '../components/WeekCard.vue'
import { gerarPdf, gerarPdfUnicode } from '../../shared/pdf.js'
const { perfil, perfilDoPlano, plano, concluidas, progresso, alternarTarefa,
  guardarNaConta, abrirPlano, importarLocal, importavel, estadoSync, ocupado, identificador, historico, abrirAnterior, convertivel, converterPlano } = usePlano()
const rota = useRoute()
const router = useRouter()
const confirmarConversao = ref(false)
const mensagemConversao = ref('')
watch(plano, () => { confirmarConversao.value = false })
function limparSeleccao() {
  if (rota.query.plano) router.replace({ query: { ...rota.query, plano: undefined } })
}
function abrirDoHistorico(indice) {
  if (!abrirAnterior(indice)) return
  mensagemConversao.value = ''
  limparSeleccao()
}
function confirmarPlanoDiario() {
  if (!converterPlano()) return
  limparSeleccao()
  confirmarConversao.value = false
  mensagemConversao.value = 'Plano convertido. As conclusões das actividades preservadas foram transferidas. O plano original está no histórico.'
}
const anteriores = ref([])
const erroAnteriores = ref('')
const paginaPlanos = ref(0)
const maisPlanos = ref(false)
const porPagina = 12
async function listar(pagina = paginaPlanos.value) {
  const id = conta.utilizador?.id
  if (!id) { anteriores.value = []; return }
  erroAnteriores.value = ''
  try {
    const resultado = await consultar(db => db.from('planos').select('id,titulo,actualizado_em')
      .eq('utilizador', id).order('actualizado_em', { ascending: false }).order('id')
      .range(pagina * porPagina, (pagina + 1) * porPagina - 1))
    if (conta.utilizador?.id === id) {
      anteriores.value = resultado
      paginaPlanos.value = pagina
      maisPlanos.value = resultado.length === porPagina
    }
  } catch { if (conta.utilizador?.id === id) erroAnteriores.value = 'Não foi possível carregar os planos anteriores.' }
}
function seleccionar(id) {
  if (id === identificador.value || ocupado.value) return
  abrirPlano(id)
}
async function guardar() { if (await guardarNaConta()) listar(0) }
watch(() => conta.utilizador?.id, () => listar(0), { immediate: true })
watch(() => [rota.query.plano, conta.utilizador?.id], ([id, utilizador]) => {
  if (utilizador && typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) seleccionar(id)
}, { immediate: true })
const proxima = computed(() => {
  if (!plano.value) return null
  for (const semana of plano.value.semanas) for (const [i,tarefa] of semana.tarefas.entries()) {
    if (!concluidas.value.includes(`${semana.numero - 1}-${i}`)) return { semana: semana.numero, tarefa, duracao: semana.minutosPorTarefa?.[i] }
  }
  return null
})
const semanaActual = computed(() => {
  if (!plano.value) return 1
  const primeira = plano.value.semanas.find(s => s.tarefas.some((_, i) => !concluidas.value.includes(`${s.numero - 1}-${i}`)))
  return primeira?.numero || 4
})
async function descarregar() {
  if (!plano.value) return
  let pdf
  try { pdf = await gerarPdfUnicode(perfilDoPlano.value || perfil.value, plano.value) }
  catch { pdf = gerarPdf(perfilDoPlano.value || perfil.value, plano.value) }
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'RumoCerto_MZ_Plano_30_Dias.pdf'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
</script>

<template>
  <div class="container inner-page progress-page">
    <div class="page-heading">
      <span class="eyebrow">ACOMPANHAMENTO</span>
      <h1>Progresso do plano</h1>
      <p>Consulte as actividades por semana e assinale as tarefas concluídas.</p>
    </div>
    <section v-if="conta.utilizador" class="surface rc-panel rc-planos">
      <h2>Planos da conta</h2>
      <p v-if="estadoSync" role="status">{{ estadoSync }}</p>
      <p v-if="erroAnteriores" class="rc-error" role="alert">{{ erroAnteriores }} <button class="text-button" @click="listar()">Tentar novamente</button></p>
      <div class="rc-actions">
        <button v-if="plano" type="button" class="btn btn-primary" :disabled="ocupado" @click="guardar">Guardar plano na conta</button>
        <button v-if="importavel && !plano" type="button" class="btn btn-outline" :disabled="ocupado" @click="importarLocal">Abrir plano deste navegador</button>
      </div>
      <ul v-if="anteriores.length">
        <li v-for="registo in anteriores" :key="registo.id"><button class="text-button" :disabled="ocupado || registo.id === identificador" @click="seleccionar(registo.id)">{{ registo.titulo }}{{ registo.id === identificador ? ' · aberto' : '' }}</button></li>
      </ul>
      <div v-if="paginaPlanos || maisPlanos" class="rc-actions">
        <button class="btn btn-outline" :disabled="!paginaPlanos" @click="listar(paginaPlanos - 1)">Anteriores</button>
        <button class="btn btn-outline" :disabled="!maisPlanos" @click="listar(paginaPlanos + 1)">Mais planos</button>
      </div>
    </section>
    <section v-if="historico.length" class="surface rc-panel rc-planos">
      <h2>Histórico desta sessão ou navegador</h2>
      <ul>
        <li v-for="(anterior, indice) in historico" :key="indice">
          <button type="button" class="text-button" :disabled="ocupado" @click="abrirDoHistorico(indice)">{{ anterior.dados.plano.titulo }} · {{ anterior.dados.plano.semanas.flatMap(s => s.tarefas).length }} tarefas</button>
        </li>
      </ul>
    </section>
    <p v-if="mensagemConversao" class="feedback" role="status">{{ mensagemConversao }}</p>
    <template v-if="plano">
      <section v-if="convertivel" class="surface rc-panel rc-planos">
        <h2>Plano de 20 tarefas</h2>
        <p>Pode continuar este plano ou criar uma versão com 30 tarefas.</p>
        <button v-if="!confirmarConversao" type="button" class="btn btn-outline" :disabled="ocupado" @click="confirmarConversao = true; mensagemConversao = ''">Converter para 30 tarefas</button>
        <div v-else>
          <p>A conversão mantém o plano original no histórico. Só as actividades copiadas conservam as conclusões.</p>
          <div class="rc-actions">
            <button type="button" class="btn btn-primary" :disabled="ocupado" @click="confirmarPlanoDiario">Confirmar conversão</button>
            <button type="button" class="btn btn-outline" @click="confirmarConversao = false">Cancelar conversão</button>
          </div>
        </div>
      </section>
      <section class="progress-summary">
        <div><span class="eyebrow">PLANO DE 30 DIAS</span><h2>{{ plano.titulo }}</h2><p>{{ progresso.feitas }} de {{ progresso.total }} tarefas concluídas</p></div>
        <div class="progress-figure"><strong>{{ progresso.percentagem }}%</strong><span>concluído</span></div>
        <div class="progress-track" role="progressbar" :aria-valuenow="progresso.percentagem" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso do plano"><div :style="{ width: progresso.percentagem + '%' }"></div></div>
      </section>
      <section v-if="proxima" class="next-task" aria-label="A próxima actividade">
        <div class="next-task-icon" aria-hidden="true">↗</div>
        <div><span class="eyebrow">A SEGUIR · SEMANA {{ proxima.semana }}</span><h3>{{ proxima.tarefa }}</h3><p v-if="proxima.duracao">Tempo sugerido: {{ proxima.duracao }} minutos</p></div>
      </section>
      <div v-else class="progress-complete" role="status"><strong>Plano concluído</strong><p>Reveja os resultados alcançados e defina o próximo objectivo.</p></div>
      <div class="progress-actions">
        <span class="progress-hint">Seleccione uma semana para consultar as actividades.</span>
        <div class="progress-action-buttons"><RouterLink to="/plano" class="text-link">Rever objectivo</RouterLink><button type="button" class="btn btn-outline" @click="descarregar">Descarregar PDF ↓</button></div>
      </div>
      <div class="week-grid">
        <WeekCard v-for="s in plano.semanas" :key="s.numero" :semana="s" :concluidas="concluidas" interactivo :inicialmente-aberta="s.numero === semanaActual" @alternar="alternarTarefa" />
      </div>
    </template>
    <section v-else class="surface empty-plano"><div class="empty-icon" aria-hidden="true">↗</div><h2>Ainda não existe um plano</h2><p>Crie um plano de desenvolvimento para acompanhar as actividades e a evolução semanal.</p><RouterLink to="/plano" class="btn btn-primary">Criar plano ↗</RouterLink></section>
  </div>
</template>
