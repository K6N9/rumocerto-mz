import { reactive, readonly } from 'vue'
import { chavePublicaSupabase } from '../../shared/chavePublicaSupabase.js'

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const chave = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()
function configuracaoValida() {
  try {
    const endpoint = new URL(url)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    return !endpoint.username && !endpoint.password && (endpoint.protocol === 'https:' ||
      (local && endpoint.protocol === 'http:')) && chavePublicaSupabase(chave)
  } catch { return false }
}

export const contaConfigurada = configuracaoValida()
const estado = reactive({ utilizador: null, erro: '', pronta: false, recuperacao: false, confirmada: false })
export const conta = readonly(estado)
let cliente
let inicializacao

export function recolherCallbackConta() {
  const pagina = new URL(location.href)
  const fragmento = new URLSearchParams(pagina.hash.slice(1))
  const query = pagina.searchParams
  const fonte = fragmento.has('token_hash') ? fragmento : query
  if (!['token_hash', 'code', 'error'].some(campo => fonte.has(campo))) return null

  const callback = { token: fonte.get('token_hash'), tipo: fonte.get('type'), codigo: fonte.get('code') }
  for (const campo of ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description']) query.delete(campo)
  pagina.hash = '/entrar'
  history.replaceState(history.state, '', pagina)
  return callback
}

async function inicializar(callback) {
  if (!contaConfigurada) return
  const { createClient } = await import('@supabase/supabase-js')
  cliente = createClient(url, chave, { auth: { flowType: 'pkce', detectSessionInUrl: false } })
  cliente.auth.onAuthStateChange((evento, sessao) => {
    estado.utilizador = sessao?.user ?? null
    if (evento === 'PASSWORD_RECOVERY') estado.recuperacao = true
    if (evento === 'SIGNED_OUT') estado.recuperacao = false
  })
  if (callback) {
    const { token, tipo, codigo } = callback
    const resposta = token && ['signup', 'email', 'recovery'].includes(tipo)
      ? await cliente.auth.verifyOtp({ token_hash: token, type: tipo })
      : codigo ? await cliente.auth.exchangeCodeForSession(codigo) : { error: true }
    estado.erro = resposta.error ? 'A ligação de autenticação expirou ou já foi usada. Solicite uma nova ligação.' : ''
    estado.recuperacao = !resposta.error && tipo === 'recovery'
    estado.confirmada = !resposta.error && !estado.recuperacao
    if (estado.recuperacao) {
      const pagina = new URL(location.href)
      pagina.hash = '/redefinir-palavra-passe'
      history.replaceState(history.state, '', pagina)
    }
  }
  const { data } = await cliente.auth.getSession()
  estado.utilizador = data?.session?.user ?? null
}

export function iniciarConta(callback) {
  inicializacao ??= inicializar(callback)
    .catch(() => { estado.erro = 'Não foi possível iniciar o serviço de contas.' })
    .finally(() => { estado.pronta = true })
  return inicializacao
}

export async function obterCliente() {
  await iniciarConta()
  if (!cliente) throw new Error('O serviço de contas precisa de configuração.')
  return cliente
}

export async function accaoAuth(accao, ...args) {
  const api = await obterCliente()
  const resultado = await api.auth[accao](...args)
  if (resultado.error) throw resultado.error
  if (accao === 'updateUser') estado.recuperacao = false
  return resultado.data
}

export function urlConta(tipo) {
  const destino = new URL(import.meta.env.BASE_URL, location.origin)
  destino.searchParams.set('type', tipo)
  return destino.href
}
