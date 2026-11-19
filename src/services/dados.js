import { conta, contaConfigurada, obterCliente } from './supabase.js'
import { estaVigente, filtrarOportunidadesLocais, filtrosCatalogo } from '../../shared/oportunidades.js'

export async function consultar(consulta) {
  const { data, error } = await consulta(await obterCliente())
  if (error) throw error
  return data
}

export function rpc(nome, parametros) {
  return consultar(db => db.rpc(nome, parametros))
}

export const verificarAdmin = () => rpc('e_admin')
export async function lerPessoal(tabela, colunas = '*') {
  const id = conta.utilizador?.id
  if (!id) throw new Error('Inicie sessão.')
  return consultar(db => db.from(tabela).select(colunas).eq('utilizador', id).maybeSingle())
}

export function guardarPessoal(tabela, campos) {
  const id = conta.utilizador?.id
  if (!id) throw new Error('Inicie sessão.')
  return consultar(db => db.from(tabela).upsert({ ...campos, utilizador: id }, { onConflict: 'utilizador' }).select().single())
}

export const PESSOAL = ['perfis', 'preferencias', 'preferencias_comunicacao', 'curriculos', 'planos',
  'tarefas', 'favoritos', 'candidaturas', 'historico_candidaturas', 'notificacoes', 'envios', 'pedidos_eliminacao']
export async function exportarConta() {
  const id = conta.utilizador?.id
  if (!id) throw new Error('Inicie sessão.')
  const registos = await Promise.all(PESSOAL.map(async tabela => {
    const linhas = []
    while (true) {
      const inicio = linhas.length
      const pagina = await consultar(db => {
        let query = db.from(tabela).select('*').eq('utilizador', id)
        for (const chave of chavesExportacao[tabela] || ['utilizador']) query = query.order(chave)
        return query.range(inicio, inicio + 199)
      })
      linhas.push(...pagina)
      if (pagina.length < 200) return [tabela, linhas]
    }
  }))
  return { exportado_em: new Date().toISOString(), conta: { email: conta.utilizador?.id === id ? conta.utilizador.email : null }, ...Object.fromEntries(registos) }
}
const chavesExportacao = { planos: ['id'], tarefas: ['plano_id', 'chave'], favoritos: ['oportunidade_id'],
  candidaturas: ['id'], historico_candidaturas: ['id'], notificacoes: ['id'], envios: ['id'] }

const catalogoLocal = () => import('../assets/dados/oportunidades.json').then(modulo => modulo.default)
export async function pesquisarCatalogoLocal(filtros, pagina, tamanho) {
  return filtrarOportunidadesLocais(await catalogoLocal(), filtros).slice(pagina * tamanho, (pagina + 1) * tamanho)
}

export async function pesquisarOportunidades(filtros, pagina = 0, tamanho = 12) {
  if (!contaConfigurada) return pesquisarCatalogoLocal(filtros, pagina, tamanho)
  return consultar(db => db.rpc('pesquisar_oportunidades', filtrosCatalogo(filtros))
    .order('verificada_em', { ascending: false }).order('id').range(pagina * tamanho, (pagina + 1) * tamanho - 1))
}

export async function consultarAnuncioLocal(id) {
  return (await catalogoLocal()).find(item => item.id === id && estaVigente(item)) || null
}

export async function consultarOportunidade(id) {
  if (!contaConfigurada) return consultarAnuncioLocal(id)
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null
  return consultar(db => db.from('catalogo_oportunidades').select('*').eq('id', id).maybeSingle())
}

export function descarregarFicheiro(bytes, tipo, nome) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }))
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
