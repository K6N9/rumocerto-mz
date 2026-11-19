export function destinoSeguro(valor) {
  return typeof valor === 'string' && /^\/(?![\/\\])/.test(valor) && !valor.includes('\\') &&
    !/^\/(entrar|registar|recuperar|redefinir-palavra-passe|acesso)(\/|\?|#|$)/.test(valor) ? valor : '/conta'
}

export async function avaliarAcesso(rota, dependencias) {
  if (!rota.meta.privada) return true
  await dependencias.iniciar()
  if (!dependencias.sessao()) return { name: 'entrar', query: { destino: rota.fullPath } }
  if (!rota.meta.admin) return true
  try {
    return await dependencias.admin() === true || { name: 'acesso', query: { motivo: 'restrito' } }
  } catch {
    return { name: 'acesso', query: { motivo: 'indisponivel' } }
  }
}
