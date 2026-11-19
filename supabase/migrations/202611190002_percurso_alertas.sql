begin;

create function public.pesquisar_oportunidades(
  p_texto text default null, p_area text default null, p_provincia text default null,
  p_entidade text default null, p_tipo text default null, p_modalidade text default null,
  p_escolaridade integer default null, p_experiencia integer default null, p_prazo integer default null,
  p_publicacao date default null
) returns setof public.catalogo_oportunidades language sql stable security invoker set search_path = '' as $$
  select o.* from public.catalogo_oportunidades o
  where (p_texto is null or strpos(lower(concat_ws(' ', o.titulo, o.entidade, o.descricao,
    array_to_string(o.competencias, ' '), array_to_string(o.requisitos, ' '))), lower(left(p_texto, 120))) > 0)
    and (p_area is null or o.area = p_area)
    and (p_provincia is null or o.provincia = p_provincia)
    and (p_entidade is null or strpos(lower(o.entidade), lower(left(p_entidade, 150))) > 0)
    and (p_tipo is null or o.tipo = p_tipo)
    and (p_modalidade is null or o.modalidade = p_modalidade)
    and (p_escolaridade is null or o.escolaridade <= p_escolaridade)
    and (p_experiencia is null or o.experiencia_meses <= p_experiencia)
    and (p_prazo is null or o.prazo between public.data_maputo() and public.data_maputo() + greatest(0, least(p_prazo, 90)))
    and (p_publicacao is null or o.data_publicacao >= p_publicacao)
$$;

create policy favorito_disponivel on public.favoritos as restrictive for insert to authenticated
with check (exists(select 1 from public.catalogo_oportunidades where id = oportunidade_id));

create function public.guardar_perfil(p_perfil jsonb, p_preferencias jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Inicie sessão' using errcode = '42501'; end if;
  insert into public.perfis as actual (utilizador, nome, provincia, localidade, escolaridade, area,
    competencias, comportamentais, experiencia_meses, experiencia, interesses, objectivos)
  select uid, nome, provincia, localidade, escolaridade, area, competencias, comportamentais,
    experiencia_meses, experiencia, interesses, objectivos from jsonb_populate_record(null::public.perfis, p_perfil)
  on conflict (utilizador) do update set
    (nome, provincia, localidade, escolaridade, area, competencias, comportamentais,
     experiencia_meses, experiencia, interesses, objectivos) =
    (excluded.nome, excluded.provincia, excluded.localidade, excluded.escolaridade, excluded.area,
     excluded.competencias, excluded.comportamentais, excluded.experiencia_meses, excluded.experiencia,
     excluded.interesses, excluded.objectivos);
  insert into public.preferencias (utilizador, disponibilidade, modalidades, tipos, provincias)
  select uid, disponibilidade, modalidades, tipos, provincias
    from jsonb_populate_record(null::public.preferencias, p_preferencias)
  on conflict (utilizador) do update set (disponibilidade, modalidades, tipos, provincias) =
    (excluded.disponibilidade, excluded.modalidades, excluded.tipos, excluded.provincias);
end $$;
revoke execute on function public.guardar_perfil(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.guardar_perfil(jsonb,jsonb) to authenticated;

create function public.guardar_plano(p_id uuid, p_plano jsonb, p_perfil jsonb, p_concluidas text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Inicie sessão' using errcode = '42501'; end if;
  if jsonb_typeof(p_plano->'semanas') is distinct from 'array' or octet_length(p_plano::text) > 72000
     or jsonb_typeof(p_perfil) is distinct from 'object' then raise exception 'Plano inválido'; end if;
  if jsonb_array_length(p_plano->'semanas') <> 4 or exists(
    select 1 from jsonb_array_elements(p_plano->'semanas') as s(semana)
    where case when jsonb_typeof(semana->'tarefas') = 'array'
      then jsonb_array_length(semana->'tarefas') not between 1 and 10 else true end
  ) then raise exception 'Tarefas inválidas'; end if;
  if exists(select 1 from jsonb_array_elements(p_plano->'semanas') as s(semana)
    cross join lateral jsonb_array_elements(semana->'tarefas') as t(tarefa)
    where jsonb_typeof(tarefa) <> 'string') then raise exception 'Tarefas inválidas'; end if;
  insert into public.planos(id, utilizador, titulo, dados, perfil)
  values(p_id, uid, p_plano->>'titulo', p_plano,
    coalesce((select jsonb_object_agg(chave, valor) from jsonb_each(p_perfil) as p(chave, valor)
      where chave = any(array['nome','area','situacao','objetivo','disponibilidade','internet','competencias','dificuldade','usarIA'])), '{}'::jsonb))
  on conflict (id) do nothing;
  if not found then
    if exists(select 1 from public.planos where id = p_id and utilizador = uid and dados = p_plano) then return p_id; end if;
    raise exception 'Identificador de plano indisponível' using errcode = '42501';
  end if;
  insert into public.tarefas(plano_id, utilizador, chave, titulo, dia, concluida)
  select p_id, uid, chave, tarefa, dia, chave = any(coalesce(p_concluidas, '{}'))
  from (
    select (ord_semana - 1)::text || '-' || (ord_tarefa - 1)::text chave, tarefa,
      least(30, ((ord_semana - 1) * 7 + 1 +
        floor((ord_tarefa - 1) * (case when ord_semana = 4 then 9 else 7 end)::numeric /
          jsonb_array_length(semana->'tarefas')))::smallint) dia
    from jsonb_array_elements(p_plano->'semanas') with ordinality as s(semana, ord_semana)
    cross join lateral jsonb_array_elements_text(semana->'tarefas') with ordinality as t(tarefa, ord_tarefa)
  ) itens;
  return p_id;
end $$;

create function public.resumo_candidaturas()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(estado, total), '{}'::jsonb)
  from (select estado, count(*) total from public.candidaturas where utilizador = auth.uid() group by estado) c
$$;
revoke execute on function public.resumo_candidaturas() from public, anon, authenticated;
grant execute on function public.resumo_candidaturas() to authenticated;

create function public.actualizar_tarefa(p_plano uuid, p_chave text, p_concluida boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.tarefas set concluida = p_concluida
    where plano_id = p_plano and chave = p_chave and utilizador = auth.uid();
  if not found then raise exception 'Tarefa indisponível' using errcode = '42501'; end if;
  update public.planos set actualizado_em = now() where id = p_plano and utilizador = auth.uid();
end $$;

create function public.materializar_alertas(p_correspondencias uuid[] default '{}', p_utilizador uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := coalesce(p_utilizador, auth.uid());
  preferencias public.preferencias_comunicacao%rowtype;
  hoje date := public.data_maputo();
begin
  if uid is null or (p_utilizador is not null and coalesce(auth.role(), '') <> 'service_role') then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if exists(select 1 from public.pedidos_eliminacao where utilizador = uid) then return; end if;
  select * into preferencias from public.preferencias_comunicacao where utilizador = uid;

  if coalesce(preferencias.novas, true) then
    insert into public.notificacoes (utilizador, chave, tipo, titulo, oportunidade_id)
    select uid, 'match:' || id, 'rumomatch', 'Nova correspondência: ' || titulo, id
    from public.catalogo_oportunidades
    where id = any(p_correspondencias[1:30])
    order by verificada_em desc limit 30 on conflict (utilizador, chave) do nothing;
  end if;
  if coalesce(preferencias.prazos, true) then
    insert into public.notificacoes (utilizador, chave, tipo, titulo, oportunidade_id)
    select uid, 'prazo:' || o.id || ':' || o.prazo, 'prazo', 'Prazo próximo: ' || o.titulo, o.id
    from public.catalogo_oportunidades o where o.prazo between hoje and hoje + 3 and (
      o.id = any(p_correspondencias[1:30]) or
      exists(select 1 from public.favoritos f where f.utilizador = uid and f.oportunidade_id = o.id) or
      exists(select 1 from public.candidaturas c where c.utilizador = uid and c.oportunidade_id = o.id
        and c.estado in ('guardada','em_preparacao'))
    ) order by o.prazo limit 50 on conflict (utilizador, chave) do nothing;
  end if;
  if coalesce(preferencias.tarefas, true) then
    insert into public.notificacoes (utilizador, chave, tipo, titulo)
    select uid, 'tarefa:' || p.id || ':' || t.chave, 'tarefa',
      'Tarefa do plano: ' || left(t.titulo, 300)
    from public.planos p join public.tarefas t on t.plano_id = p.id
    where p.utilizador = uid and not t.concluida
      and (p.criado_em at time zone 'Africa/Maputo')::date + (t.dia - 1) between hoje - 2 and hoje
      and p.id = (select id from public.planos where utilizador = uid order by actualizado_em desc, id limit 1)
    order by t.dia, t.chave limit 4 on conflict (utilizador, chave) do nothing;
  end if;
end $$;

create function public.criar_resumos()
returns void language sql security definer set search_path = '' as $$
  insert into public.envios(utilizador, semana)
  select p.utilizador, date_trunc('week', public.data_maputo()::timestamp)::date
  from public.preferencias_comunicacao p join auth.users u on u.id = p.utilizador
  where p.resumo_email and p.consentimento_em is not null and u.email_confirmed_at is not null
    and not exists(select 1 from public.pedidos_eliminacao where utilizador = p.utilizador)
    and exists(select 1 from public.notificacoes n where n.utilizador = p.utilizador
      and n.criada_em >= now() - interval '7 days')
  on conflict (utilizador, semana) do nothing
$$;

create index envios_tentativas on public.envios(tentado_em) where tentado_em is not null;

create function public.reservar_resumo(p_limite integer)
returns setof uuid language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(42680, 1);
  update public.envios set estado = 'incerto', motivo = 'interrompido'
    where estado = 'em_envio' and tentado_em < now() - interval '30 minutes';
  update public.envios set estado = 'cancelado' where estado = 'pendente'
    and semana < date_trunc('week', public.data_maputo()::timestamp)::date;
  if (select count(*) from public.envios where
     tentado_em >= (public.data_maputo()::timestamp at time zone 'Africa/Maputo')) >= greatest(0, least(p_limite, 100))
     or exists(select 1 from public.envios where tentado_em > now() - interval '1 second') then return; end if;
  return query
    update public.envios set estado = 'em_envio', tentado_em = now()
    where id in (select id from public.envios where estado = 'pendente'
      order by semana, id limit 1 for update skip locked)
    returning id;
end $$;

create function public.dados_resumo(p_envio uuid)
returns table(email text, total bigint) language sql stable security definer set search_path = '' as $$
  select u.email::text, (select count(*) from public.notificacoes n
    where n.utilizador = e.utilizador and n.criada_em >= now() - interval '7 days')
  from public.envios e join public.preferencias_comunicacao p using (utilizador)
  join auth.users u on u.id = e.utilizador
  where e.id = p_envio and e.estado = 'em_envio' and p.resumo_email
    and p.consentimento_em is not null and p.consentimento_em <= e.tentado_em
    and u.email_confirmed_at is not null
    and not exists(select 1 from public.pedidos_eliminacao where utilizador = e.utilizador)
$$;

create function public.actores_alertas(p_depois uuid default null)
returns table(utilizador uuid, perfil jsonb, preferencias jsonb) language sql stable security definer set search_path = '' as $$
  select u.id, jsonb_build_object('area', p.area, 'escolaridade', p.escolaridade,
    'experiencia_meses', p.experiencia_meses, 'competencias', p.competencias, 'provincia', p.provincia),
    coalesce(to_jsonb(f) - 'utilizador'::text, '{}'::jsonb)
  from auth.users u
  left join public.perfis p on p.utilizador = u.id
  left join public.preferencias f on f.utilizador = u.id
  where u.email_confirmed_at is not null and (p_depois is null or u.id > p_depois) and
    not exists(select 1 from public.pedidos_eliminacao e where e.utilizador = u.id)
  order by u.id limit 8
$$;

create table public.execucoes_alertas (
  chave boolean primary key default true check (chave),
  cursor_utilizador uuid,
  estado text not null default 'pendente' check (estado in ('pendente','concluido','falhou')),
  actualizado_em timestamptz not null default now()
);
insert into public.execucoes_alertas default values;
alter table public.execucoes_alertas enable row level security;
revoke all on public.execucoes_alertas from public, anon, authenticated;
grant select, update on public.execucoes_alertas to service_role;
create trigger execucoes_alertas_data before update on public.execucoes_alertas for each row execute function public.actualizar_data();

create function public.estado_alertas()
returns table(estado text, actualizado_em timestamptz) language sql stable security definer set search_path = '' as $$
  select e.estado, e.actualizado_em from public.execucoes_alertas e where public.e_admin()
$$;

revoke execute on function public.pesquisar_oportunidades(text,text,text,text,text,text,integer,integer,integer,date),
  public.guardar_plano(uuid,jsonb,jsonb,text[]), public.actualizar_tarefa(uuid,text,boolean),
  public.materializar_alertas(uuid[],uuid), public.criar_resumos(), public.reservar_resumo(integer),
  public.dados_resumo(uuid), public.actores_alertas(uuid), public.estado_alertas() from public, anon, authenticated;
grant execute on function public.pesquisar_oportunidades(text,text,text,text,text,text,integer,integer,integer,date) to anon, authenticated;
grant execute on function public.guardar_plano(uuid,jsonb,jsonb,text[]), public.actualizar_tarefa(uuid,text,boolean),
  public.materializar_alertas(uuid[],uuid), public.estado_alertas() to authenticated;
grant execute on function public.materializar_alertas(uuid[],uuid), public.criar_resumos(), public.reservar_resumo(integer),
  public.dados_resumo(uuid), public.actores_alertas(uuid) to service_role;

commit;
