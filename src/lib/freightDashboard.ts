import { supabase } from "./supabase";
import { getFreightHistory } from "./freightHistory";
import type { FreightValidationRecord } from "./freightValidations";

const READ_PAGE_SIZE = 500;

export type DashboardPeriod =
  | "latest"
  | "today"
  | "date"
  | "range"
  | "week"
  | "month"
  | "all";

export type DashboardFilters = {
  period: DashboardPeriod;
  startDate: string;
  endDate: string;
};

export type FreightDashboardData = {
  confirmed: FreightValidationRecord[];
  latestRunId: string | null;
  latestRunCreatedAt: string | null;
  availableStartDate: string | null;
  availableEndDate: string | null;
};

export type DashboardCarrierTotal = {
  carrier: string;
  savings: number;
  shipments: number;
};

export type DashboardDateTotal = {
  date: string;
  savings: number;
  shipments: number;
};

export type FreightDashboardSummary = {
  confirmedCount: number;
  originalCost: number;
  chosenCost: number;
  savings: number;
  reductionPercent: number;
  byCarrier: DashboardCarrierTotal[];
  byDate: DashboardDateTotal[];
  topSavings: FreightValidationRecord[];
};

const CONFIRMED_COLUMNS = `
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

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validateDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Selecione uma data válida.");
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
    throw new Error("Selecione uma data válida.");
  }
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

async function getConfirmedRecords(): Promise<
  FreightValidationRecord[]
> {
  const records: FreightValidationRecord[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("freight_shipment_decisions")
      .select(CONFIRMED_COLUMNS)
      .eq("status", "applied")
      .order("id", { ascending: true })
      .range(offset, offset + READ_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Não foi possível carregar o dashboard: ${error.message}`,
      );
    }

    const batch =
      (data ?? []) as unknown as FreightValidationRecord[];

    if (batch.length === 0) {
      break;
    }

    records.push(...batch);
    offset += batch.length;
  }

  const seen = new Set<string>();

  for (const record of records) {
    const shipment = record.shipment;

    if (
      !shipment ||
      Array.isArray(shipment) ||
      shipment.id !== record.simulation_shipment_id ||
      shipment.shipment_code !== record.shipment_code ||
      record.status !== "applied"
    ) {
      throw new Error(
        "Uma confirmação foi retornada sem o resultado correspondente.",
      );
    }

    if (
      shipment.current_cost === null ||
      shipment.suggested_cost === null ||
      !Number.isFinite(shipment.current_cost) ||
      !Number.isFinite(shipment.suggested_cost) ||
      shipment.current_cost <= 0 ||
      shipment.suggested_cost <= 0 ||
      shipment.current_cost <= shipment.suggested_cost ||
      !shipment.suggested_carrier ||
      shipment.current_carrier === shipment.suggested_carrier
    ) {
      throw new Error(
        `Os valores confirmados da remessa ${record.shipment_code} precisam ser revisados.`,
      );
    }

    validateDate(shipment.shipment_date);

    if (seen.has(record.shipment_code)) {
      throw new Error(
        "A consulta retornou uma remessa repetida. Atualize o dashboard.",
      );
    }

    seen.add(record.shipment_code);
  }

  return records;
}

/**
 * Busca somente decisões confirmadas e identifica
 * a análise salva mais recentemente.
 *
 * Nenhuma tarifa é recalculada nesta consulta.
 */
export async function getFreightDashboardData(): Promise<
  FreightDashboardData
> {
  const [confirmed, history] = await Promise.all([
    getConfirmedRecords(),
    getFreightHistory({ page: 1 }),
  ]);

  const latestRun = history.runs[0];

  const dates = confirmed
    .map((record) => record.shipment.shipment_date)
    .sort();

  return {
    confirmed,
    latestRunId: latestRun?.id ?? null,
    latestRunCreatedAt: latestRun?.created_at ?? null,
    availableStartDate: dates[0] ?? null,
    availableEndDate: dates[dates.length - 1] ?? null,
  };
}

/**
 * Os períodos usam a data da remessa.
 *
 * "Última análise" considera as decisões confirmadas
 * vinculadas especificamente à análise mais recente.
 */
export function filterDashboardRecords(
  data: FreightDashboardData,
  filters: DashboardFilters,
): FreightValidationRecord[] {
  if (filters.period === "all") {
    return data.confirmed;
  }

  if (filters.period === "latest") {
    return data.latestRunId
      ? data.confirmed.filter(
          (record) =>
            record.shipment.run_id === data.latestRunId,
        )
      : [];
  }

  const today = new Date();
  let startDate: string;
  let endDate: string;

  switch (filters.period) {
    case "today":
      startDate = localDateString(today);
      endDate = startDate;
      break;

    case "date":
      validateDate(filters.startDate);
      startDate = filters.startDate;
      endDate = filters.startDate;
      break;

    case "range":
      validateDate(filters.startDate);
      validateDate(filters.endDate);

      if (filters.startDate > filters.endDate) {
        throw new Error(
          "A data inicial não pode ser posterior à data final.",
        );
      }

      startDate = filters.startDate;
      endDate = filters.endDate;
      break;

    case "week": {
      // Semana de segunda-feira a domingo.
      const monday = new Date(today);
      const daysSinceMonday = (today.getDay() + 6) % 7;
      monday.setDate(today.getDate() - daysSinceMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      startDate = localDateString(monday);
      endDate = localDateString(sunday);
      break;
    }

    case "month": {
      const firstDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      );

      const lastDay = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
      );

      startDate = localDateString(firstDay);
      endDate = localDateString(lastDay);
      break;
    }

    default:
      throw new Error("Selecione um período válido.");
  }

  return data.confirmed.filter((record) => {
    const date = record.shipment.shipment_date;

    return date >= startDate && date <= endDate;
  });
}

/**
 * Calcula os indicadores usando valores em centavos,
 * para evitar diferenças de soma com casas decimais.
 */
export function summarizeFreightDashboard(
  records: FreightValidationRecord[],
): FreightDashboardSummary {
  let originalCents = 0;
  let chosenCents = 0;

  const carriers = new Map<
    string,
    { savingsCents: number; shipments: number }
  >();

  const dates = new Map<
    string,
    { savingsCents: number; shipments: number }
  >();

  const confirmed = records.filter(
    (record) => record.status === "applied",
  );

  for (const record of confirmed) {
    const shipment = record.shipment;

    if (
      shipment.current_cost === null ||
      shipment.suggested_cost === null ||
      !shipment.suggested_carrier
    ) {
      throw new Error(
        `A remessa ${record.shipment_code} possui dados incompletos.`,
      );
    }

    const current = toCents(shipment.current_cost);
    const chosen = toCents(shipment.suggested_cost);
    const savings = current - chosen;

    originalCents += current;
    chosenCents += chosen;

    const carrier = shipment.suggested_carrier;

    const carrierTotal = carriers.get(carrier) ?? {
      savingsCents: 0,
      shipments: 0,
    };

    carrierTotal.savingsCents += savings;
    carrierTotal.shipments += 1;
    carriers.set(carrier, carrierTotal);

    const date = shipment.shipment_date;

    const dateTotal = dates.get(date) ?? {
      savingsCents: 0,
      shipments: 0,
    };

    dateTotal.savingsCents += savings;
    dateTotal.shipments += 1;
    dates.set(date, dateTotal);
  }

  const savingsCents = originalCents - chosenCents;

  return {
    confirmedCount: confirmed.length,
    originalCost: originalCents / 100,
    chosenCost: chosenCents / 100,
    savings: savingsCents / 100,

    reductionPercent:
      originalCents > 0
        ? savingsCents / originalCents
        : 0,

    byCarrier: Array.from(carriers.entries())
      .map(([carrier, value]) => ({
        carrier,
        savings: value.savingsCents / 100,
        shipments: value.shipments,
      }))
      .sort(
        (a, b) =>
          b.savings - a.savings ||
          a.carrier.localeCompare(b.carrier),
      ),

    byDate: Array.from(dates.entries())
      .map(([date, value]) => ({
        date,
        savings: value.savingsCents / 100,
        shipments: value.shipments,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),

    topSavings: [...confirmed]
      .sort(
        (a, b) =>
          b.shipment.potential_savings -
            a.shipment.potential_savings ||
          a.shipment_code.localeCompare(b.shipment_code),
      )
      .slice(0, 10),
  };
}