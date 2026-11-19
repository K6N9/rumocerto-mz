<script setup>
import { ref, watch } from 'vue'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { dataLegivel, ESCOLARIDADES, ligacaoHttps, prazoLegivel } from '../../shared/oportunidades.js'
import { conta, contaConfigurada } from '../services/supabase.js'
import { consultar, consultarAnuncioLocal, consultarOportunidade } from '../services/dados.js'

const props = defineProps({ id: { type: String, required: true } })
const oportunidade = ref(null)
const copia = ref(false)
const favorito = ref(false)
const processo = ref(false)
const erroFavorito = ref('')
const { carregando, erro, executar } = useRecurso()

function carregar() {
  oportunidade.value = null
  favorito.value = false
  const id = props.id
  const utilizador = conta.utilizador?.id
  executar(async () => {
    const anuncio = await consultarOportunidade(id)
    const guardado = anuncio && utilizador
      ? await consultar(db => db.from('favoritos').select('oportunidade_id').eq('utilizador', utilizador).eq('oportunidade_id', id).maybeSingle())
      : null
    const local = !anuncio && contaConfigurada ? await consultarAnuncioLocal(id) : null
    return { anuncio: anuncio || local, guardado, copia: Boolean(local) }
  }, dados => {
    oportunidade.value = dados.anuncio
    favorito.value = Boolean(dados.guardado)
    copia.value = dados.copia
  })
}

watch(() => [props.id, conta.utilizador?.id], carregar, { immediate: true })

async function alternarFavorito() {
  if (processo.value || !conta.utilizador || !oportunidade.value || copia.value) return
  const utilizador = conta.utilizador.id
  const id = props.id
  processo.value = true
  erroFavorito.value = ''
  try {
    if (favorito.value) await consultar(db => db.from('favoritos').delete().eq('utilizador', utilizador).eq('oportunidade_id', id))
    else await consultar(db => db.from('favoritos').upsert({ utilizador, oportunidade_id: id }, { ignoreDuplicates: true }))
    if (props.id === id && conta.utilizador?.id === utilizador) favorito.value = !favorito.value
  } catch { erroFavorito.value = 'Não foi possível actualizar o favorito.' }
  finally { processo.value = false }
}
</script>

<template>
  <section class="container inner-page rc-page">
    <RouterLink to="/oportunidades" class="back-link">Voltar às oportunidades</RouterLink>
    <EstadoRecurso :carregando="carregando" :erro="erro" :vazio="oportunidade ? '' : 'Oportunidade indisponível ou por verificar.'" repetir @repetir="carregar" />
    <template v-if="oportunidade">
      <p v-if="copia" class="rc-status" role="status">Anúncio da última revisão do catálogo local. Consulte a fonte para confirmar as condições actuais.</p>
      <header class="page-heading">
        <p class="rc-tag">{{ oportunidade.tipo }}</p>
        <h1>{{ oportunidade.titulo }}</h1><p>{{ oportunidade.entidade }}</p>
      </header>
      <article class="surface rc-panel">
        <dl class="rc-meta rc-meta-wide">
          <div><dt>Área</dt><dd>{{ oportunidade.area || 'Por indicar' }}</dd></div>
          <div><dt>Localização</dt><dd>{{ [oportunidade.localidade, oportunidade.provincia].filter(Boolean).join(', ') || 'Por indicar' }}</dd></div>
          <div><dt>Modalidade</dt><dd>{{ oportunidade.modalidade || 'Por indicar' }}</dd></div>
          <div><dt>Escolaridade mínima</dt><dd>{{ ESCOLARIDADES[oportunidade.escolaridade - 1] || 'Por indicar' }}</dd></div>
          <div><dt>Experiência mínima</dt><dd>{{ oportunidade.experiencia_meses == null ? 'Por indicar' : oportunidade.experiencia_meses + ' meses' }}</dd></div>
          <div><dt>Publicada</dt><dd>{{ dataLegivel(oportunidade.data_publicacao) }}</dd></div>
          <div><dt>Prazo</dt><dd>{{ prazoLegivel(oportunidade) }}</dd></div>
          <div><dt>Última verificação</dt><dd>{{ dataLegivel(oportunidade.verificada_em) }}</dd></div>
          <div><dt>Validade</dt><dd>Activa na última revisão</dd></div>
        </dl>
        <h2>Descrição</h2><p class="rc-texto">{{ oportunidade.descricao }}</p>
        <section v-for="[titulo, lista] in [['Requisitos', oportunidade.requisitos], ['Competências', oportunidade.competencias], ['Competências obrigatórias', oportunidade.competencias_obrigatorias]]" :key="titulo">
          <h2>{{ titulo }}</h2><ul v-if="lista.length"><li v-for="texto in lista" :key="texto">{{ texto }}</li></ul><p v-else>Por indicar.</p>
        </section>
        <p>Fonte: <a v-if="ligacaoHttps(oportunidade.url_original)" :href="ligacaoHttps(oportunidade.url_original)" target="_blank" rel="noopener noreferrer">{{ oportunidade.fonte_nome }} · anúncio original</a></p>
        <p v-if="erroFavorito" class="rc-error" role="alert">{{ erroFavorito }}</p>
        <div v-if="!copia" class="rc-actions">
          <a v-if="ligacaoHttps(oportunidade.url_candidatura)" class="btn btn-primary" :href="ligacaoHttps(oportunidade.url_candidatura)" target="_blank" rel="noopener noreferrer">Candidatar-se na fonte</a>
          <button v-if="conta.utilizador" class="btn btn-outline" :disabled="processo" :aria-pressed="favorito" @click="alternarFavorito">{{ favorito ? 'Remover favorito' : 'Guardar favorito' }}</button>
          <RouterLink v-if="conta.utilizador" class="btn btn-outline" :to="{ name: 'candidaturas', query: { oportunidade: oportunidade.id } }">Registar candidatura</RouterLink>
          <RouterLink v-else class="text-link" :to="{ name: 'entrar', query: { destino: '/oportunidades/' + oportunidade.id } }">Entrar para guardar</RouterLink>
        </div>
      </article>
    </template>
  </section>
</template>
