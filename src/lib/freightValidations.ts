import { supabase } from "./supabase";
import type {
  FreightDecisionStatus,
  FreightShipmentDecision,
  SavedFreightShipment,
} from "./freightSimulations";

export const VALIDATIONS_PAGE_SIZE = 25;

export type FreightValidationFilter =
  | FreightDecisionStatus
  | "all";

export type FreightValidationRecord = FreightShipmentDecision & {
  shipment: SavedFreightShipment;
};

export type FreightValidationFilters = {
  page: number;
  status: FreightValidationFilter;
  shipmentSearch?: string;
  startDate?: string;
  endDate?: string;
};

export type FreightValidationPage = {
  records: FreightValidationRecord[];
  total: number;
  page: number;
  totalPages: number;
};

const VALIDATION_COLUMNS = `
  id,
  created_by,
  shipment_code,
  simulation_shipment_id,
  status,
  note,
  decided_at,
  revision,
  created_at,
  updated_at,
  shipment:freight_simulation_shipments!freight_decisions_result_fk!inner(
    id,
    run_id,
    created_by,
    shipment_code,
    shipment_date,
    calculation,
    current_carrier,
    suggested_carrier,
    current_cost,
    suggested_cost,
    potential_savings,
    created_at
  )
`;

function validateDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Informe uma data válida.");
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Informe uma data válida.");
  }
}

function validateStatus(
  value: FreightValidationFilter,
): void {
  if (
    value !== "all" &&
    value !== "pending" &&
    value !== "applied" &&
    value !== "not_applied"
  ) {
    throw new Error("Selecione um filtro de status válido.");
  }
}

/**
 * Trata os caracteres especiais da busca como texto.
 * Assim, "%" e "_" não viram curingas acidentalmente.
 */
function escapeSearch(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Consulta as decisões vigentes e os resultados aos quais
 * elas estão vinculadas.
 *
 * Cada remessa aparece uma única vez para o usuário.
 * Uma análise nova não substitui automaticamente uma decisão.
 *
 * O período considera a data da remessa, e não a data
 * em que a análise foi salva.
 */
export async function getFreightValidations(
  filters: FreightValidationFilters,
): Promise<FreightValidationPage> {
  if (
    !Number.isInteger(filters.page) ||
    filters.page < 1
  ) {
    throw new Error("A página de validações é inválida.");
  }

  validateStatus(filters.status);

  const shipmentSearch = filters.shipmentSearch?.trim() || "";
  const startDate = filters.startDate?.trim() || "";
  const endDate = filters.endDate?.trim() || "";

  if (startDate) {
    validateDate(startDate);
  }

  if (endDate) {
    validateDate(endDate);
  }

  if (startDate && endDate && startDate > endDate) {
    throw new Error(
      "A data inicial não pode ser posterior à data final.",
    );
  }

  let query = supabase
    .from("freight_shipment_decisions")
    .select(VALIDATION_COLUMNS, { count: "exact" });

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (shipmentSearch) {
    query = query.ilike(
      "shipment_code",
      `%${escapeSearch(shipmentSearch)}%`,
    );
  }

  if (startDate) {
    query = query.gte("shipment.shipment_date", startDate);
  }

  if (endDate) {
    query = query.lte("shipment.shipment_date", endDate);
  }

  const firstRecord =
    (filters.page - 1) * VALIDATIONS_PAGE_SIZE;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(
      firstRecord,
      firstRecord + VALIDATIONS_PAGE_SIZE - 1,
    );

  if (error) {
    throw new Error(
      `Não foi possível carregar as validações: ${error.message}`,
    );
  }

  const total = count ?? 0;

  const totalPages = Math.max(
    1,
    Math.ceil(total / VALIDATIONS_PAGE_SIZE),
  );

  // Ao confirmar a última pendência de uma página,
  // a consulta pode precisar voltar à página anterior.
  if (filters.page > totalPages) {
    return getFreightValidations({
      ...filters,
      page: totalPages,
    });
  }

  const records =
    (data ?? []) as unknown as FreightValidationRecord[];

  for (const record of records) {
    if (
      !record.shipment ||
      Array.isArray(record.shipment) ||
      record.shipment.id !== record.simulation_shipment_id ||
      record.shipment.shipment_code !== record.shipment_code
    ) {
      throw new Error(
        "Uma decisão foi retornada sem o resultado correspondente. Atualize a página e tente novamente.",
      );
    }
  }

  return {
    records,
    total,
    page: filters.page,
    totalPages,
  };
}