import { supabase } from "./supabase";

export type FreightReportingAccount = {
  id: string;
  display_name: string;
  role: "admin" | "employee";
};

export type FreightDashboardControl = {
  shipment_code: string;
  excluded: boolean;
  reason: string;
  changed_by: string;
  changed_at: string;
  revision: number;
};

export type FreightDashboardControlEvent = {
  id: string;
  shipment_code: string;
  previous_excluded: boolean | null;
  new_excluded: boolean;
  reason: string;
  changed_by: string;
  changed_at: string;
  revision: number;
};

const CONTROL_COLUMNS = [
  "shipment_code",
  "excluded",
  "reason",
  "changed_by",
  "changed_at",
  "revision",
].join(", ");

const EVENT_COLUMNS = [
  "id",
  "shipment_code",
  "previous_excluded",
  "new_excluded",
  "reason",
  "changed_by",
  "changed_at",
  "revision",
].join(", ");

/**
 * Consulta as contas disponíveis para o administrador.
 * A função do banco confere a permissão do usuário conectado.
 */
export async function getFreightReportingAccounts(): Promise<
  FreightReportingAccount[]
> {
  const { data, error } = await supabase.rpc(
    "get_freight_reporting_accounts",
  );

  if (error) {
    throw new Error(
      `Não foi possível consultar as contas: ${error.message}`,
    );
  }

  return (data ?? []) as FreightReportingAccount[];
}

/**
 * Consulta os controles das remessas informadas.
 *
 * Uma remessa sem controle cadastrado não possui retirada
 * administrativa. Isso não significa que sua mudança foi confirmada.
 *
 * O dashboard também precisa conferir o status da decisão.
 */
export async function getFreightDashboardControls(
  shipmentCodes: string[],
): Promise<FreightDashboardControl[]> {
  const codes = Array.from(
    new Set(
      shipmentCodes
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  );

  if (codes.length === 0) {
    return [];
  }

  const controls: FreightDashboardControl[] = [];
  const batchSize = 100;

  for (let offset = 0; offset < codes.length; offset += batchSize) {
    const batch = codes.slice(offset, offset + batchSize);

    const { data, error } = await supabase
      .from("freight_dashboard_controls")
      .select(CONTROL_COLUMNS)
      .in("shipment_code", batch)
      .order("shipment_code", { ascending: true });

    if (error) {
      // Uma falha na consulta não pode ser tratada como
      // ausência de retiradas administrativas.
      throw new Error(
        `Não foi possível conferir as retiradas do dashboard: ${error.message}`,
      );
    }

    controls.push(
      ...((data ?? []) as unknown as FreightDashboardControl[]),
    );
  }

  return controls;
}

/**
 * Retira ou restaura uma remessa nos indicadores.
 *
 * Não altera a confirmação original da equipe.
 * A permissão de administrador é verificada no banco.
 */
export async function setFreightDashboardControl(input: {
  shipmentCode: string;
  excluded: boolean;
  expectedRevision: number;
  reason: string;
}): Promise<FreightDashboardControl> {
  const shipmentCode = input.shipmentCode.trim();
  const reason = input.reason.trim();

  if (!shipmentCode || shipmentCode.length > 100) {
    throw new Error("Informe um número de remessa válido.");
  }

  if (!reason) {
    throw new Error(
      "Informe o motivo da retirada ou da restauração.",
    );
  }

  if (reason.length > 2000) {
    throw new Error(
      "O motivo deve ter no máximo 2.000 caracteres.",
    );
  }

  if (
    !Number.isInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  ) {
    throw new Error(
      "A versão do registro é inválida. Atualize a tela.",
    );
  }

  const { data, error } = await supabase.rpc(
    "set_freight_dashboard_control",
    {
      p_shipment_code: shipmentCode,
      p_excluded: input.excluded,
      p_expected_revision: input.expectedRevision,
      p_reason: reason,
    },
  );

  if (error) {
    throw new Error(
      `Não foi possível salvar a revisão: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "O banco não retornou a confirmação. Atualize a consulta antes de tentar novamente.",
    );
  }

  return data as FreightDashboardControl;
}

/**
 * Consulta o histórico administrativo de uma remessa.
 * O banco permite essa leitura somente ao administrador.
 */
export async function getFreightDashboardControlHistory(
  shipmentCode: string,
  page = 1,
): Promise<{
  events: FreightDashboardControlEvent[];
  total: number;
}> {
  const code = shipmentCode.trim();

  if (!code) {
    throw new Error("Informe a remessa para consultar o histórico.");
  }

  if (!Number.isInteger(page) || page < 1) {
    throw new Error("A página informada é inválida.");
  }

  const pageSize = 25;
  const start = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from("freight_dashboard_control_events")
    .select(EVENT_COLUMNS, { count: "exact" })
    .eq("shipment_code", code)
    .order("revision", { ascending: false })
    .range(start, start + pageSize - 1);

  if (error) {
    throw new Error(
      `Não foi possível consultar o histórico administrativo: ${error.message}`,
    );
  }

  return {
    events:
      (data ?? []) as unknown as FreightDashboardControlEvent[],
    total: count ?? 0,
  };
}