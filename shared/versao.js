export const VERSAO_PROTOCOLO = '3.5'

export function classificarSaudeWorker(httpOk, dados) {
  if (!httpOk || dados?.ok !== true) return 'indisponivel'
  if (dados.versao !== VERSAO_PROTOCOLO || typeof dados.envioDisponivel !== 'boolean') return 'incompativel'
  return dados.envioDisponivel ? 'disponivel' : 'indisponivel'
}
