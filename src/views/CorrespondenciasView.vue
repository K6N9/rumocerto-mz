<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import OportunidadeCard from '../components/OportunidadeCard.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { conta } from '../services/supabase.js'
import { consultar, lerPessoal, pesquisarOportunidades, rpc } from '../services/dados.js'
import { ordenarCorrespondencias } from '../../shared/rumomatch.js'

const rota = useRoute()
const favoritos = computed(() => rota.name === 'favoritos')
const { carregando, erro, executar } = useRecurso()
const items = ref([])
const indisponiveis = ref([])
const semPerfil = ref(false)
const pagina = ref(0)
const mais = ref(false)
const limite = 30

function carregar(indice = pagina.value) {
  const id = conta.utilizador.id
  const soFavoritos = favoritos.value
  semPerfil.value = false
  return executar(async () => {
    if (soFavoritos) {
      const registos = await consultar(db => db.from('favoritos').select('oportunidade_id').eq('utilizador', id)
        .order('criado_em', { ascending: false }).order('oportunidade_id').range(indice * limite, (indice + 1) * limite - 1))
      if (!registos.length) return { items: [], indisponiveis: [], mais: false }
      const ids = registos.map(r => r.oportunidade_id)
      const publicadas = await consultar(db => db.from('catalogo_oportunidades').select('*').in('id', ids))
      const porId = new Map(publicadas.map(anuncio => [anuncio.id, anuncio]))
      return { items: ids.filter(chave => porId.has(chave)).map(chave => ({ oportunidade: porId.get(chave) })),
        indisponiveis: ids.filter(chave => !porId.has(chave)), mais: registos.length === limite }
    }
    const [perfil, preferencias] = await Promise.all([lerPessoal('perfis'), lerPessoal('preferencias')])
    if (!perfil) return { items: [], indisponiveis: [], semPerfil: true, mais: false }
    const oportunidades = await pesquisarOportunidades({}, indice, limite)
    const items = ordenarCorrespondencias(perfil, preferencias || {}, oportunidades)
    return { items, indisponiveis: [], mais: oportunidades.length === limite }
  }, dados => {
    items.value = dados.items
    indisponiveis.value = dados.indisponiveis
    semPerfil.value = Boolean(dados.semPerfil)
    pagina.value = indice
    mais.value = dados.mais
  })
}

function remover(id) {
  const utilizador = conta.utilizador.id
  executar(() => consultar(db => db.from('favoritos').delete().eq('oportunidade_id', id).eq('utilizador', utilizador)), () => carregar(),
    'Não foi possível remover o favorito.')
}
watch(favoritos, () => carregar(0), { immediate: true })
</script>

<template>
  <section class="container inner-page rc-page">
    <RouterLink to="/conta" class="back-link">Voltar à área pessoal</RouterLink>
    <header class="page-heading">
      <h1>{{ favoritos ? 'Favoritos' : 'RumoMatch' }}</h1>
      <p v-if="!favoritos">Compare o seu perfil com anúncios verificados. A correspondência não garante contratação.</p>
    </header>
    <EstadoRecurso :carregando="carregando" :erro="erro" :vazio="items.length || indisponiveis.length ? '' : (semPerfil ? 'Preencha o perfil para calcular correspondências.' : 'Ainda não existem resultados nesta página.')" repetir @repetir="carregar()" />
    <RouterLink v-if="semPerfil" class="btn btn-primary" to="/conta/perfil">Preencher perfil</RouterLink>
    <div v-if="!carregando && !erro" class="rc-card-grid">
      <OportunidadeCard v-for="item in items" :key="item.oportunidade.id" :oportunidade="item.oportunidade">
        <button v-if="favoritos" class="text-button" @click="remover(item.oportunidade.id)">Remover favorito</button>
        <template v-else>
          <p><strong>{{ item.pontuacao }} de 100 pontos</strong> · {{ item.cobertura }}% dos critérios ponderados com dados</p>
          <details>
            <summary>Como foi calculado?</summary>
            <ul class="rc-match">
              <li v-for="criterio in item.criterios" :key="criterio.nome"><strong>{{ criterio.nome }}</strong> · {{ criterio.estado }}<small>{{ criterio.detalhe }} · {{ criterio.peso }} pontos possíveis</small></li>
            </ul>
            <ul v-if="item.recomendacoes.length"><li v-for="texto in item.recomendacoes" :key="texto">{{ texto }}</li></ul>
          </details>
        </template>
      </OportunidadeCard>
      <article v-for="id in indisponiveis" :key="id" class="surface rc-card"><h2>Oportunidade indisponível</h2><button class="text-button" @click="remover(id)">Remover favorito</button></article>
    </div>
    <nav v-if="!carregando && (pagina || mais)" class="rc-actions" aria-label="Páginas de resultados">
      <button class="btn btn-outline" :disabled="!pagina" @click="carregar(pagina - 1)">Anterior</button>
      <span>Página {{ pagina + 1 }}</span>
      <button class="btn btn-outline" :disabled="!mais" @click="carregar(pagina + 1)">Seguinte</button>
    </nav>
  </section>
</template>
