<script setup>
import { onMounted, ref } from 'vue'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { conta } from '../services/supabase.js'
import { consultar, lerPessoal, pesquisarOportunidades, rpc } from '../services/dados.js'
import { ordenarCorrespondencias } from '../../shared/rumomatch.js'
import { dataLegivel } from '../../shared/oportunidades.js'

const notificacoes = ref([])
const pagina = ref(0)
const temMais = ref(false)
const tamanho = 20
const { carregando, erro, mensagem, executar } = useRecurso()
const tipos = { rumomatch: 'Correspondência', prazo: 'Prazo', tarefa: 'Tarefa' }

async function listar(indice = pagina.value) {
  const id = conta.utilizador.id
  return consultar(db => db.from('notificacoes').select('*').eq('utilizador', id)
    .order('id', { ascending: false }).range(indice * tamanho, (indice + 1) * tamanho - 1))
}
function aplicar(dados, indice) {
  notificacoes.value = dados
  pagina.value = indice
  temMais.value = dados.length === tamanho
}
function carregar(indice = pagina.value) { executar(() => listar(indice), dados => aplicar(dados, indice)) }
async function actualizar() {
  if (await executar(async () => {
    const [perfil, preferencias] = await Promise.all([lerPessoal('perfis'), lerPessoal('preferencias')])
    const oportunidades = perfil ? await pesquisarOportunidades({}, 0, 100) : []
    const ids = perfil ? ordenarCorrespondencias(perfil, preferencias || {}, oportunidades)
      .filter(c => c.aptaParaAlerta).slice(0, 30).map(c => c.oportunidade.id) : []
    await rpc('materializar_alertas', { p_correspondencias: ids })
    return listar(0)
  }, dados => aplicar(dados, 0), 'Não foi possível actualizar os alertas.')) mensagem.value = 'Alertas actualizados.'
}
async function marcar(id = null) {
  await executar(async () => {
    await rpc('marcar_notificacoes', id == null ? {} : { p_id: id })
    return listar()
  }, dados => aplicar(dados, pagina.value), 'Não foi possível marcar a notificação.')
}
onMounted(() => carregar(0))
</script>

<template>
  <section class="container inner-page rc-page">
    <RouterLink to="/conta" class="back-link">Voltar à área pessoal</RouterLink>
    <header class="page-heading"><h1>Notificações</h1><p>Veja os alertas de oportunidades, prazos e tarefas do plano.</p></header>
    <div class="rc-actions">
      <button class="btn btn-primary" :disabled="carregando" @click="actualizar">Actualizar alertas</button>
      <button class="btn btn-outline" :disabled="carregando || !notificacoes.some(n => !n.lida_em)" @click="marcar()">Marcar todas como lidas</button>
      <RouterLink to="/conta/definicoes" class="text-link">Preferências</RouterLink>
    </div>
    <EstadoRecurso :carregando="carregando" :erro="erro" :mensagem="mensagem" :vazio="notificacoes.length ? '' : 'Nenhuma notificação nesta página.'" repetir @repetir="carregar()" />
    <div class="rc-card-grid">
      <article v-for="item in notificacoes" :key="item.id" class="surface rc-card">
        <p class="rc-tag">{{ tipos[item.tipo] }} · {{ item.lida_em ? 'Lida' : 'Por ler' }}</p>
        <h2>{{ item.titulo }}</h2><p>{{ dataLegivel(item.criada_em) }}</p>
        <div class="rc-actions">
          <RouterLink v-if="item.oportunidade_id" :to="{ name: 'oportunidade', params: { id: item.oportunidade_id } }">Ver oportunidade</RouterLink>
          <RouterLink v-if="item.tipo === 'tarefa'" :to="{ name: 'progresso', query: { plano: item.chave.split(':')[1] } }">Ver plano</RouterLink>
          <button v-if="!item.lida_em" type="button" class="text-button" :disabled="carregando" @click="marcar(item.id)">Marcar como lida</button>
        </div>
      </article>
    </div>
    <nav v-if="pagina || temMais" class="rc-actions" aria-label="Páginas de notificações">
      <button class="btn btn-outline" :disabled="!pagina || carregando" @click="carregar(pagina - 1)">Anterior</button><span>Página {{ pagina + 1 }}</span>
      <button class="btn btn-outline" :disabled="!temMais || carregando" @click="carregar(pagina + 1)">Seguinte</button>
    </nav>
  </section>
</template>
