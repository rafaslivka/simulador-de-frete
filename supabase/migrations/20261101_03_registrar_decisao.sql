begin;

create or replace function public.set_freight_shipment_decision(
  p_simulation_shipment_id uuid,
  p_status text,
  p_expected_revision integer,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;

  v_result public.freight_simulation_shipments%rowtype;
  v_decision public.freight_shipment_decisions%rowtype;

  v_previous_status text;
  v_previous_result_id uuid;
  v_previous_note text;

  v_note text;
  v_now timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Sua sessão expirou. Entre novamente.';
  end if;

  if p_simulation_shipment_id is null then
    raise exception 'Selecione uma remessa para registrar a decisão.';
  end if;

  if p_status is null
    or p_status not in (
      'pending',
      'applied',
      'not_applied'
    )
  then
    raise exception 'O status informado é inválido.';
  end if;

  if p_expected_revision is null
    or p_expected_revision < 1
  then
    raise exception
      'A versão da decisão é inválida. Atualize a tela e tente novamente.';
  end if;

  v_note := btrim(coalesce(p_note, ''));

  if length(v_note) > 2000 then
    raise exception
      'A observação deve ter no máximo 2.000 caracteres.';
  end if;

  -- Busca somente resultados pertencentes ao usuário conectado.
  select *
  into v_result
  from public.freight_simulation_shipments
  where id = p_simulation_shipment_id
    and created_by = v_user_id;

  if not found then
    raise exception
      'A remessa não foi encontrada ou você não tem acesso a ela.';
  end if;

  -- Este fluxo é destinado às oportunidades de economia.
  if v_result.potential_savings <= 0 then
    raise exception
      'Esta análise da remessa não possui economia positiva para validar.';
  end if;

  if v_result.current_cost is null
    or v_result.suggested_cost is null
    or v_result.current_cost <= 0
    or v_result.suggested_cost <= 0
  then
    raise exception
      'Os valores de frete desta remessa não permitem confirmar uma economia.';
  end if;

  if v_result.suggested_carrier is null
    or v_result.current_carrier = v_result.suggested_carrier
  then
    raise exception
      'Esta remessa não possui uma mudança de transportadora válida.';
  end if;

  if v_result.current_carrier in (
    'MÚLTIPLAS',
    'NÃO IDENTIFICADA'
  ) then
    raise exception
      'Identifique a transportadora atual antes de confirmar a mudança.';
  end if;

  -- Bloqueia a decisão durante a atualização.
  -- Assim duas abas não alteram o mesmo registro ao mesmo tempo.
  select *
  into v_decision
  from public.freight_shipment_decisions
  where created_by = v_user_id
    and shipment_code = v_result.shipment_code
  for update;

  if not found then
    raise exception
      'A decisão desta remessa não foi encontrada. Atualize a tela.';
  end if;

  -- Repetir a mesma solicitação não duplica o histórico.
  if v_decision.status = p_status
    and v_decision.simulation_shipment_id = p_simulation_shipment_id
    and v_decision.note = v_note
  then
    return jsonb_build_object(
      'id', v_decision.id,
      'shipment_code', v_decision.shipment_code,
      'simulation_shipment_id', v_decision.simulation_shipment_id,
      'status', v_decision.status,
      'note', v_decision.note,
      'revision', v_decision.revision,
      'decided_at', v_decision.decided_at,
      'updated_at', v_decision.updated_at
    );
  end if;

  -- Impede que uma tela desatualizada sobrescreva uma decisão mais nova.
  if v_decision.revision <> p_expected_revision then
    raise exception
      'Esta remessa foi atualizada em outra sessão. Atualize a tela antes de salvar.';
  end if;

  v_previous_status := v_decision.status;
  v_previous_result_id := v_decision.simulation_shipment_id;
  v_previous_note := v_decision.note;

  v_now := clock_timestamp();

  update public.freight_shipment_decisions
  set
    simulation_shipment_id = p_simulation_shipment_id,
    status = p_status,
    note = v_note,

    decided_at = case
      when p_status = 'pending' then null

      -- Alterar apenas a observação preserva a data da decisão.
      when v_previous_status = p_status
        and v_previous_result_id = p_simulation_shipment_id
      then decided_at

      else v_now
    end,

    revision = revision + 1,
    updated_at = v_now
  where id = v_decision.id
    and created_by = v_user_id
  returning *
  into v_decision;

  -- Preserva o antes e o depois de cada alteração.
  insert into public.freight_shipment_decision_events (
    decision_id,
    created_by,
    previous_status,
    new_status,
    previous_result_id,
    new_result_id,
    previous_note,
    new_note,
    changed_at
  )
  values (
    v_decision.id,
    v_user_id,
    v_previous_status,
    v_decision.status,
    v_previous_result_id,
    v_decision.simulation_shipment_id,
    v_previous_note,
    v_decision.note,
    v_now
  );

  return jsonb_build_object(
    'id', v_decision.id,
    'shipment_code', v_decision.shipment_code,
    'simulation_shipment_id', v_decision.simulation_shipment_id,
    'status', v_decision.status,
    'note', v_decision.note,
    'revision', v_decision.revision,
    'decided_at', v_decision.decided_at,
    'updated_at', v_decision.updated_at
  );
end;
$$;

revoke all on function public.set_freight_shipment_decision(
  uuid,
  text,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.set_freight_shipment_decision(
  uuid,
  text,
  integer,
  text
) to authenticated;

commit;