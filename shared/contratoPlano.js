// A migration 202611190004 inclui esta definição. O teste SQL impede divergências.
export const CONTRATO_PLANO = {
  textos: { titulo: 250, diagnostico: 2000, estrategia: 2000, metodo: 150 },
  listas: { recursos: [20, 500], avisos: [20, 500] },
  semanas: 4,
  semana: {
    textos: { titulo: 250, foco: 800, entregavel: 800, indicador: 800 },
    tarefas: [1, 10, 1200],
    minutosSugeridos: 10080,
    minutosPorTarefa: 1440
  }
}

const objecto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor)
const texto = (valor, limite) => typeof valor === 'string' && valor.length > 0 && !valor.includes('\0') && [...valor].length <= limite
const inteiro = (valor, limite) => Number.isInteger(valor) && valor >= 0 && valor <= limite

export function erroPlano(plano) {
  const regras = CONTRATO_PLANO
  if (!objecto(plano)) return 'O plano deve ser um objecto.'
  for (const [campo, limite] of Object.entries(regras.textos)) {
    if (!texto(plano[campo], limite)) return `Campo inválido no plano: ${campo}.`
  }
  for (const [campo, [maximo, limite]] of Object.entries(regras.listas)) {
    const lista = plano[campo]
    if (!Array.isArray(lista) || lista.length > maximo || !Array.from(lista).every(v => texto(v, limite))) {
      return `Lista inválida no plano: ${campo}.`
    }
  }
  if (!Array.isArray(plano.semanas) || plano.semanas.length !== regras.semanas) return 'O plano deve ter quatro semanas.'
  for (const [indice, semana] of plano.semanas.entries()) {
    const numero = indice + 1
    if (!objecto(semana) || semana.numero !== numero) return `Numeração inválida na semana ${numero}.`
    for (const [campo, limite] of Object.entries(regras.semana.textos)) {
      if (!texto(semana[campo], limite)) return `Campo inválido na semana ${numero}: ${campo}.`
    }
    const [minimo, maximo, limite] = regras.semana.tarefas
    if (!Array.isArray(semana.tarefas) || semana.tarefas.length < minimo || semana.tarefas.length > maximo ||
        !Array.from(semana.tarefas).every(v => texto(v, limite))) return `Tarefas inválidas na semana ${numero}.`
    if (!inteiro(semana.minutosSugeridos, regras.semana.minutosSugeridos) ||
        !Array.isArray(semana.minutosPorTarefa) || semana.minutosPorTarefa.length !== semana.tarefas.length ||
        !Array.from(semana.minutosPorTarefa).every(v => inteiro(v, regras.semana.minutosPorTarefa))) {
      return `Duração inválida na semana ${numero}.`
    }
  }
  return null
}

export const planoValido = plano => erroPlano(plano) === null
