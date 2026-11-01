import { supabase } from "./supabase";
import type { NormalizedShipment } from "../utils/normalizeShipments";
import type { FreightSimulationRun } from "./freightSimulations";

export const HISTORY_PAGE_SIZE = 25;

export type FreightHistoryFilters = {
  page: number;
  startDate?: string;
  endDate?: string;
};

export type FreightHistoryPage = {
  runs: FreightSimulationRun[];
  total: number;
  page: number;
  totalPages: number;
};

const RUN_COLUMNS = [
  "id",
  "created_by",
  "request_id",
  "source_name",
  "shipment_count",
  "item_count",
  "table_versions",
  "created_at",
].join(", ");

/**
 * Converte a data escolhida no navegador para o início
 * daquele dia no horário local do usuário.
 *
 * No limite final, usamos o início do dia seguinte,
 * incluindo assim todo o dia selecionado.
 */
function getDateBoundary(
  value: string,
  nextDay: boolean,
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Informe uma data válida.");
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error("Informe uma data válida.");
  }

  if (nextDay) {
    date.setDate(date.getDate() + 1);
  }

  return date.toISOString();
}

/**
 * Consulta uma página do histórico.
 * O período considera a data em que a análise foi salva.
 *
 * A segurança do Supabase limita a consulta aos registros
 * do usuário conectado.
 */
export async function getFreightHistory(
  filters: FreightHistoryFilters,
): Promise<FreightHistoryPage> {
  if (
    !Number.isInteger(filters.page) ||
    filters.page < 1
  ) {
    throw new Error("A página do histórico é inválida.");
  }

  const startDate = filters.startDate?.trim() || "";
  const endDate = filters.endDate?.trim() || "";

  const startBoundary = startDate
    ? getDateBoundary(startDate, false)
    : null;

  const endBoundary = endDate
    ? getDateBoundary(endDate, true)
    : null;

  if (startDate && endDate && startDate > endDate) {
    throw new Error(
      "A data inicial não pode ser posterior à data final.",
    );
  }

  const firstRecord = (filters.page - 1) * HISTORY_PAGE_SIZE;

  let query = supabase
    .from("freight_simulation_runs")
    .select(RUN_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (startBoundary) {
    query = query.gte("created_at", startBoundary);
  }

  if (endBoundary) {
    query = query.lt("created_at", endBoundary);
  }

  const { data, error, count } = await query.range(
    firstRecord,
    firstRecord + HISTORY_PAGE_SIZE - 1,
  );

  if (error) {
    throw new Error(
      `Não foi possível carregar o histórico: ${error.message}`,
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(total / HISTORY_PAGE_SIZE),
  );

  // Se o total mudou durante a navegação,
  // retorna a última página que ainda existe.
  if (filters.page > totalPages) {
    return getFreightHistory({
      ...filters,
      page: totalPages,
    });
  }

  return {
    runs: (data ?? []) as unknown as FreightSimulationRun[],
    total,
    page: filters.page,
    totalPages,
  };
}

/**
 * Recupera os dados de uma análise específica.
 */
export async function getFreightHistoryRun(
  runId: string,
): Promise<FreightSimulationRun> {
  if (!runId.trim()) {
    throw new Error("Selecione uma análise.");
  }

  const { data, error } = await supabase
    .from("freight_simulation_runs")
    .select(RUN_COLUMNS)
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível carregar a análise: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "A análise não foi encontrada ou você não tem acesso a ela.",
    );
  }

  return data as unknown as FreightSimulationRun;
}

/**
 * Carrega os itens originais somente quando o usuário
 * abre uma remessa. Evita baixar todos os itens
 * de todas as análises ao entrar no Histórico.
 */
export async function getSavedFreightShipmentSource(
  shipmentRecordId: string,
): Promise<NormalizedShipment> {
  if (!shipmentRecordId.trim()) {
    throw new Error("Selecione uma remessa salva.");
  }

  const { data, error } = await supabase
    .from("freight_simulation_shipments")
    .select("shipment_code, source_data")
    .eq("id", shipmentRecordId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível carregar os itens da remessa: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "A remessa não foi encontrada ou você não tem acesso a ela.",
    );
  }

  const source = data.source_data as NormalizedShipment | null;

  if (
    !source ||
    typeof source !== "object" ||
    !Array.isArray(source.items) ||
    source.shipment !== data.shipment_code
  ) {
    throw new Error(
      "Os dados de entrada desta remessa estão incompletos.",
    );
  }

  return source;
}