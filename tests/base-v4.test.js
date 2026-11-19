import { readFile, readdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { AREAS, DISPONIBILIDADES, gerarPlano, gerarPlanoDiario, INTERNET, SITUACOES } from '../shared/planner.js'

import { CONTRATO_PLANO, erroPlano } from '../shared/contratoPlano.js'

const jovem = '10000000-0000-4000-8000-000000000001'
const outro = '10000000-0000-4000-8000-000000000002'
const admin = '10000000-0000-4000-8000-000000000003'
const fonte = '20000000-0000-4000-8000-000000000001'
const publica = '30000000-0000-4000-8000-000000000001'
const rascunho = '30000000-0000-4000-8000-000000000002'
const planoId = '40000000-0000-4000-8000-000000000001'

test('PostgreSQL aplica as migrations e protege os percursos da v4', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  // PostgreSQL real em WASM. Este esquema mínimo emula as funções chamadas pelo Supabase Auth.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to public;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  `)
  const directorio = new URL('../supabase/migrations/', import.meta.url)
  for (const nome of (await readdir(directorio)).filter(n => n.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(nome, directorio), 'utf8'))
  }
  const query = async (sql, args) => (await db.query(sql, args)).rows
  async function entrar(role, id = '') {
    await db.exec('reset role; set role ' + role)
    await query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [id, role])
  }
  await query("insert into auth.users values ($1,'jovem@example.test',now()),($2,'outro@example.test',now()),($3,'admin@example.test',now())", [jovem, outro, admin])
  await query("insert into public.administradores values ($1, 'admin')", [admin])

  await t.test('moderação valida fonte, expiração horária e visibilidade pública', async () => {
    await entrar('authenticated', jovem)
    assert.equal((await query('select public.e_admin() autorizado'))[0].autorizado, false)
    await assert.rejects(query('select public.relatorio_admin()'), /administrativo/)
    await assert.rejects(query("insert into public.fontes values ($1,'Fonte de teste','https://example.test/',now(),true)", [fonte]), /row-level security/)
    await assert.rejects(query("insert into public.administradores values ($1,'novo_admin')", [jovem]), /permission denied/)
    await entrar('authenticated', admin)
    await query("insert into public.fontes values ($1,'Fonte de teste','https://example.test/',null,true)", [fonte])
    const criar = "insert into public.oportunidades (id,fonte_id,titulo,entidade,descricao,tipo,estado,verificada_em,prazo,escolaridade,experiencia_meses,url_original,url_candidatura) values ($1,$2,$3,'Laboratório','Anúncio de teste isolado','Estágio',$4,now(),public.data_maputo()+2,4,0,'https://example.test/anuncio','https://example.test/candidatar')"
    await assert.rejects(query(criar, [publica, fonte, 'Estágio curricular', 'activa']), /Valide a fonte/)
    await query('update public.fontes set verificada_em = now() where id = $1', [fonte])
    await query(criar, [publica, fonte, 'Estágio curricular', 'activa'])
    await query(criar, [rascunho, fonte, 'Rascunho privado', 'rascunho'])
    assert.equal((await query('select count(*)::int total from public.auditoria'))[0].total, 4)
    assert.equal((await query("select public.prazo_vigente(public.data_maputo() - 1,time '16:00') as vigente"))[0].vigente, false)
    await entrar('anon')
    assert.deepEqual(await query('select id from public.oportunidades'), [{ id: publica }])
    assert.deepEqual(await query("select id from public.pesquisar_oportunidades(p_texto=>'curricular', p_experiencia=>0, p_prazo=>7)"), [{ id: publica }])
    assert.deepEqual(await query('select id from public.pesquisar_oportunidades(p_escolaridade=>3)'), [])
    assert.deepEqual(await query("select id from public.pesquisar_oportunidades(p_texto=>'%')"), [])
    await assert.rejects(query('select * from public.perfis'), /permission denied/)
  })

  await t.test('perfis e CV isolados entre titulares e administrador', async () => {
    await entrar('authenticated', jovem)
    const perfil = { nome: 'Jovem de Teste', provincia: 'Sofala', localidade: '', area: '', escolaridade: null,
      competencias: ['Comunicação'], comportamentais: [], experiencia_meses: 0, experiencia: '', interesses: '', objectivos: '' }
    const preferencias = { disponibilidade: '', modalidades: ['Híbrido'], tipos: ['Estágio'], provincias: ['Sofala'] }
    await query('select public.guardar_perfil($1,$2)', [perfil, preferencias])
    await assert.rejects(query('select public.guardar_perfil($1,$2)', [{ ...perfil, nome:'Nome alternativo' }, { ...preferencias, tipos: ['Inexistente'] }]), /check constraint/)
    assert.deepEqual(await query('select nome from public.perfis'), [{ nome:'Jovem de Teste' }])
    await query("insert into public.curriculos(dados) values (jsonb_build_object('nome','Jovem de Teste'))")
    await entrar('authenticated', outro)
    assert.deepEqual(await query('select * from public.perfis'), [])
    assert.deepEqual(await query('select * from public.curriculos'), [])
    await assert.rejects(query("insert into public.curriculos(utilizador,dados) values ($1,jsonb_build_object('nome','Terceiro'))", [jovem]), /row-level security/)
    await entrar('authenticated', admin)
    assert.deepEqual(await query('select * from public.curriculos'), [])
    assert.equal((await query('select public.relatorio_admin() total'))[0].total.publicadas, 1)
    assert.deepEqual(await query('select * from public.pedidos_eliminacao'), [])
  })

  await t.test('contrato SQL coincide com o frontend e rejeita gravações inválidas atomicamente', async () => {
    await db.exec('reset role')
    assert.deepEqual((await query('select public.contrato_plano() contrato'))[0].contrato, CONTRATO_PLANO)
    const perfil = { area: AREAS[0], situacao: SITUACOES[0], objetivo: 'Criar um portefólio profissional',
      disponibilidade: DISPONIBILIDADES[0], internet: INTERNET[0] }
    const antigo = gerarPlano(perfil)
    const novo = gerarPlanoDiario(perfil)
    const alterar = fn => { const p = structuredClone(novo); fn(p); return p }
    const casos = [antigo, novo, alterar(p => { delete p.diagnostico }), alterar(p => { p.semanas[0].numero = '1' }),
      alterar(p => { p.semanas[2].minutosPorTarefa[0] = -1 }), alterar(p => { p.semanas[2].minutosSugeridos = '90' }),
      alterar(p => { p.semanas[0].minutosPorTarefa.pop() }), alterar(p => { p.recursos = [null] }),
      alterar(p => { p.semanas[0].tarefas[0] = '' }), alterar(p => { p.titulo = '𐐀'.repeat(250) }),
      alterar(p => { p.titulo = '𐐀'.repeat(251) }), { titulo: 'Incompleto', semanas: antigo.semanas }]
    for (const plano of casos) {
      const [{ erro }] = await query('select public.erro_plano($1) erro', [plano])
      assert.equal(erro === null, erroPlano(plano) === null)
    }
    await entrar('authenticated', jovem)
    const outroId = '40000000-0000-4000-8000-000000000003'
    await assert.rejects(query('select public.guardar_plano($1,$2,$3,$4)',
      [outroId, casos[2], perfil, []]), erro => erro.code === '22023' && erro.message.includes('diagnostico'))
    assert.deepEqual(await query('select id from public.planos where id=$1', [outroId]), [])
    assert.deepEqual(await query('select chave from public.tarefas where plano_id=$1', [outroId]), [])
    await query('select public.guardar_plano($1,$2,$3,$4)', [outroId, antigo, perfil, ['0-1','3-4']])
    assert.equal((await query('select chave from public.tarefas where plano_id=$1 and concluida', [outroId])).length, 2)
  })

  await t.test('planos e tarefas preservam progresso e isolam edições', async () => {
    const perfil = { area: AREAS[0], situacao: SITUACOES[0], objetivo: 'Aprender a produzir um portefólio digital',
      disponibilidade: DISPONIBILIDADES[0], internet: INTERNET[0] }
    const plano = gerarPlanoDiario(perfil)
    const guardar = () => query('select public.guardar_plano($1,$2,$3,$4)', [planoId, plano, { ...perfil, email:'privado@example.test' }, ['0-1']])
    await entrar('authenticated', jovem)
    await guardar()
    await query("select public.actualizar_tarefa($1,'0-0',true)", [planoId])
    await guardar()
    assert.deepEqual(await query('select chave, dia::int from public.tarefas where plano_id=$1 and concluida order by dia', [planoId]),
      [{ chave:'0-0',dia:1 }, { chave:'0-1',dia:2 }])
    assert.equal((await query("select perfil ? 'email' tem_email from public.planos where id=$1", [planoId]))[0].tem_email, false)
    await entrar('authenticated', outro)
    assert.deepEqual(await query('select * from public.tarefas'), [])
    await assert.rejects(query("select public.actualizar_tarefa($1,'0-0',false)", [planoId]), /indisponível/)
    await assert.rejects(guardar(), /Identificador/)
  })

  await t.test('favoritos, candidaturas, histórico e alertas são privados e idempotentes', async () => {
    await entrar('authenticated', jovem)
    await assert.rejects(query('insert into public.favoritos(oportunidade_id) values ($1)', [rascunho]), /row-level security/)
    await query('insert into public.favoritos(oportunidade_id) values ($1)', [publica])
    const [c] = await query("insert into public.candidaturas(oportunidade_id, titulo) values ($1,'Estágio curricular') returning id", [publica])
    await query("update public.candidaturas set estado = 'entrevista' where id = $1", [c.id])
    assert.deepEqual(await query('select estado from public.historico_candidaturas order by id'), [{ estado: 'guardada' }, { estado: 'entrevista' }])
    await query("select public.actualizar_tarefa($1,'0-0',false)", [planoId])
    const materializar = () => query('select public.materializar_alertas($1::uuid[])', [[publica, rascunho]])
    await materializar()
    await materializar()
    const notificacoes = await query('select tipo from public.notificacoes order by tipo')
    assert.ok(notificacoes.some(n => n.tipo === 'tarefa'))
    assert.equal(notificacoes.filter(n => n.tipo === 'rumomatch').length, 1)
    assert.equal(notificacoes.filter(n => n.tipo === 'prazo').length, 1)
    await entrar('authenticated', outro)
    assert.deepEqual(await query('select * from public.notificacoes'), [])
    assert.deepEqual(await query('select * from public.historico_candidaturas'), [])
    await assert.rejects(query("select public.materializar_alertas('{}', $1)", [jovem]), /Acesso não autorizado/)
    await query('select public.marcar_notificacoes()')
    await entrar('authenticated', jovem)
    assert.deepEqual(await query('select id from public.notificacoes where lida_em is not null'), [])
    await query('select public.marcar_notificacoes()')
    assert.equal((await query('select count(*)::int total from public.notificacoes where lida_em is null'))[0].total, 0)
  })

  await t.test('fila semanal exige consentimento, respeita limite e detecta cancelamento', async () => {
    await entrar('authenticated', jovem)
    await query('insert into public.preferencias_comunicacao(resumo_email) values (true)')
    await assert.rejects(query('select public.criar_resumos()'), /permission denied/)
    await entrar('service_role')
    await query('select public.criar_resumos()')
    await query('select public.criar_resumos()')
    assert.equal((await query('select count(*)::int total from public.envios'))[0].total, 1)
    assert.deepEqual(await query('select * from public.reservar_resumo(0)'), [])
    const [{ id }] = await query('select public.reservar_resumo(1) id')
    assert.equal((await query('select email from public.dados_resumo($1)', [id]))[0].email, 'jovem@example.test')
    await entrar('authenticated', jovem)
    await query('select public.pedir_eliminacao()')
    await query('select public.pedir_eliminacao()')
    assert.equal((await query('select count(*)::int total from public.pedidos_eliminacao'))[0].total, 1)
    assert.deepEqual(await query('select resumo_email, consentimento_em from public.preferencias_comunicacao'), [{ resumo_email: false, consentimento_em: null }])
    await entrar('service_role')
    assert.deepEqual(await query('select * from public.dados_resumo($1)', [id]), [])
  })
})
