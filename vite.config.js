import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { validarAmbientePublico } from './scripts/validarAmbientePublico.js'

export default defineConfig(() => {
  const repo = process.env.GITHUB_REPOSITORY?.split('/').at(-1)
  const ambientePublico = {
    name: 'validar-ambiente-publico',
    apply: 'build',
    configResolved(config) { validarAmbientePublico(config.env) }
  }
  return { plugins: [ambientePublico, vue()], base: process.env.GITHUB_PAGES_BASE || (repo ? `/${repo}/` : '/') }
})
