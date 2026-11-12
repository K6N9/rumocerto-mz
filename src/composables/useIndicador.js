import { ref, onMounted, onUnmounted, watch, toValue } from 'vue'
import { normalizarSerieBancoMundial } from '../utils/formatacao.js'

const DURACAO_CACHE_MS = 60 * 60 * 1000
const cacheMemoria = new Map()

function lerCache(codigo) {
  const item = cacheMemoria.get(codigo)
  if (item && Date.now() - item.dataHora < DURACAO_CACHE_MS) return item
  try {
    const texto = sessionStorage.getItem(`rumocerto:bm:${codigo}`)
    const lido = texto ? JSON.parse(texto) : null
    if (lido && Array.isArray(lido.serie) && Date.now() - lido.dataHora < DURACAO_CACHE_MS) return lido
  } catch { /* Não bloquear se o armazenamento estiver indisponível. */ }
  return null
}

function escreverCache(codigo, valor) {
  cacheMemoria.set(codigo, valor)
  try { sessionStorage.setItem(`rumocerto:bm:${codigo}`, JSON.stringify(valor)) } catch { /* opcional */ }
}

export function useIndicador(codigo) {
  const serie = ref([])
  const carregando = ref(true)
  const erro = ref('')
  const ultimaConsulta = ref('')
  let controller = null

  async function carregar(forcar = false) {
    const id = toValue(codigo)
    if (!id) { serie.value = []; carregando.value = false; erro.value = 'Indicador desconhecido.'; return }
    if (controller) controller.abort()
    controller = new AbortController()
    const atual = controller
    erro.value = ''
    carregando.value = true
    try {
      if (!forcar) {
        const cache = lerCache(id)
        if (cache) {
          serie.value = cache.serie
          ultimaConsulta.value = cache.consultadoEm
          return
        }
      }
      const endpoint = new URL(`https://api.worldbank.org/v2/country/MOZ/indicator/${encodeURIComponent(id)}`)
      endpoint.searchParams.set('format', 'json')
      endpoint.searchParams.set('per_page', '100')
      const resposta = await fetch(endpoint, { signal: atual.signal, headers: { Accept: 'application/json' } })
      if (!resposta.ok) throw new Error(`O servidor devolveu HTTP ${resposta.status}.`)
      const json = await resposta.json()
      const valores = normalizarSerieBancoMundial(json)
      if (atual.signal.aborted) return
      serie.value = valores
      ultimaConsulta.value = new Date().toISOString()
      escreverCache(id, { serie: valores, dataHora: Date.now(), consultadoEm: ultimaConsulta.value })
    } catch (falha) {
      if (!atual.signal.aborted) { serie.value = []; erro.value = `Não foi possível obter os dados do Banco Mundial. ${falha.message}` }
    } finally {
      if (atual === controller) carregando.value = false
    }
  }

  onMounted(() => carregar())
  watch(() => toValue(codigo), () => carregar())
  onUnmounted(() => controller?.abort())
  return { serie, carregando, erro, ultimaConsulta, carregar }
}
