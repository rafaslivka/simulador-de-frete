begin;

-- =========================================================
-- 1. Análises realizadas
-- =========================================================

create table public.freight_simulation_runs (
  id uuid primary key default gen_random_uuid(),

  created_by uuid not null
    references auth.users(id),

  -- Identificador enviado pelo aplicativo.
  -- Permite repetir uma tentativa de gravação sem duplicar a análise.
  request_id uuid not null,

  source_name text not null default 'Colagem do Excel',

  shipment_count integer not null
    check (shipment_count > 0),

  item_count integer not null
    check (item_count > 0),

  -- Versões das tabelas utilizadas naquela análise.
  table_versions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(table_versions) = 'array'),

  created_at timestamptz not null default now(),

  constraint freight_runs_request_unique
    unique (created_by, request_id),

  constraint freight_runs_id_owner_unique
    unique (id, created_by)
);

create index freight_runs_owner_date_idx
  on public.freight_simulation_runs (
    created_by,
    created_at desc
  );


-- =========================================================
-- 2. Resultado de cada remessa dentro de uma análise
-- =========================================================

create table public.freight_simulation_shipments (
  id uuid primary key default gen_random_uuid(),

  run_id uuid not null,

  created_by uuid not null
    references auth.users(id),

  shipment_code text not null
    check (length(btrim(shipment_code)) > 0),

  shipment_date date not null,

  -- Itens originais, quantidades, materiais e demais entradas.
  source_data jsonb not null
    check (jsonb_typeof(source_data) = 'object'),

  -- Resultado completo, incluindo todas as cotações e motivos.
  calculation jsonb not null
    check (jsonb_typeof(calculation) = 'object'),

  current_carrier text not null,

  suggested_carrier text,

  current_cost numeric(18, 2)
    check (current_cost >= 0),

  suggested_cost numeric(18, 2)
    check (suggested_cost >= 0),

  -- Economia calculada a partir dos valores preservados.
  potential_savings numeric(18, 2)
    generated always as (
      case
        when current_cost is not null
          and suggested_cost is not null
        then greatest(current_cost - suggested_cost, 0)
        else 0
      end
    ) stored,

  created_at timestamptz not null default now(),

  constraint freight_shipments_run_owner_fk
    foreign key (run_id, created_by)
    references public.freight_simulation_runs (
      id,
      created_by
    ),

  constraint freight_shipments_run_code_unique
    unique (run_id, shipment_code),

  -- Esta chave garante que uma decisão aponte para
  -- um resultado da mesma remessa e do mesmo usuário.
  constraint freight_shipments_result_owner_code_unique
    unique (id, created_by, shipment_code)
);

create index freight_shipments_run_idx
  on public.freight_simulation_shipments (run_id);

create index freight_shipments_owner_code_idx
  on public.freight_simulation_shipments (
    created_by,
    shipment_code
  );

create index freight_shipments_owner_date_idx
  on public.freight_simulation_shipments (
    created_by,
    shipment_date
  );


-- =========================================================
-- 3. Decisão vigente por remessa
-- =========================================================

create table public.freight_shipment_decisions (
  id uuid primary key default gen_random_uuid(),

  created_by uuid not null
    references auth.users(id),

  shipment_code text not null
    check (length(btrim(shipment_code)) > 0),

  -- Resultado usado como referência para a decisão.
  simulation_shipment_id uuid not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'applied',
        'not_applied'
      )
    ),

  note text not null default '',

  decided_at timestamptz,

  -- Controle para detectar edições simultâneas.
  revision integer not null default 1
    check (revision > 0),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint freight_decisions_owner_code_unique
    unique (created_by, shipment_code),

  constraint freight_decisions_id_owner_unique
    unique (id, created_by),

  constraint freight_decisions_result_fk
    foreign key (
      simulation_shipment_id,
      created_by,
      shipment_code
    )
    references public.freight_simulation_shipments (
      id,
      created_by,
      shipment_code
    ),

  constraint freight_decisions_status_date_check
    check (
      (
        status = 'pending'
        and decided_at is null
      )
      or
      (
        status in ('applied', 'not_applied')
        and decided_at is not null
      )
    )
);

create index freight_decisions_owner_status_idx
  on public.freight_shipment_decisions (
    created_by,
    status
  );

create index freight_decisions_owner_date_idx
  on public.freight_shipment_decisions (
    created_by,
    decided_at
  );


-- =========================================================
-- 4. Histórico das decisões
-- =========================================================

create table public.freight_shipment_decision_events (
  id uuid primary key default gen_random_uuid(),

  decision_id uuid not null,

  created_by uuid not null
    references auth.users(id),

  previous_status text
    check (
      previous_status in (
        'pending',
        'applied',
        'not_applied'
      )
    ),

  new_status text not null
    check (
      new_status in (
        'pending',
        'applied',
        'not_applied'
      )
    ),

  previous_result_id uuid
    references public.freight_simulation_shipments(id),

  new_result_id uuid not null
    references public.freight_simulation_shipments(id),

  previous_note text,

  new_note text not null default '',

  changed_at timestamptz not null default now(),

  constraint freight_decision_events_owner_fk
    foreign key (decision_id, created_by)
    references public.freight_shipment_decisions (
      id,
      created_by
    )
);

create index freight_decision_events_decision_date_idx
  on public.freight_shipment_decision_events (
    decision_id,
    changed_at desc
  );


-- =========================================================
-- 5. Controle de acesso
-- Cada usuário consulta suas próprias análises e decisões.
-- =========================================================

alter table public.freight_simulation_runs
  enable row level security;

alter table public.freight_simulation_shipments
  enable row level security;

alter table public.freight_shipment_decisions
  enable row level security;

alter table public.freight_shipment_decision_events
  enable row level security;

create policy freight_runs_select_own
  on public.freight_simulation_runs
  for select
  to authenticated
  using (created_by = (select auth.uid()));

create policy freight_shipments_select_own
  on public.freight_simulation_shipments
  for select
  to authenticated
  using (created_by = (select auth.uid()));

create policy freight_decisions_select_own
  on public.freight_shipment_decisions
  for select
  to authenticated
  using (created_by = (select auth.uid()));

create policy freight_decision_events_select_own
  on public.freight_shipment_decision_events
  for select
  to authenticated
  using (created_by = (select auth.uid()));


-- A gravação será feita pelas funções da próxima etapa.
-- O navegador não poderá alterar os registros diretamente.

revoke all on table
  public.freight_simulation_runs,
  public.freight_simulation_shipments,
  public.freight_shipment_decisions,
  public.freight_shipment_decision_events
from public, anon, authenticated;

grant select on table
  public.freight_simulation_runs,
  public.freight_simulation_shipments,
  public.freight_shipment_decisions,
  public.freight_shipment_decision_events
to authenticated;

commit;