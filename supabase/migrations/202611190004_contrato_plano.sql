begin;

-- Espelho de shared/contratoPlano.js. A integração compara a definição e os resultados.
create function public.contrato_plano()
returns jsonb language sql immutable set search_path = '' as $$
  select '{
    "textos": {"titulo": 250, "diagnostico": 2000, "estrategia": 2000, "metodo": 150},
    "listas": {"recursos": [20, 500], "avisos": [20, 500]},
    "semanas": 4,
    "semana": {
      "textos": {"titulo": 250, "foco": 800, "entregavel": 800, "indicador": 800},
      "tarefas": [1, 10, 1200],
      "minutosSugeridos": 10080,
      "minutosPorTarefa": 1440
    }
  }'::jsonb
$$;

create function public.texto_plano_valido(valor jsonb, limite integer)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(valor) is not distinct from 'string' and
    char_length(valor #>> '{}') between 1 and limite
$$;

create function public.minutos_plano_validos(valor jsonb, limite integer)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(valor) = 'number' then
    (valor::text)::numeric between 0 and limite and trunc((valor::text)::numeric) = (valor::text)::numeric
    else false end
$$;

create function public.erro_plano(plano jsonb)
returns text language plpgsql immutable set search_path = '' as $$
declare
  regras jsonb := public.contrato_plano();
  semana jsonb;
  campo text;
  limite jsonb;
  lista jsonb;
  numero integer := 0;
begin
  if jsonb_typeof(plano) is distinct from 'object' then return 'O plano deve ser um objecto.'; end if;
  for campo, limite in select key, value from jsonb_each(regras->'textos') loop
    if not public.texto_plano_valido(plano->campo, limite::text::integer) then
      return format('Campo inválido no plano: %s.', campo);
    end if;
  end loop;
  for campo, limite in select key, value from jsonb_each(regras->'listas') loop
    lista := plano->campo;
    if jsonb_typeof(lista) is distinct from 'array' then return format('Lista inválida no plano: %s.', campo); end if;
    if jsonb_array_length(lista) > (limite->>0)::integer or exists (
      select 1 from jsonb_array_elements(lista) as l(valor)
      where not public.texto_plano_valido(valor, (limite->>1)::integer)
    ) then return format('Lista inválida no plano: %s.', campo); end if;
  end loop;
  if jsonb_typeof(plano->'semanas') is distinct from 'array' then return 'O plano deve ter quatro semanas.'; end if;
  if jsonb_array_length(plano->'semanas') <> (regras->>'semanas')::integer then return 'O plano deve ter quatro semanas.'; end if;
  regras := regras->'semana';
  for semana in select value from jsonb_array_elements(plano->'semanas') loop
    numero := numero + 1;
    if jsonb_typeof(semana) is distinct from 'object' or (semana->'numero') is distinct from to_jsonb(numero) then
      return format('Numeração inválida na semana %s.', numero);
    end if;
    for campo, limite in select key, value from jsonb_each(regras->'textos') loop
      if not public.texto_plano_valido(semana->campo, limite::text::integer) then
        return format('Campo inválido na semana %s: %s.', numero, campo);
      end if;
    end loop;
    lista := semana->'tarefas';
    limite := regras->'tarefas';
    if jsonb_typeof(lista) is distinct from 'array' then return format('Tarefas inválidas na semana %s.', numero); end if;
    if jsonb_array_length(lista) not between (limite->>0)::integer and (limite->>1)::integer or exists (
      select 1 from jsonb_array_elements(lista) as l(valor)
      where not public.texto_plano_valido(valor, (limite->>2)::integer)
    ) then return format('Tarefas inválidas na semana %s.', numero); end if;
    lista := semana->'minutosPorTarefa';
    if not public.minutos_plano_validos(semana->'minutosSugeridos', (regras->>'minutosSugeridos')::integer) or
      jsonb_typeof(lista) is distinct from 'array' then return format('Duração inválida na semana %s.', numero); end if;
    if jsonb_array_length(lista) <> jsonb_array_length(semana->'tarefas') or exists (
      select 1 from jsonb_array_elements(lista) as l(valor)
      where not public.minutos_plano_validos(valor, (regras->>'minutosPorTarefa')::integer)
    ) then return format('Duração inválida na semana %s.', numero); end if;
  end loop;
  return null;
end $$;

create function public.validar_dados_plano()
returns trigger language plpgsql security definer set search_path = '' as $$
declare falha text := public.erro_plano(new.dados);
begin
  if falha is not null then
    raise exception using errcode = '22023', message = falha;
  end if;
  return new;
end $$;

-- Validação em novas escritas. Nenhum plano existente é reescrito.
create trigger validar_dados_plano
before insert or update of dados on public.planos
for each row execute function public.validar_dados_plano();

revoke execute on function public.contrato_plano(), public.texto_plano_valido(jsonb, integer),
  public.minutos_plano_validos(jsonb, integer), public.erro_plano(jsonb), public.validar_dados_plano()
  from public, anon, authenticated;

commit;
