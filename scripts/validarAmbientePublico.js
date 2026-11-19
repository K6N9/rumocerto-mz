import { chavePublicaSupabase, papelJwt } from '../shared/chavePublicaSupabase.js'

const chaveSupabase = 'VITE_SUPABASE_PUBLISHABLE_KEY'
const nomePrivado = /(?:^|_)(?:SECRET|PASSWORD|PASSWD|PRIVATE(?:_KEY)?|SERVICE_ROLE|REFRESH_TOKEN|CLIENT_SECRET|CREDENTIALS|RATE_SALT)(?:_|$)/i
const nomeCredencial = /(?:^|_)(?:TOKEN|API_KEY)(?:_|$)/i
const nomesSupabase = [chaveSupabase, 'VITE_SUPABASE_ANON_KEY']
const publicoNome = /(?:^|_)(?:PUBLIC|PUBLICABLE|PUBLISHABLE|ANON)(?:_|$)/i
const segredosConhecidos = [
  /\bsb_secret_[A-Za-z0-9_-]+/i,
  /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_|github_pat_|sk_(?:live|test)_|rk_(?:live|test)_|sk-proj-|sk-ant-|xox[baprs]-|npm_|CF_API_TOKEN_)[A-Za-z0-9_-]{8,}/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bAIza[A-Za-z0-9_-]{35}\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bbearer\s+[A-Za-z0-9._~+/=-]+/i,
  /[a-z][a-z0-9+.-]*:\/\/[^\s/?#@]+@/i,
  /(?:[?&]|^)(?:access_token|refresh_token|token_hash|client_secret|password|private_key)=[^&\s]+/i
]

export function validarAmbientePublico(variaveis) {
  const bloqueadas = []
  for (const [nome, bruto] of Object.entries(variaveis)) {
    if (!nome.startsWith('VITE_')) continue
    const valor = String(bruto ?? '').trim()
    if (!valor) continue
    const publica = chavePublicaSupabase(valor)
    const tokens = valor.match(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []
    const supabase = nomesSupabase.includes(nome)
    const tokenPrivado = tokens.some(token => !supabase || token !== valor || papelJwt(token) !== 'anon')
    if ((supabase && !publica) || tokenPrivado || segredosConhecidos.some(padrao => padrao.test(valor)) ||
        nomePrivado.test(nome) || (nomeCredencial.test(nome) && !publicoNome.test(nome))) {
      bloqueadas.push(/^VITE_[A-Z0-9_]{1,100}$/i.test(nome) ? nome : 'variável VITE_* com nome inválido')
    }
  }
  if (bloqueadas.length) {
    throw new Error('Build bloqueado por configuração pública insegura em: ' + bloqueadas.join(', ') + '. Verifique a origem das credenciais.')
  }
}
