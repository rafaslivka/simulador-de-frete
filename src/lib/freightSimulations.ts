import { supabase } from "./supabase";
import type { FreightDatasetVersion } from "./freightDatasets";
import type { NormalizedShipment } from "../utils/normalizeShipments";
import type { CalculatedFreightShipment } from "../utils/calculateFreight";

const READ_PAGE_SIZE = 500;

export type FreightDecisionStatus =
  | "pending"
  | "applied"
  | "not_applied";

export const FREIGHT_DECISION_LABELS: Record<
  FreightDecisionStatus,
  string
> = {
  pending: "Pendente",
  applied: "Fiz a mudança",
  not_applied: "Não fiz a mudança",
};

export type FreightTableVersionSnapshot = {
  id: string;
  dataset_key: FreightDatasetVersion["dataset_key"];
  version_no: number;
  source_file_name: string;
};

export type FreightSimulationRun = {
  id: string;
  created_by: string;
  request_id: string;
  source_name: string;
  shipment_count: number;
  item_count: number;
  table_versions: FreightTableVersionSnapshot[];
  created_at: string;
};

export type SavedFreightShipment = {
  id: string;
  run_id: string;
  created_by: string;
  shipment_code: string;
  shipment_date: string;
  calculation: CalculatedFreightShipment;
  current_carrier: string;
  suggested_carrier: string | null;
  current_cost: number | null;
  suggested_cost: number | null;
  potential_savings: number;
  created_at: string;
};

export type FreightShipmentDecision = {
  id: string;
  created_by: string;
  shipment_code: string;
  simulation_shipment_id: string;
  status: FreightDecisionStatus;
  note: string;
  decided_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};

export type FreightDecisionSaveResult = {
  id: string;
  shipment_code: string;
  simulation_shipment_id: string;
  status: FreightDecisionStatus;
  note: string;
  revision: number;
  decided_at: string | null;
  updated_at: string;
};

export type FreightDecisionEvent = {
  id: string;
  decision_id: string;
  created_by: string;
  previous_status: FreightDecisionStatus | null;
  new_status: FreightDecisionStatus;
  previous_result_id: string | null;
  new_result_id: string;
  previous_note: string | null;
  new_note: string;
  changed_at: string;
};

export type SaveFreightSimulationInput = {
  requestId: string;
  sourceName?: string;
  shipments: NormalizedShipment[];
  calculations: CalculatedFreightShipment[];
  activeDatasets: FreightDatasetVersion[];
};

export type SaveFreightDecisionInput = {
  simulationShipmentId: string;
  status: FreightDecisionStatus;
  expectedRevision: number;
  note: string;
};

const SAVED_SHIPMENT_COLUMNS = [
  "id",
  "run_id",
  "created_by",
  "shipment_code",
  "shipment_date",
  "calculation",
  "current_carrier",
  "suggested_carrier",
  "current_cost",
  "suggested_cost",
  "potential_savings",
  "created_at",
].join(", ");

const DECISION_COLUMNS = [
  "id",
  "created_by",
  "shipment_code",
  "simulation_shipment_id",
  "status",
  "note",
  "decided_at",
  "revision",
  "created_at",
  "updated_at",
].join(", ");

function isDecisionStatus(
  value: unknown,
): value is FreightDecisionStatus {
  return (
    value === "pending" ||
    value === "applied" ||
    value === "not_applied"
  );
}

function validateCost(
  value: number | null,
  label: string,
  shipmentCode: string,
): void {
  if (
    value !== null &&
    (!Number.isFinite(value) || value < 0)
  ) {
    throw new Error(
      `A remessa ${shipmentCode} possui ${label} inválido.`,
    );
  }
}

/**
 * Gere uma vez para cada nova análise.
 * Reutilize o mesmo identificador ao tentar salvar novamente
 * uma análise cuja gravação falhou ou ficou sem resposta.
 */
export function createFreightSimulationRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Salva toda a análise em uma única transação.
 * Retorna o identificador da análise criada ou já existente.
 */
export async function saveFreightSimulation(
  input: SaveFreightSimulationInput,
): Promise<string> {
  const {
    requestId,
    shipments,
    calculations,
    activeDatasets,
  } = input;

  if (!requestId.trim()) {
    throw new Error(
      "O identificador da análise não foi informado.",
    );
  }

  if (shipments.length === 0 || calculations.length === 0) {
    throw new Error("Não há remessas calculadas para salvar.");
  }

  const sourceByShipment = new Map(
    shipments.map((shipment) => [
      shipment.shipment,
      shipment,
    ]),
  );

  if (sourceByShipment.size !== shipments.length) {
    throw new Error(
      "Existem remessas duplicadas nos dados de entrada.",
    );
  }

  const calculationCodes = new Set(
    calculations.map((shipment) => shipment.shipment),
  );

  if (calculationCodes.size !== calculations.length) {
    throw new Error(
      "Existem remessas duplicadas nos resultados do cálculo.",
    );
  }

  if (shipments.length !== calculations.length) {
    throw new Error(
      "A quantidade de remessas calculadas não corresponde aos dados de entrada.",
    );
  }

  const payload = calculations.map((calculation) => {
    const source = sourceByShipment.get(calculation.shipment);

    if (!source) {
      throw new Error(
        `Os itens da remessa ${calculation.shipment} não foram encontrados.`,
      );
    }

    if (source.items.length === 0) {
      throw new Error(
        `A remessa ${calculation.shipment} está sem itens.`,
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(calculation.creationDate)) {
      throw new Error(
        `A data da remessa ${calculation.shipment} não está no formato esperado.`,
      );
    }

    validateCost(
      calculation.currentCost,
      "frete atual",
      calculation.shipment,
    );

    validateCost(
      calculation.bestCost,
      "frete sugerido",
      calculation.shipment,
    );

    return {
      shipment_code: calculation.shipment,
      shipment_date: calculation.creationDate,
      source_data: source,
      calculation,
    };
  });

  const tableVersions: FreightTableVersionSnapshot[] =
    activeDatasets
      .filter((dataset) => dataset.is_active)
      .map((dataset) => ({
        id: dataset.id,
        dataset_key: dataset.dataset_key,
        version_no: dataset.version_no,
        source_file_name: dataset.source_file_name,
      }));

  const { data, error } = await supabase.rpc(
    "save_freight_simulation_run",
    {
      p_request_id: requestId,
      p_source_name:
        input.sourceName?.trim() || "Colagem do Excel",
      p_table_versions: tableVersions,
      p_shipments: payload,
    },
  );

  if (error) {
    throw new Error(
      `Não foi possível salvar a análise: ${error.message}`,
    );
  }

  if (typeof data !== "string" || !data) {
    throw new Error(
      "O banco não retornou o identificador da análise. Tente salvar novamente usando a mesma análise.",
    );
  }

  return data;
}

/**
 * Carrega as remessas de uma análise em lotes.
 * Não fica limitado às primeiras 1.000 linhas do Supabase.
 */
export async function getFreightSimulationShipments(
  runId: string,
): Promise<SavedFreightShipment[]> {
  const records: SavedFreightShipment[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("freight_simulation_shipments")
      .select(SAVED_SHIPMENT_COLUMNS)
      .eq("run_id", runId)
      .order("id", { ascending: true })
      .range(offset, offset + READ_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Não foi possível carregar as remessas salvas: ${error.message}`,
      );
    }

    const batch = (data ?? []) as unknown as SavedFreightShipment[];

    if (batch.length === 0) {
      break;
    }

    records.push(...batch);
    offset += batch.length;
  }

  return records;
}

/**
 * Carrega as decisões vigentes do usuário.
 * Uma remessa possui uma única decisão vigente.
 */
export async function getFreightShipmentDecisions(): Promise<
  FreightShipmentDecision[]
> {
  const records: FreightShipmentDecision[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("freight_shipment_decisions")
      .select(DECISION_COLUMNS)
      .order("id", { ascending: true })
      .range(offset, offset + READ_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Não foi possível carregar as decisões: ${error.message}`,
      );
    }

    const batch =
      (data ?? []) as unknown as FreightShipmentDecision[];

    if (batch.length === 0) {
      break;
    }

    records.push(...batch);
    offset += batch.length;
  }

  return records;
}

/**
 * Confirma, rejeita ou devolve uma oportunidade para pendente.
 * A revisão impede sobrescrever uma decisão mais recente.
 */
export async function saveFreightShipmentDecision(
  input: SaveFreightDecisionInput,
): Promise<FreightDecisionSaveResult> {
  if (!input.simulationShipmentId.trim()) {
    throw new Error("Selecione uma remessa salva.");
  }

  if (!isDecisionStatus(input.status)) {
    throw new Error("Selecione uma decisão válida.");
  }

  if (
    !Number.isInteger(input.expectedRevision) ||
    input.expectedRevision < 1
  ) {
    throw new Error(
      "Atualize as decisões antes de tentar salvar.",
    );
  }

  const note = input.note.trim();

  if (note.length > 2000) {
    throw new Error(
      "A observação deve ter no máximo 2.000 caracteres.",
    );
  }

  const { data, error } = await supabase.rpc(
    "set_freight_shipment_decision",
    {
      p_simulation_shipment_id: input.simulationShipmentId,
      p_status: input.status,
      p_expected_revision: input.expectedRevision,
      p_note: note,
    },
  );

  if (error) {
    throw new Error(
      `Não foi possível registrar a decisão: ${error.message}`,
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "O banco não retornou a decisão. Atualize os registros para conferir se ela foi salva.",
    );
  }

  const saved = data as unknown as FreightDecisionSaveResult;

  if (
    typeof saved.id !== "string" ||
    !isDecisionStatus(saved.status) ||
    !Number.isInteger(saved.revision)
  ) {
    throw new Error(
      "A resposta da gravação está incompleta. Atualize os registros antes de continuar.",
    );
  }

  return saved;
}

/**
 * Consulta o histórico de alterações de uma decisão.
 */
export async function getFreightDecisionHistory(
  decisionId: string,
): Promise<FreightDecisionEvent[]> {
  const records: FreightDecisionEvent[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("freight_shipment_decision_events")
      .select(
        [
          "id",
          "decision_id",
          "created_by",
          "previous_status",
          "new_status",
          "previous_result_id",
          "new_result_id",
          "previous_note",
          "new_note",
          "changed_at",
        ].join(", "),
      )
      .eq("decision_id", decisionId)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + READ_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Não foi possível carregar o histórico da decisão: ${error.message}`,
      );
    }

    const batch =
      (data ?? []) as unknown as FreightDecisionEvent[];

    if (batch.length === 0) {
      break;
    }

    records.push(...batch);
    offset += batch.length;
  }

  return records;
}