begin;

-- Controle separado da decisão operacional.
-- Não altera nem apaga a confirmação feita pela equipe.

create table public.freight_dashboard_controls (
  shipment_code text primary key
    check (
      shipment_code = btrim(shipment_code)
      and length(shipment_code) between 1 and 100
    ),

  excluded boolean not null,

  reason text not null
    check (length(btrim(reason)) between 1 and 2000),

  changed_by uuid not null
    references auth.users(id),

  changed_at timestamptz not null default now(),

  revision integer not null default 1
    check (revision > 0)
);

-- Histórico de retiradas e restaurações.

create table public.freight_dashboard_control_events (
  id uuid primary key default gen_random_uuid(),

  shipment_code text not null
    references public.freight_dashboard_controls(shipment_code),

  previous_excluded boolean,
  new_excluded boolean not null,

  reason text not null
    check (length(btrim(reason)) between 1 and 2000),

  changed_by uuid not null
    references auth.users(id),

  changed_at timestamptz not null default now(),

  revision integer not null,

  unique (shipment_code, revision)
);

alter table public.freight_dashboard_controls
  enable row level security;

alter table public.freight_dashboard_control_events
  enable row level security;

-- Usuários cadastrados podem consultar se uma remessa foi retirada.
-- A alteração só será permitida pela função administrativa abaixo.

create policy freight_dashboard_controls_read
  on public.freight_dashboard_controls
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('admin', 'employee')
    )
  );

-- O histórico administrativo é consultado somente pelo administrador.

create policy freight_dashboard_control_events_admin_read
  on public.freight_dashboard_control_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

revoke all on table
  public.freight_dashboard_controls,
  public.freight_dashboard_control_events
from public, anon, authenticated;

grant select on table
  public.freight_dashboard_controls,
  public.freight_dashboard_control_events
to authenticated;

-- Retira ou restaura uma remessa.
-- Exige administrador, motivo e versão atual do controle.

create function public.set_freight_dashboard_control(
  p_shipment_code text,
  p_excluded boolean,
  p_expected_revision integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_code text;
  v_reason text;
  v_now timestamptz;

  v_current public.freight_dashboard_controls%rowtype;
  v_saved public.freight_dashboard_controls%rowtype;

  v_exists boolean;
  v_previous_excluded boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Sua sessão expirou. Entre novamente.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.role = 'admin'
  ) then
    raise exception
      'Somente o administrador pode retirar ou restaurar remessas no dashboard.';
  end if;

  v_code := btrim(coalesce(p_shipment_code, ''));
  v_reason := btrim(coalesce(p_reason, ''));

  if length(v_code) not between 1 and 100 then
    raise exception 'Informe um número de remessa válido.';
  end if;

  if p_excluded is null then
    raise exception 'Informe se deseja retirar ou restaurar a remessa.';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Versão inválida. Atualize a tela.';
  end if;

  if length(v_reason) not between 1 and 2000 then
    raise exception
      'Informe o motivo, com até 2.000 caracteres.';
  end if;

  -- Serializa operações sobre a mesma remessa,
  -- inclusive quando o controle ainda não existe.

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'freight_dashboard_control:' || v_code,
      0
    )
  );

  if not exists (
    select 1
    from public.freight_shipment_decisions d
    where d.shipment_code = v_code
  ) then
    raise exception
      'Não foi encontrada uma decisão salva para esta remessa.';
  end if;

  select *
  into v_current
  from public.freight_dashboard_controls
  where shipment_code = v_code
  for update;

  v_exists := found;

  if coalesce(v_current.revision, 0) <> p_expected_revision then
    raise exception
      'Esta remessa foi revisada em outra sessão. Atualize a tela antes de continuar.';
  end if;

  -- Não cria eventos repetidos quando a situação já é a solicitada.

  if v_exists and v_current.excluded = p_excluded then
    return to_jsonb(v_current);
  end if;

  if not v_exists and not p_excluded then
    raise exception
      'Esta remessa não possui uma retirada administrativa para restaurar.';
  end if;

  v_previous_excluded := case
    when v_exists then v_current.excluded
    else false
  end;

  v_now := clock_timestamp();

  insert into public.freight_dashboard_controls (
    shipment_code,
    excluded,
    reason,
    changed_by,
    changed_at,
    revision
  )
  values (
    v_code,
    p_excluded,
    v_reason,
    v_user_id,
    v_now,
    1
  )
  on conflict (shipment_code)
  do update set
    excluded = excluded.excluded,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    changed_at = excluded.changed_at,
    revision = public.freight_dashboard_controls.revision + 1
  returning * into v_saved;

  insert into public.freight_dashboard_control_events (
    shipment_code,
    previous_excluded,
    new_excluded,
    reason,
    changed_by,
    changed_at,
    revision
  )
  values (
    v_code,
    v_previous_excluded,
    p_excluded,
    v_reason,
    v_user_id,
    v_now,
    v_saved.revision
  );

  return to_jsonb(v_saved);
end;
$$;

revoke all on function public.set_freight_dashboard_control(
  text, boolean, integer, text
) from public, anon, authenticated;

grant execute on function public.set_freight_dashboard_control(
  text, boolean, integer, text
) to authenticated;

commit;