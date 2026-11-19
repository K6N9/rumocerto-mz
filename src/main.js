import { createApp, watch } from 'vue'
import App from './App.vue'
import { conta, iniciarConta, recolherCallbackConta } from './services/supabase.js'
import './assets/styles.css'

async function montar() {
  const callback = recolherCallbackConta()
  const sessao = iniciarConta(callback)
  if (callback) await sessao
  const { default: router } = await import('./router/index.js')
  watch(() => conta.utilizador?.id, (actual, anterior) => {
    if (anterior && actual !== anterior && router.currentRoute.value.meta.privada) router.replace({ name: 'entrar' })
  })
  createApp(App).use(router).mount('#app')
}

montar()
