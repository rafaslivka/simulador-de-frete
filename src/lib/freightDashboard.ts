import { supabase } from "./supabase";
import {
  getFreightReportingAccounts,
  getFreightDashboardControls,
} from "./freightDashboardControls";
import type { FreightDashboardControl } from "./freightDashboardControls";
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
  allConfirmed: FreightValidationRecord[];
  controls: FreightDashboardControl[];
  scopeLabel: string;
  accountNames: Record<string, string>;
  duplicateCount: number;
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

async function getConfirmedRecords(
  ownerIds: string[],
): Promise<FreightValidationRecord[]> {
  if (!ownerIds.length) return [];

  const records: FreightValidationRecord[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("freight_shipment_decisions")
      .select(CONFIRMED_COLUMNS)
      .eq("status", "applied")
      .in("created_by", ownerIds)
      .order("id", { ascending: true })
      .range(offset, offset + READ_PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Não foi possível carregar o dashboard: ${error.message}`,
      );
    }

    const batch =
      (data ?? []) as unknown as FreightValidationRecord[];

    if (batch.length === 0) break;

    records.push(...batch);
    offset += batch.length;
  }

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
  }

  return records;
}

/**
 * Consulta as confirmações preservadas no banco.
 * Nenhuma tarifa é recalculada nesta consulta.
 */
export async function getFreightDashboardData(
  scope: "official" | "tests" = "official",
): Promise<FreightDashboardData> {
  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError || !auth.user) {
    throw new Error("Entre novamente para consultar o dashboard.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (
    profileError ||
    !profile ||
    !["admin", "employee"].includes(profile.role)
  ) {
    throw new Error("Não foi possível verificar seu perfil.");
  }

  const admin = profile.role === "admin";
  const accounts = admin ? await getFreightReportingAccounts() : [];

  const accountNames = Object.fromEntries(
    accounts.map((account) => [account.id, account.display_name]),
  );

  let ownerIds = [auth.user.id];
  let scopeLabel = "Resultados da equipe";

  if (admin && scope === "official") {
    ownerIds = accounts
      .filter((account) => account.role === "employee")
      .map((account) => account.id);

    scopeLabel = "Resultados oficiais — equipe";
  } else if (admin) {
    scopeLabel = "Meus testes — fora dos resultados oficiais";
  }

  let latestRun: { id: string; created_at: string } | undefined;

  if (ownerIds.length) {
    const { data, error } = await supabase
      .from("freight_simulation_runs")
      .select("id, created_at")
      .in("created_by", ownerIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(
        `Não foi possível consultar a última análise: ${error.message}`,
      );
    }

    latestRun = data?.[0];
  }

  const raw = await getConfirmedRecords(ownerIds);

  // Uma remessa entra uma única vez.
  // Entre contas consultadas, prevalece a confirmação mais recente.
  const unique = new Map<string, FreightValidationRecord>();

  const ordered = [...raw].sort(
    (a, b) =>
      (b.decided_at ?? "").localeCompare(a.decided_at ?? "") ||
      b.id.localeCompare(a.id),
  );

  for (const record of ordered) {
    if (!unique.has(record.shipment_code)) {
      unique.set(record.shipment_code, record);
    }
  }

  const allConfirmed = [...unique.values()];

  const controls = await getFreightDashboardControls(
    allConfirmed.map((record) => record.shipment_code),
  );

  const excluded = new Set(
    controls
      .filter((control) => control.excluded)
      .map((control) => control.shipment_code),
  );

  const confirmed = allConfirmed.filter(
    (record) => !excluded.has(record.shipment_code),
  );

  const dates = confirmed
    .map((record) => record.shipment.shipment_date)
    .sort();

  return {
    confirmed,
    allConfirmed,
    controls,
    scopeLabel,
    accountNames,
    duplicateCount: raw.length - allConfirmed.length,
    latestRunId: latestRun?.id ?? null,
    latestRunCreatedAt: latestRun?.created_at ?? null,
    availableStartDate: dates[0] ?? null,
    availableEndDate: dates[dates.length - 1] ?? null,
  };
}

/**
 * Os períodos usam a data da remessa.
 * "Última análise" considera as confirmações vinculadas
 * especificamente à análise mais recente.
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
          (record) => record.shipment.run_id === data.latestRunId,
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
 * Soma os valores em centavos para evitar diferenças
 * causadas por operações com casas decimais.
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
      originalCents > 0 ? savingsCents / originalCents : 0,

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