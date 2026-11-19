begin;

create function public.data_maputo()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Africa/Maputo')::date $$;

create function public.prazo_vigente(prazo date, hora time)
returns boolean language sql stable set search_path = ''
as $$
  select prazo is null or now() < ((prazo + coalesce(hora, time '24:00')) at time zone 'Africa/Maputo')
$$;

create function public.textos_validos(valores text[], quantidade integer, tamanho integer)
returns boolean language sql immutable set search_path = ''
as $$
  select coalesce(array_ndims(valores), 1) = 1 and cardinality(valores) <= quantidade
    and not exists (select 1 from unnest(valores) as t(valor)
      where valor is null or char_length(trim(valor)) not between 1 and tamanho)
$$;

create function public.url_https(valor text)
returns boolean language sql immutable set search_path = ''
as $$ select char_length(valor) <= 2048 and valor ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]\\]*)?$' $$;

create table public.administradores (
  utilizador uuid primary key references auth.users(id) on delete cascade,
  identificador text not null unique check (identificador ~ '^[a-z][a-z0-9_]{2,31}$')
);

create function public.e_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.administradores where utilizador = auth.uid()) $$;

create table public.perfis (
  utilizador uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 90),
  provincia text not null check (char_length(provincia) <= 30),
  localidade text not null default '' check (char_length(localidade) <= 120),
  escolaridade smallint check (escolaridade between 1 and 5),
  area text not null default '' check (char_length(area) <= 90),
  competencias text[] not null default '{}' check (public.textos_validos(competencias, 25, 80)),
  comportamentais text[] not null default '{}' check (public.textos_validos(comportamentais, 25, 80)),
  experiencia_meses smallint check (experiencia_meses between 0 and 720),
  experiencia text not null default '' check (char_length(experiencia) <= 1200),
  interesses text not null default '' check (char_length(interesses) <= 600),
  objectivos text not null default '' check (char_length(objectivos) <= 600)
);

create table public.preferencias (
  utilizador uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  disponibilidade text not null default '' check (char_length(disponibilidade) <= 90),
  modalidades text[] not null default '{}' check (modalidades <@ array['Presencial','Remoto','Híbrido'] and public.textos_validos(modalidades, 3, 20)),
  tipos text[] not null default '{}' check (tipos <@ array['Emprego','Estágio','Bolsa','Formação','Programa de desenvolvimento'] and public.textos_validos(tipos, 5, 35)),
  provincias text[] not null default '{}' check (public.textos_validos(provincias, 11, 30))
);

create table public.fontes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 150),
  url text not null unique check (public.url_https(url)),
  verificada_em timestamptz,
  activa boolean not null default true
);

create table public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references public.fontes(id),
  titulo text not null check (char_length(trim(titulo)) between 4 and 160),
  entidade text not null check (char_length(trim(entidade)) between 2 and 150),
  provincia text not null default '' check (char_length(provincia) <= 30),
  localidade text not null default '' check (char_length(localidade) <= 120),
  descricao text not null check (char_length(trim(descricao)) between 10 and 6000),
  requisitos text[] not null default '{}' check (public.textos_validos(requisitos, 20, 250)),
  competencias text[] not null default '{}' check (public.textos_validos(competencias, 25, 80)),
  competencias_obrigatorias text[] not null default '{}' check (public.textos_validos(competencias_obrigatorias, 25, 80)),
  area text not null default '' check (char_length(area) <= 90),
  tipo text not null check (tipo in ('Emprego','Estágio','Bolsa','Formação','Programa de desenvolvimento')),
  modalidade text not null default '' check (modalidade in ('','Presencial','Remoto','Híbrido')),
  escolaridade smallint check (escolaridade between 1 and 5),
  experiencia_meses smallint check (experiencia_meses between 0 and 720),
  data_publicacao date,
  prazo date,
  prazo_hora time check (prazo_hora is null or prazo is not null),
  url_original text not null check (public.url_https(url_original)),
  url_candidatura text not null check (public.url_https(url_candidatura)),
  verificada_em timestamptz,
  estado text not null default 'rascunho' check (estado in ('rascunho','activa','arquivada')),
  check (data_publicacao is null or prazo is null or data_publicacao <= prazo),
  check (estado <> 'activa' or verificada_em is not null)
);
create index oportunidades_catalogo on public.oportunidades (verificada_em desc, id) where estado = 'activa';
create index oportunidades_fonte on public.oportunidades (fonte_id);
create index oportunidades_prazo on public.oportunidades (prazo) where estado = 'activa';

create view public.catalogo_oportunidades with (security_invoker = true) as
  select o.*, f.nome as fonte_nome, f.url as fonte_url
  from public.oportunidades o join public.fontes f on f.id = o.fonte_id
  where o.estado = 'activa' and o.verificada_em between now() - interval '30 days' and now()
    and public.prazo_vigente(o.prazo, o.prazo_hora)
    and (o.data_publicacao is null or o.data_publicacao <= public.data_maputo())
    and f.activa and f.verificada_em between now() - interval '90 days' and now();

create table public.favoritos (
  utilizador uuid not null default auth.uid() references auth.users(id) on delete cascade,
  oportunidade_id uuid not null references public.oportunidades(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (utilizador, oportunidade_id)
);
create index favoritos_oportunidade on public.favoritos(oportunidade_id);

create table public.candidaturas (
  id uuid primary key default gen_random_uuid(),
  utilizador uuid not null default auth.uid() references auth.users(id) on delete cascade,
  oportunidade_id uuid references public.oportunidades(id) on delete set null,
  titulo text not null check (char_length(trim(titulo)) between 3 and 160),
  entidade text not null default '' check (char_length(entidade) <= 150),
  estado text not null default 'guardada' check (estado in ('guardada','em_preparacao','enviada','em_analise','entrevista','seleccionado','nao_seleccionado','arquivada')),
  data_evento date not null default public.data_maputo(),
  notas text not null default '' check (char_length(notas) <= 4000),
  actualizado_em timestamptz not null default now(),
  unique (id, utilizador)
);
create index candidaturas_utilizador on public.candidaturas(utilizador, actualizado_em desc);
create index candidaturas_oportunidade on public.candidaturas(oportunidade_id);
create table public.historico_candidaturas (
  id bigint generated always as identity primary key,
  candidatura_id uuid not null,
  utilizador uuid not null,
  estado text not null,
  data_evento date not null,
  registado_em timestamptz not null default now(),
  foreign key (candidatura_id, utilizador) references public.candidaturas(id, utilizador) on delete cascade
);
create index historico_candidaturas_utilizador on public.historico_candidaturas (utilizador, candidatura_id, id desc);

create function public.registar_candidatura() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.oportunidade_id is not null
     and (tg_op = 'INSERT' or new.oportunidade_id is distinct from old.oportunidade_id)
     and not exists(select 1 from public.catalogo_oportunidades where id = new.oportunidade_id) then
    raise exception 'Oportunidade indisponível';
  end if;
  if auth.uid() is not null and (tg_op = 'INSERT' or
    (new.estado, new.data_evento) is distinct from (old.estado, old.data_evento)) then
    insert into public.historico_candidaturas(candidatura_id, utilizador, estado, data_evento)
    values (new.id, new.utilizador, new.estado, new.data_evento);
  end if;
  return new;
end $$;
create trigger candidaturas_historico after insert or update on public.candidaturas
for each row execute function public.registar_candidatura();

create function public.cv_valido(dados jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare limites jsonb := '{"nome":90,"cargo":120,"localidade":120,"email":254,"telefone":36,"portefolio":500,
  "resumo":1200,"formacao":2200,"experiencia":3200,"competencias":1400,"certificacoes":1600,"idiomas":700,"projectos":2400}';
begin
  if jsonb_typeof(dados) is distinct from 'object' or octet_length(dados::text) > 48000
    or jsonb_typeof(dados->'nome') is distinct from 'string'
    or char_length(trim(dados->>'nome')) < 2 then return false; end if;
  if coalesce(dados->>'portefolio','') <> '' and not public.url_https(dados->>'portefolio') then return false; end if;
  return not exists(select 1 from jsonb_each(dados) as e(campo, valor)
    where not (limites ? campo) or jsonb_typeof(valor) <> 'string'
      or char_length(valor #>> '{}') > (limites->>campo)::integer);
end $$;

create table public.curriculos (
  utilizador uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  dados jsonb not null check (public.cv_valido(dados)),
  actualizado_em timestamptz not null default now()
);

create table public.planos (
  id uuid primary key,
  utilizador uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 250),
  dados jsonb not null check (jsonb_typeof(dados) = 'object' and octet_length(dados::text) <= 72000),
  perfil jsonb not null check (jsonb_typeof(perfil) = 'object' and octet_length(perfil::text) <= 6000),
  criado_em timestamptz not null default now(),
  actualizado_em timestamptz not null default now(),
  unique (id, utilizador)
);
create index planos_utilizador on public.planos (utilizador, actualizado_em desc);
create table public.tarefas (
  plano_id uuid not null,
  utilizador uuid not null,
  chave text not null check (chave ~ '^[0-3]-[0-9]$'),
  titulo text not null check (char_length(titulo) between 1 and 1200),
  dia smallint not null check (dia between 1 and 30),
  concluida boolean not null default false,
  primary key (plano_id, chave),
  foreign key (plano_id, utilizador) references public.planos (id, utilizador) on delete cascade
);
create index tarefas_utilizador on public.tarefas(utilizador) where not concluida;

create table public.preferencias_comunicacao (
  utilizador uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  novas boolean not null default true,
  prazos boolean not null default true,
  tarefas boolean not null default true,
  resumo_email boolean not null default false,
  consentimento_em timestamptz
);

create table public.notificacoes (
  id bigint generated always as identity primary key,
  utilizador uuid not null references auth.users(id) on delete cascade,
  chave text not null check (char_length(chave) <= 160),
  tipo text not null check (tipo in ('rumomatch','prazo','tarefa')),
  titulo text not null check (char_length(titulo) <= 320),
  oportunidade_id uuid references public.oportunidades(id) on delete set null,
  criada_em timestamptz not null default now(),
  lida_em timestamptz,
  unique (utilizador, chave)
);
create index notificacoes_utilizador on public.notificacoes (utilizador, criada_em desc);

create table public.envios (
  id uuid primary key default gen_random_uuid(),
  utilizador uuid not null references auth.users(id) on delete cascade,
  semana date not null,
  estado text not null default 'pendente' check (estado in ('pendente','em_envio','aceite','falhou','incerto','cancelado')),
  motivo text check (motivo in ('fornecedor','limite','rede','interrompido','sem_consentimento')),
  tentado_em timestamptz,
  actualizado_em timestamptz not null default now(),
  unique (utilizador, semana)
);
create index envios_pendentes on public.envios (semana, id) where estado = 'pendente';

create table public.pedidos_eliminacao (
  utilizador uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  operador text not null,
  entidade text not null,
  registo uuid not null,
  acao text not null,
  estado text,
  criado_em timestamptz not null default now()
);
create index auditoria_data on public.auditoria(criado_em desc);

do $$
declare t text;
begin
  foreach t in array array['administradores','perfis','preferencias','fontes','oportunidades','favoritos','candidaturas',
    'historico_candidaturas','curriculos','planos','tarefas','preferencias_comunicacao','notificacoes','envios','pedidos_eliminacao','auditoria']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
  foreach t in array array['perfis','preferencias','candidaturas','curriculos','favoritos','preferencias_comunicacao']
  loop
    execute format('create policy titular on public.%I for all to authenticated using (utilizador = (select auth.uid())) with check (utilizador = (select auth.uid()))', t);
  end loop;
  foreach t in array array['planos','tarefas','historico_candidaturas','notificacoes','pedidos_eliminacao','envios']
  loop
    execute format('create policy leitura_titular on public.%I for select to authenticated using (utilizador = (select auth.uid()))', t);
  end loop;
end $$;

grant select, insert, update on public.perfis, public.preferencias, public.candidaturas,
  public.curriculos, public.preferencias_comunicacao to authenticated;
grant select, insert, delete on public.favoritos to authenticated;
grant select on public.planos, public.tarefas, public.historico_candidaturas,
  public.notificacoes, public.pedidos_eliminacao, public.envios, public.auditoria to authenticated;
grant select on public.fontes, public.oportunidades, public.catalogo_oportunidades to anon, authenticated;
grant insert, update on public.fontes, public.oportunidades to authenticated;
grant select, insert, update on public.envios to service_role;
grant select on public.perfis, public.preferencias, public.preferencias_comunicacao, public.pedidos_eliminacao, public.catalogo_oportunidades,
  public.fontes, public.oportunidades to service_role;

create policy fonte_publica on public.fontes for select to anon, authenticated
using (activa and verificada_em between now() - interval '90 days' and now());
create policy oportunidade_publica on public.oportunidades for select to anon, authenticated
using (estado = 'activa' and verificada_em between now() - interval '30 days' and now()
  and public.prazo_vigente(prazo, prazo_hora) and (data_publicacao is null or data_publicacao <= public.data_maputo())
  and exists(select 1 from public.fontes f where f.id = fonte_id and f.activa and
    f.verificada_em between now() - interval '90 days' and now()));
create policy fontes_admin on public.fontes for all to authenticated using ((select public.e_admin())) with check ((select public.e_admin()));
create policy oportunidades_admin on public.oportunidades for all to authenticated using ((select public.e_admin())) with check ((select public.e_admin()));
create policy auditoria_admin on public.auditoria for select to authenticated using ((select public.e_admin()));

create function public.registar_moderacao() returns trigger language plpgsql security definer set search_path = '' as $$
declare operador text; acao text := lower(tg_op);
begin
  select a.identificador into operador from public.administradores a where a.utilizador = auth.uid();
  if operador is null then raise exception 'Acesso administrativo necessário' using errcode = '42501'; end if;
  if tg_table_name = 'oportunidades' and to_jsonb(new)->>'estado' = 'activa' then
    if new.verificada_em < now() - interval '30 days'
       or new.verificada_em > now() + interval '5 minutes'
       or not public.prazo_vigente(new.prazo, new.prazo_hora)
       or (new.data_publicacao is not null and new.data_publicacao > public.data_maputo())
       or not exists(select 1 from public.fontes f where f.id = new.fonte_id and f.activa
         and f.verificada_em between now() - interval '90 days' and now())
    then raise exception 'Valide a fonte, o anúncio e as datas antes de publicar'; end if;
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'oportunidades' and to_jsonb(new)->>'estado' = 'activa'
     and (to_jsonb(new) - 'verificada_em') is distinct from (to_jsonb(old) - 'verificada_em')
     and new.verificada_em is not distinct from old.verificada_em then
    raise exception 'Registe uma nova verificação para alterar anúncios públicos';
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'fontes' and
     to_jsonb(new)->>'url' is distinct from to_jsonb(old)->>'url' and
     new.verificada_em is not null and new.verificada_em is not distinct from old.verificada_em then
    raise exception 'A nova ligação exige uma nova verificação';
  end if;
  if tg_op = 'UPDATE' and new.verificada_em is distinct from old.verificada_em and new.verificada_em is not null then
    acao := 'verificacao';
  end if;
  insert into public.auditoria(operador, entidade, registo, acao, estado)
  values (operador, tg_table_name, new.id, acao, coalesce(to_jsonb(new)->>'estado', to_jsonb(new)->>'activa'));
  return new;
end $$;
create trigger auditar_fontes after insert or update on public.fontes for each row execute function public.registar_moderacao();
create trigger auditar_oportunidades after insert or update on public.oportunidades for each row execute function public.registar_moderacao();

create function public.actualizar_data() returns trigger language plpgsql set search_path = '' as $$
begin new.actualizado_em := now(); return new; end $$;
create trigger candidaturas_data before update on public.candidaturas for each row execute function public.actualizar_data();
create trigger curriculos_data before update on public.curriculos for each row execute function public.actualizar_data();
create trigger envios_data before update on public.envios for each row execute function public.actualizar_data();

create function public.preferencias_consentimento() returns trigger language plpgsql set search_path = '' as $$
begin
  if not new.resumo_email then
    new.consentimento_em := null;
  elsif tg_op = 'INSERT' or not old.resumo_email then
    new.consentimento_em := now();
  else
    new.consentimento_em := old.consentimento_em;
  end if;
  return new;
end $$;
create trigger preferencias_consentimento before insert or update on public.preferencias_comunicacao
for each row execute function public.preferencias_consentimento();

create function public.pedir_eliminacao() returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Inicie sessão' using errcode = '42501'; end if;
  insert into public.pedidos_eliminacao(utilizador) values (uid) on conflict do nothing;
  update public.preferencias_comunicacao set resumo_email = false where utilizador = uid;
end $$;

create function public.marcar_notificacoes(p_id bigint default null)
returns void language sql security definer set search_path = '' as $$
  update public.notificacoes set lida_em = now()
  where utilizador = auth.uid() and lida_em is null and (p_id is null or id = p_id)
$$;

create function public.arquivar_expiradas()
returns integer language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
  if not public.e_admin() then raise exception 'Acesso administrativo necessário' using errcode = '42501'; end if;
  update public.oportunidades set estado = 'arquivada' where estado = 'activa' and not public.prazo_vigente(prazo, prazo_hora);
  get diagnostics total = row_count;
  return total;
end $$;

create function public.relatorio_admin()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.e_admin() then raise exception 'Acesso administrativo necessário' using errcode = '42501'; end if;
  return jsonb_build_object(
    'publicadas', (select count(*) from public.catalogo_oportunidades),
    'estados', (select coalesce(jsonb_object_agg(estado, total), '{}'::jsonb) from
      (select estado, count(*) total from public.oportunidades group by estado) o),
    'fontes', (select count(*) from public.fontes where activa),
    'notificacoes', (select count(*) from public.notificacoes),
    'envios', (select coalesce(jsonb_object_agg(estado, total), '{}'::jsonb) from
      (select estado, count(*) total from public.envios group by estado) e),
    'ultimas_falhas', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from
      (select estado, motivo, tentado_em from public.envios where estado in ('incerto','falhou')
       order by actualizado_em desc limit 20) f),
    'pedidos_eliminacao', (select count(*) from public.pedidos_eliminacao)
  );
end $$;

revoke execute on function public.e_admin(), public.pedir_eliminacao(), public.marcar_notificacoes(bigint),
  public.arquivar_expiradas(), public.relatorio_admin() from public, anon, authenticated;
grant execute on function public.e_admin(), public.pedir_eliminacao(), public.marcar_notificacoes(bigint),
  public.arquivar_expiradas(), public.relatorio_admin() to authenticated;
revoke execute on function public.registar_candidatura(), public.registar_moderacao(), public.actualizar_data(),
  public.preferencias_consentimento() from public, anon, authenticated;

commit;
