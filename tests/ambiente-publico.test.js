import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { validarAmbientePublico } from '../scripts/validarAmbientePublico.js'

const jwt = papel => [{ alg: 'HS256', typ: 'JWT' }, { role: papel }]
  .map(obj => Buffer.from(JSON.stringify(obj)).toString('base64url')).join('.') + '.assinatura_ficticia'

test('build admite chave publicável, JWT anon e configuração pública legítima', () => {
  for (const chave of ['sb_publishable_so_teste', jwt('anon'), '']) {
    assert.doesNotThrow(() => validarAmbientePublico({
      VITE_SUPABASE_PUBLISHABLE_KEY: chave,
      VITE_SUPABASE_URL: 'https://example.test',
      VITE_WORKER_URL: 'https://worker.example.test',
      VITE_PUBLIC_SITE_TOKEN: 'valor-publico',
      VITE_SUPABASE_ANON_KEY: jwt('anon'),
      VITE_CATALOGO_URL: 'https://example.test?contacto=info@example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_so_teste'
    }))
  }
})

test('build exclui credenciais privadas e relata apenas o nome da variável', () => {
  const casos = [
    ['VITE_SUPABASE_PUBLISHABLE_KEY', jwt('service_role')],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_ficticia_auditoria'],
    ['VITE_SUPABASE_PUBLISHABLE_KEY', 'valor-com-formato-invalido'],
    ['VITE_CONTEUDO', jwt('authenticated')],
    ['VITE_CONTEUDO', 'texto sb_secret_ficticia_auditoria'],
    ['VITE_CONTEUDO', 'ghp_' + 'f'.repeat(36)],
    ['VITE_CONTEUDO', 'AIza' + 'f'.repeat(35)],
    ['VITE_CONTEUDO', 'sk_live_ficticio_auditoria'],
    ['VITE_CONTEUDO', '-----BEGIN RSA PRIVATE KEY-----'],
    ['VITE_WORKER_URL', 'https://nome:senhaFicticia@example.test'],
    ['VITE_WORKER_URL', 'https://example.test/?access_token=ficticio'],
    ['VITE_EMAILJS_PRIVATE_KEY', 'ficticia_sem_prefixo'],
    ['VITE_TOKEN', 'segredo_ficticio'],
    ['VITE_PUBLIC_SECRET', 'segredo_ficticio'],
    ['VITE_CONTEUDO', jwt('anon')]
  ]
  for (const [nome, valor] of casos) {
    assert.throws(() => validarAmbientePublico({ [nome]: valor }), erro =>
      erro.message.includes(nome) && !erro.message.includes(valor))
  }
})

test('Vite bloqueia o build antes de gerar artefactos ao ler variantes .env', async t => {
  const raiz = await mkdtemp(join(tmpdir(), 'rumocerto-build-'))
  t.after(() => rm(raiz, { recursive: true, force: true }))
  const segredo = 'sb_secret_canario_ficticio'
  await writeFile(join(raiz, '.env.auditoria.local'), 'VITE_SUPABASE_PUBLISHABLE_KEY=' + segredo + '\n')
  const ficheiro = local => fileURLToPath(new URL(local, import.meta.url))
  const entrada = Object.fromEntries(Object.entries(process.env).filter(([chave]) => !chave.startsWith('VITE_')))
  const resultado = spawnSync(process.execPath, [ficheiro('../node_modules/vite/bin/vite.js'),
    'build', raiz, '--config', ficheiro('../vite.config.js'), '--mode', 'auditoria'],
  { encoding: 'utf8', env: entrada })
  const saida = resultado.stdout + resultado.stderr
  assert.equal(resultado.status, 1)
  assert.match(saida, /Build bloqueado.*VITE_SUPABASE_PUBLISHABLE_KEY/)
  assert.ok(!saida.includes(segredo))
  assert.ok(!existsSync(join(raiz, 'dist')))
})
