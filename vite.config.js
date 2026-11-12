import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// No GitHub Actions: GITHUB_REPOSITORY=utilizador/nome-do-repositorio
// Localmente, base='/' para o Vite funcionar sem configuração adicional.
const repo = process.env.GITHUB_REPOSITORY?.split('/').at(-1)
const base = process.env.GITHUB_PAGES_BASE || (repo ? `/${repo}/` : '/')

export default defineConfig({ plugins: [vue()], base })
