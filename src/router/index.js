import { createRouter, createWebHashHistory } from 'vue-router'
import { conta, iniciarConta } from '../services/supabase.js'
import { verificarAdmin } from '../services/dados.js'
import { avaliarAcesso } from './acesso.js'
import InicioView from '../views/InicioView.vue'

const publica = (path, name, title, component, props = false) => ({ path, name, component, props, meta: { title } })
const privada = (path, name, title, component, admin = false) => ({ path, name, component, meta: { title, privada: true, admin } })
const authView = () => import('../views/AutenticacaoView.vue')

const routes = [
  publica('/', 'inicio', 'Início', InicioView),
  publica('/indicadores', 'indicadores', 'Indicadores', () => import('../views/IndicadoresView.vue')),
  publica('/indicadores/:codigo', 'indicador', 'Detalhe do indicador', () => import('../views/DetalheView.vue'), true),
  publica('/plano', 'plano', 'Criar plano', () => import('../views/PlanoView.vue')),
  publica('/progresso', 'progresso', 'O meu progresso', () => import('../views/ProgressoView.vue')),
  publica('/sobre', 'sobre', 'Sobre o projecto', () => import('../views/SobreView.vue')),
  publica('/oportunidades', 'oportunidades', 'Oportunidades', () => import('../views/OportunidadesView.vue')),
  publica('/oportunidades/:id', 'oportunidade', 'Detalhe da oportunidade', () => import('../views/OportunidadeView.vue'), true),
  publica('/preparacao', 'preparacao', 'Preparação profissional', () => import('../views/PreparacaoView.vue')),
  publica('/entrar', 'entrar', 'Entrar', authView),
  publica('/registar', 'registar', 'Criar conta', authView),
  publica('/recuperar', 'recuperar', 'Recuperar palavra-passe', authView),
  publica('/acesso', 'acesso', 'Acesso administrativo', authView),
  privada('/redefinir-palavra-passe', 'redefinir-palavra-passe', 'Definir palavra-passe', authView),
  privada('/conta', 'conta', 'Área pessoal', () => import('../views/ContaView.vue')),
  privada('/conta/perfil', 'perfil', 'Perfil profissional', () => import('../views/PerfilView.vue')),
  privada('/conta/favoritos', 'favoritos', 'Favoritos', () => import('../views/CorrespondenciasView.vue')),
  privada('/conta/rumomatch', 'rumomatch', 'RumoMatch', () => import('../views/CorrespondenciasView.vue')),
  privada('/conta/cv', 'cv', 'Criador de CV', () => import('../views/CurriculoView.vue')),
  privada('/conta/candidaturas', 'candidaturas', 'Candidaturas', () => import('../views/CandidaturasView.vue')),
  privada('/conta/notificacoes', 'notificacoes', 'Notificações', () => import('../views/NotificacoesView.vue')),
  privada('/conta/definicoes', 'definicoes', 'Definições de conta', () => import('../views/DefinicoesView.vue')),
  privada('/admin', 'admin', 'Administração', () => import('../views/AdminView.vue'), true),
  publica('/:pathMatch(.*)*', '404', 'Página não encontrada', () => import('../views/NaoEncontradoView.vue'))
]

const router = createRouter({ history: createWebHashHistory(import.meta.env.BASE_URL), routes, scrollBehavior: () => ({ top: 0 }) })
router.beforeEach(to => avaliarAcesso(to, { iniciar: iniciarConta, sessao: () => conta.utilizador, admin: verificarAdmin }))
router.afterEach((to, from) => {
  document.title = `${to.meta.title || 'RumoCerto MZ'} · RumoCerto MZ`
  if (from.name && to.path !== from.path) requestAnimationFrame(() => document.getElementById('conteudo')?.focus({ preventScroll: true }))
})
export default router
