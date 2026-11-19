begin;

create table public.configuracao_alertas (
  id uuid primary key,
  internos boolean not null default true,
  resumos boolean not null default false
);
insert into public.configuracao_alertas(id) values ('00000000-0000-4000-8000-000000000001');

alter table public.configuracao_alertas enable row level security;
revoke all on public.configuracao_alertas from public, anon, authenticated;
grant select on public.configuracao_alertas to authenticated, service_role;
grant update (internos, resumos) on public.configuracao_alertas to authenticated;
create policy configuracao_admin on public.configuracao_alertas for all to authenticated
using ((select public.e_admin())) with check ((select public.e_admin()));

create function public.auditar_configuracao() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (old.internos, old.resumos) is distinct from (new.internos, new.resumos) then
    insert into public.auditoria(operador, entidade, registo, acao, estado)
    select identificador, 'configuracao_alertas', new.id, 'update',
      format('internos=%s, resumos=%s', new.internos, new.resumos)
    from public.administradores where utilizador = auth.uid();
  end if;
  return new;
end $$;
revoke execute on function public.auditar_configuracao() from public, anon, authenticated;
create trigger config_auditoria after update on public.configuracao_alertas
for each row execute function public.auditar_configuracao();

commit;
