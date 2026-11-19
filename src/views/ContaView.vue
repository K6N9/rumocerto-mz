<script setup>
import { onMounted, ref } from 'vue'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { usePlano } from '../composables/usePlano.js'
import { consultar, lerPessoal, verificarAdmin } from '../services/dados.js'
import { conta } from '../services/supabase.js'

const atalhos = [
  ['perfil', 'Perfil profissional', 'Actualize competências e preferências.'],
  ['oportunidades', 'Central de oportunidades', 'Consulte anúncios de fontes verificadas.'],
  ['rumomatch', 'RumoMatch', 'Veja os critérios de correspondência com o seu perfil.'],
  ['favoritos', 'Favoritos', 'Reveja as oportunidades que guardou.'],
  ['cv', 'Currículo', 'Edite e descarregue o seu CV.'],
  ['candidaturas', 'Candidaturas', 'Registe datas, notas e estados.'],
  ['preparacao', 'Preparação profissional', 'Prepare documentos e pratique entrevistas.'],
  ['notificacoes', 'Notificações', 'Consulte alertas de prazos, tarefas e correspondências.'],
  ['definicoes', 'Definições de conta', 'Gerir preferências de e-mail e dados pessoais.']
]
const nome = ref('')
const admin = ref(false)
const planos = ref([])
const { plano, progresso } = usePlano()
const { carregando, erro, executar } = useRecurso()

function carregar() {
  const id = conta.utilizador.id
  executar(() => Promise.all([
    lerPessoal('perfis', 'nome'), verificarAdmin(),
    consultar(db => db.from('planos').select('id,titulo').eq('utilizador', id).order('actualizado_em', { ascending: false }).limit(5))
  ]), ([perfil, permitido, registos]) => { nome.value = perfil?.nome || ''; admin.value = permitido; planos.value = registos })
}
onMounted(carregar)
</script>

<template>
  <section class="container inner-page rc-page">
    <header class="page-heading"><h1>{{ nome ? 'Olá, ' + nome : 'Área pessoal' }}</h1><p>Acompanhe a sua preparação e as oportunidades que lhe interessam.</p></header>
    <EstadoRecurso :carregando="carregando" :erro="erro" repetir @repetir="carregar" />
    <article class="surface rc-panel">
      <h2>Plano de desenvolvimento</h2>
      <p v-if="plano">{{ plano.titulo }} · {{ progresso.percentagem }}% concluído</p>
      <ul v-if="planos.length">
        <li v-for="item in planos" :key="item.id"><RouterLink :to="{ name: 'progresso', query: { plano: item.id } }">{{ item.titulo }}</RouterLink></li>
      </ul>
      <div class="rc-actions">
        <RouterLink to="/plano" class="btn btn-primary">Criar plano</RouterLink>
        <RouterLink to="/progresso" class="btn btn-outline">Acompanhar progresso</RouterLink>
      </div>
    </article>
    <div class="rc-card-grid">
      <article v-for="[destino, titulo, descricao] in atalhos" :key="destino" class="surface rc-card">
        <h2><RouterLink :to="{ name: destino }">{{ titulo }}</RouterLink></h2><p>{{ descricao }}</p>
      </article>
      <article v-if="admin" class="surface rc-card"><h2><RouterLink to="/admin">Administração</RouterLink></h2><p>Gerir catálogo e consultar os serviços.</p></article>
    </div>
  </section>
</template>
