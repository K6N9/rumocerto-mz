import { computed, reactive, ref, watch } from 'vue'

const CHAVE = 'rumocerto:plano:v1'
const inicial = () => ({ area: '', situacao: '', objetivo: '', recursoId: 'cv', notas: '', concluido: [], disponibilidade: '3 a 5 horas por semana', internet: 'Acesso limitado a dados móveis', competencias: '', dificuldade: '', nome: '' })

function recuperar() {
  try {
    const texto = localStorage.getItem(CHAVE)
    const salvo = texto ? JSON.parse(texto) : {}
    return { ...inicial(), ...salvo, concluido: Array.isArray(salvo.concluido) ? salvo.concluido : [] }
  } catch { return inicial() }
}

export function usePlano() {
  const plano = reactive(recuperar())
  const foiGuardado = ref(false)
  const totalConcluido = computed(() => plano.concluido.length)
  watch(plano, () => {
    try { localStorage.setItem(CHAVE, JSON.stringify(plano)); foiGuardado.value = true }
    catch { foiGuardado.value = false }
  }, { deep: true })

  function alternarPasso(index) {
    if (plano.concluido.includes(index)) plano.concluido = plano.concluido.filter((n) => n !== index)
    else plano.concluido = [...plano.concluido, index]
  }
  function limpar() {
    Object.assign(plano, inicial())
  }
  return { plano, foiGuardado, totalConcluido, alternarPasso, limpar }
}
