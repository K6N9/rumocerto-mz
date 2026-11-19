<script setup>
import { onMounted, reactive, ref } from 'vue'
import OportunidadeCard from '../components/OportunidadeCard.vue'
import EstadoRecurso from '../components/EstadoRecurso.vue'
import { useRecurso } from '../composables/useRecurso.js'
import { contaConfigurada } from '../services/supabase.js'
import { pesquisarCatalogoLocal, pesquisarOportunidades } from '../services/dados.js'
import { AREAS } from '../../shared/planner.js'
import { ESCOLARIDADES, MODALIDADES, PROVINCIAS, TIPOS } from '../../shared/oportunidades.js'

const tamanho = 12
const form = reactive({ texto: '', area: '', provincia: '', entidade: '', tipo: '', modalidade: '', escolaridade: '', experiencia: '', prazo: '', publicacao: '' })
const listas = { area: ['Área profissional', AREAS], provincia: ['Província', PROVINCIAS],
  tipo: ['Tipo de oportunidade', TIPOS], modalidade: ['Modalidade', MODALIDADES] }
const estaPagina = ref(0)
const registos = ref([])
const haMais = ref(false)
const mostraCopia = ref(!contaConfigurada)
let filtros = {}
const { carregando, erro, executar } = useRecurso()

function carregar(pagina = estaPagina.value) {
  const pesquisar = mostraCopia.value ? pesquisarCatalogoLocal : pesquisarOportunidades
  return executar(() => pesquisar(filtros, pagina, tamanho), dados => {
    estaPagina.value = pagina
    haMais.value = dados.length === tamanho
    registos.value = dados
  })
}
function pesquisar() { filtros = { ...form }; registos.value = []; carregar(0) }
function limpar() { for (const chave of Object.keys(form)) form[chave] = ''; pesquisar() }
function mudarCatalogo() { mostraCopia.value = !mostraCopia.value; registos.value = []; carregar(0) }
onMounted(() => carregar())
</script>

<template>
  <section class="container inner-page rc-page">
    <header class="page-heading">
      <h1>Oportunidades</h1>
      <p>Consulte empregos, estágios, bolsas, formações e programas com fonte verificada.</p>
    </header>
    <p v-if="mostraCopia" class="rc-status" role="status">A mostrar anúncios da última revisão do catálogo local. Confirme as condições com cada entidade.</p>
      <form class="surface rc-panel rc-form" @submit.prevent="pesquisar">
        <label>Palavra-chave<input v-model="form.texto" type="search" maxlength="120" placeholder="Título, competência ou requisito" /></label>
        <details class="rc-filtros">
          <summary>Mais filtros</summary>
          <div class="rc-form-grid">
            <label v-for="[chave, [nome, opcoes]] in Object.entries(listas)" :key="chave">{{ nome }}
              <select v-model="form[chave]"><option value="">Qualquer</option><option v-for="opcao in opcoes" :key="opcao">{{ opcao }}</option></select>
            </label>
            <label>Entidade<input v-model="form.entidade" maxlength="150" /></label>
            <label>Escolaridade até ao nível<select v-model="form.escolaridade"><option value="">Qualquer</option><option v-for="(nivel, i) in ESCOLARIDADES" :key="nivel" :value="i + 1">{{ nivel }}</option></select></label>
            <label>Experiência exigida até (meses)<input v-model="form.experiencia" type="number" min="0" max="720" /></label>
            <label>Prazo<select v-model="form.prazo"><option value="">Qualquer</option><option :value="0">Termina hoje</option><option :value="7">Próximos 7 dias</option><option :value="30">Próximos 30 dias</option></select></label>
            <label>Publicada a partir de<input v-model="form.publicacao" type="date" /></label>
          </div>
        </details>
        <div class="rc-actions">
          <button class="btn btn-primary" :disabled="carregando">Pesquisar</button>
          <button class="btn btn-outline" type="button" :disabled="carregando" @click="limpar">Limpar filtros</button>
        </div>
      </form>
      <EstadoRecurso :carregando="carregando" :erro="erro" :vazio="registos.length ? '' : 'Nenhuma oportunidade verificada nesta página.'" repetir @repetir="carregar()" />
      <button v-if="contaConfigurada && !carregando && (mostraCopia || !registos.length)" type="button"
        class="btn btn-outline" @click="mudarCatalogo">{{ mostraCopia ? 'Voltar ao catálogo da conta' : 'Consultar a cópia local' }}</button>
      <div v-if="!carregando && !erro" class="rc-card-grid">
        <OportunidadeCard v-for="oportunidade in registos" :key="oportunidade.id" :oportunidade="oportunidade" />
      </div>
      <nav v-if="!carregando && (estaPagina || haMais)" class="rc-actions" aria-label="Páginas de resultados">
        <button class="btn btn-outline" :disabled="estaPagina === 0" @click="carregar(estaPagina - 1)">Anterior</button>
        <span>Página {{ estaPagina + 1 }}</span>
        <button class="btn btn-outline" :disabled="!haMais" @click="carregar(estaPagina + 1)">Seguinte</button>
      </nav>
    <div class="rc-actions">
      <RouterLink to="/preparacao" class="text-link">Recursos de preparação</RouterLink>
      <a v-if="mostraCopia" href="https://www.juventude.mjd.gov.mz/oportunidades" target="_blank" rel="noopener noreferrer">Consultar o Portal da Juventude</a>
    </div>
  </section>
</template>
