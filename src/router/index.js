import { createRouter, createWebHashHistory } from 'vue-router'
import InicioView from '../views/InicioView.vue'
import IndicadoresView from '../views/IndicadoresView.vue'
import IndicadorDetalheView from '../views/IndicadorDetalheView.vue'
import PlanoView from '../views/PlanoView.vue'
import SobreView from '../views/SobreView.vue'
import NaoEncontradoView from '../views/NaoEncontradoView.vue'

const routes = [
  { path: '/', component: InicioView, meta: { title: 'Início' } },
  { path: '/indicadores', component: IndicadoresView, meta: { title: 'Indicadores' } },
  { path: '/indicadores/:codigo', component: IndicadorDetalheView, props: true, meta: { title: 'Detalhe do indicador' } },
  { path: '/plano', component: PlanoView, meta: { title: 'O meu plano' } },
  { path: '/sobre', component: SobreView, meta: { title: 'Sobre' } },
  { path: '/:pathMatch(.*)*', component: NaoEncontradoView, meta: { title: 'Página não encontrada' } },
]

const router = createRouter({ history: createWebHashHistory(import.meta.env.BASE_URL), routes, scrollBehavior: () => ({ top: 0 }) })
router.afterEach((to) => { document.title = `${to.meta.title || 'RumoCerto'} · RumoCerto MZ` })
export default router
