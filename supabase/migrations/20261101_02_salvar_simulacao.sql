begin;

create or replace function public.save_freight_simulation_run(
  p_request_id uuid,
  p_source_name text,
  p_table_versions jsonb,
  p_shipments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;

  v_run_id uuid;
  v_result_id uuid;
  v_decision_id uuid;

  v_item jsonb;
  v_calculation jsonb;
  v_source_data jsonb;

  v_shipment_code text;
  v_shipment_date date;

  v_current_carrier text;
  v_suggested_carrier text;

  v_current_cost numeric(18, 2);
  v_suggested_cost numeric(18, 2);

  v_shipment_count integer;
  v_item_count integer := 0;

  v_savings numeric(18, 2);
begin
  -- Identifica o usuário pela sessão do Supabase.
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Sua sessão expirou. Entre novamente.';
  end if;

  if p_request_id is null then
    raise exception 'O identificador da gravação é obrigatório.';
  end if;

  -- Uma repetição da mesma tentativa retorna a análise já salva.
  select id
  into v_run_id
  from public.freight_simulation_runs
  where created_by = v_user_id
    and request_id = p_request_id;

  if found then
    return v_run_id;
  end if;

  if p_shipments is null
    or jsonb_typeof(p_shipments) <> 'array'
  then
    raise exception 'As remessas devem ser enviadas em uma lista.';
  end if;

  v_shipment_count := jsonb_array_length(p_shipments);

  if v_shipment_count = 0 then
    raise exception 'Não há remessas para salvar.';
  end if;

  if p_table_versions is null
    or jsonb_typeof(p_table_versions) <> 'array'
  then
    raise exception 'As versões das tabelas devem ser enviadas em uma lista.';
  end if;

  -- Confere os dados antes de criar a análise.
  for v_item in
    select value
    from jsonb_array_elements(p_shipments)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Foi encontrada uma remessa em formato inválido.';
    end if;

    v_shipment_code := nullif(
      btrim(v_item ->> 'shipment_code'),
      ''
    );

    if v_shipment_code is null then
      raise exception 'Uma das remessas está sem número.';
    end if;

    v_source_data := v_item -> 'source_data';
    v_calculation := v_item -> 'calculation';

    if v_source_data is null
      or jsonb_typeof(v_source_data) <> 'object'
    then
      raise exception
        'Os dados de entrada da remessa % são inválidos.',
        v_shipment_code;
    end if;

    if v_calculation is null
      or jsonb_typeof(v_calculation) <> 'object'
    then
      raise exception
        'O cálculo da remessa % é inválido.',
        v_shipment_code;
    end if;

    if jsonb_typeof(v_source_data -> 'items')
      is distinct from 'array'
    then
      raise exception
        'A remessa % não contém uma lista de itens válida.',
        v_shipment_code;
    end if;

    if jsonb_array_length(v_source_data -> 'items') = 0 then
      raise exception
        'A remessa % não contém itens.',
        v_shipment_code;
    end if;

    if (v_source_data ->> 'shipment')
      is distinct from v_shipment_code
      or (v_calculation ->> 'shipment')
      is distinct from v_shipment_code
    then
      raise exception
        'O número da remessa % não corresponde aos dados enviados.',
        v_shipment_code;
    end if;

    if jsonb_typeof(v_calculation -> 'quotes')
      is distinct from 'array'
    then
      raise exception
        'As cotações da remessa % são inválidas.',
        v_shipment_code;
    end if;

    v_item_count := v_item_count
      + jsonb_array_length(v_source_data -> 'items');
  end loop;

  -- Não permite repetir uma remessa dentro da mesma análise.
  if exists (
    select 1
    from jsonb_array_elements(p_shipments) as shipment(value)
    group by btrim(value ->> 'shipment_code')
    having count(*) > 1
  ) then
    raise exception 'Existem remessas duplicadas nesta análise.';
  end if;

  insert into public.freight_simulation_runs (
    created_by,
    request_id,
    source_name,
    shipment_count,
    item_count,
    table_versions
  )
  values (
    v_user_id,
    p_request_id,
    coalesce(
      nullif(btrim(p_source_name), ''),
      'Colagem do Excel'
    ),
    v_shipment_count,
    v_item_count,
    p_table_versions
  )
  on conflict (created_by, request_id) do nothing
  returning id into v_run_id;

  -- Trata também duas tentativas simultâneas da mesma gravação.
  if v_run_id is null then
    select id
    into v_run_id
    from public.freight_simulation_runs
    where created_by = v_user_id
      and request_id = p_request_id;

    if v_run_id is null then
      raise exception 'Não foi possível localizar a análise salva.';
    end if;

    return v_run_id;
  end if;

  -- A ordem fixa reduz conflitos entre gravações simultâneas.
  for v_item in
    select value
    from jsonb_array_elements(p_shipments)
    order by value ->> 'shipment_code'
  loop
    v_shipment_code := btrim(v_item ->> 'shipment_code');
    v_source_data := v_item -> 'source_data';
    v_calculation := v_item -> 'calculation';

    v_shipment_date := nullif(
      v_item ->> 'shipment_date',
      ''
    )::date;

    if v_shipment_date is null then
      raise exception
        'A remessa % está sem data.',
        v_shipment_code;
    end if;

    v_current_carrier := nullif(
      btrim(v_calculation ->> 'currentCarrier'),
      ''
    );

    v_suggested_carrier := nullif(
      btrim(v_calculation ->> 'bestCarrier'),
      ''
    );

    if v_current_carrier is null then
      raise exception
        'A identificação da transportadora atual da remessa % está ausente.',
        v_shipment_code;
    end if;

    if v_calculation ->> 'currentCost' is not null then
      if jsonb_typeof(v_calculation -> 'currentCost') <> 'number' then
        raise exception
          'O frete atual da remessa % deve ser numérico.',
          v_shipment_code;
      end if;
    end if;

    if v_calculation ->> 'bestCost' is not null then
      if jsonb_typeof(v_calculation -> 'bestCost') <> 'number' then
        raise exception
          'O frete sugerido da remessa % deve ser numérico.',
          v_shipment_code;
      end if;
    end if;

    v_current_cost := (
      v_calculation ->> 'currentCost'
    )::numeric(18, 2);

    v_suggested_cost := (
      v_calculation ->> 'bestCost'
    )::numeric(18, 2);

    if v_current_cost < 0 or v_suggested_cost < 0 then
      raise exception
        'A remessa % contém um frete negativo.',
        v_shipment_code;
    end if;

    if v_suggested_cost is not null
      and v_suggested_carrier is null
    then
      raise exception
        'A remessa % possui frete sugerido sem transportadora.',
        v_shipment_code;
    end if;

    insert into public.freight_simulation_shipments (
      run_id,
      created_by,
      shipment_code,
      shipment_date,
      source_data,
      calculation,
      current_carrier,
      suggested_carrier,
      current_cost,
      suggested_cost
    )
    values (
      v_run_id,
      v_user_id,
      v_shipment_code,
      v_shipment_date,
      v_source_data,
      v_calculation,
      v_current_carrier,
      v_suggested_carrier,
      v_current_cost,
      v_suggested_cost
    )
    returning id, potential_savings
    into v_result_id, v_savings;

    -- Somente oportunidades recebem uma decisão inicial.
    -- Uma decisão existente é preservada, inclusive seu resultado
    -- de referência. Uma nova simulação não muda uma confirmação.
    if v_savings > 0 then
      if v_current_carrier = v_suggested_carrier then
        raise exception
          'A remessa % indica economia sem mudança de transportadora.',
          v_shipment_code;
      end if;

      v_decision_id := null;

      insert into public.freight_shipment_decisions (
        created_by,
        shipment_code,
        simulation_shipment_id,
        status
      )
      values (
        v_user_id,
        v_shipment_code,
        v_result_id,
        'pending'
      )
      on conflict (created_by, shipment_code) do nothing
      returning id into v_decision_id;

      if v_decision_id is not null then
        insert into public.freight_shipment_decision_events (
          decision_id,
          created_by,
          previous_status,
          new_status,
          previous_result_id,
          new_result_id,
          previous_note,
          new_note
        )
        values (
          v_decision_id,
          v_user_id,
          null,
          'pending',
          null,
          v_result_id,
          null,
          ''
        );
      end if;
    end if;
  end loop;

  return v_run_id;
end;
$$;

-- Somente usuários autenticados podem chamar a função.
revoke all on function public.save_freight_simulation_run(
  uuid,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.save_freight_simulation_run(
  uuid,
  text,
  jsonb,
  jsonb
) to authenticated;

commit;