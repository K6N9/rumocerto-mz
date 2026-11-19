import { onBeforeUnmount, ref } from 'vue'

export function useRecurso() {
  const carregando = ref(false)
  const erro = ref('')
  const mensagem = ref('')
  let versao = 0
  onBeforeUnmount(() => { versao++ })
  async function executar(consulta, aplicar, erroTexto = 'Não foi possível obter os dados. Tente novamente.') {
    const actual = ++versao
    carregando.value = true
    erro.value = ''
    mensagem.value = ''
    try {
      const dados = await consulta()
      if (actual !== versao) return false
      aplicar?.(dados)
      return true
    } catch {
      if (actual === versao) erro.value = erroTexto
      return false
    } finally {
      if (actual === versao) carregando.value = false
    }
  }
  return { carregando, erro, mensagem, executar }
}
