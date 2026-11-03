import type { FreightDatasetVersion } from "../lib/freightDatasets";
import type { NormalizedShipment } from "./normalizeShipments";
import type {
  FreightSheetKey,
  SpreadsheetCell,
} from "./readFreightWorkbook";

const AUXILIARY_SHEET_MARKER = "__FREIGHT_WORKBOOK_SHEET__";
const CUBAGE_FACTOR_DEFAULT = 300;
const RTE_ISSUANCE_FEE = 26.5;
const ANEG_GRIS_DEFAULT = 0.0015;
const ANEG_ADV_DEFAULT = 0.0003;

export const FREIGHT_CARRIERS = [
  "Rodonaves",
  "Venkon",
  "Favorita",
  "Rodobrás",
  "Brasil Web",
  "Modular",
  "ANEG",
] as const;

export type FreightCarrier = (typeof FREIGHT_CARRIERS)[number];

export type ShipmentType =
  | "PRODUTO"
  | "PECAS"
  | "MISTO"
  | "NÃO IDENTIFICADO";

export type FreightCarrierQuote = {
  carrier: FreightCarrier;
  cost: number | null;
  reason: string;
};

export type CalculatedFreightShipment = {
  shipment: string;
  creationDate: string;
  uf: string;
  city: string;
  shipmentType: ShipmentType;
  quantity: number;
  invoiceValue: number;
  realWeightKg: number;
  cubicVolumeM3: number;
  missingWeightItems: number;
  missingCubageItems: number;
  currentCarrier:
    | FreightCarrier
    | "MÚLTIPLAS"
    | "NÃO IDENTIFICADA";
  currentCost: number | null;
  bestCarrier: FreightCarrier | null;
  bestCost: number | null;
  potentialSavings: number;
  potentialSavingsPercent: number;
  status: string;
  quotes: FreightCarrierQuote[];
};

export type FreightCalculationResult =
  | {
      success: true;
      shipments: CalculatedFreightShipment[];
      warnings: string[];
    }
  | {
      success: false;
      errors: string[];
    };

type DatasetMap = Map<FreightSheetKey, SpreadsheetCell[][]>;

type MaterialInfo = {
  weightKg: number | null;
  cubicVolumeM3: number | null;
};

type RouteTable = {
  rows: SpreadsheetCell[][];
  headerIndex: number;
  ufColumn: number;
  destinationColumn: number;
  dataStartIndex: number;
};

type RouteMatch = {
  rowIndex: number;
  row: SpreadsheetCell[];
};

type WeightBand = {
  columnIndex: number;
  isPerKgRate: boolean;
};

type QuoteResult = {
  cost: number | null;
  reason: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeMaterial(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeMaterialWithoutLeadingZeros(value: unknown): string {
  return normalizeMaterial(value).replace(/^0+(?=\d)/, "");
}

function cellText(
  row: SpreadsheetCell[],
  columnIndex: number,
): string {
  return String(row[columnIndex] ?? "").trim();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  let normalized = value
    .trim()
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");

  if (!normalized) {
    return null;
  }

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value: unknown, fallback: number): number {
  const containsPercent =
    typeof value === "string" && value.includes("%");

  const valueToParse =
    typeof value === "string"
      ? value.trim().replace(/%\s*$/, "").trim()
      : value;

  const parsed = parseNumber(valueToParse);

  if (parsed === null) {
    return fallback;
  }

  const percent =
    containsPercent || parsed > 1
      ? parsed / 100
      : parsed;

  return percent >= 0 && percent <= 1
    ? percent
    : fallback;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const sign = value < 0 ? -1 : 1;

  return (
    sign *
    Math.round((Math.abs(value) + Number.EPSILON) * 100) /
    100
  );
}

function ceilHundreds(weightKg: number): number {
  return Math.max(1, Math.ceil(weightKg / 100));
}

function getMainRows(
  rows: SpreadsheetCell[][],
): SpreadsheetCell[][] {
  const markerIndex = rows.findIndex(
    (row) => row[0] === AUXILIARY_SHEET_MARKER,
  );

  return markerIndex >= 0 ? rows.slice(0, markerIndex) : rows;
}

function buildDatasetMap(
  datasets: FreightDatasetVersion[],
): DatasetMap {
  const map: DatasetMap = new Map();

  for (const dataset of datasets) {
    if (dataset.is_active) {
      map.set(dataset.dataset_key, getMainRows(dataset.data));
    }
  }

  return map;
}

function findHeaderIndex(
  rows: SpreadsheetCell[][],
  requiredHeaders: string[],
): number {
  return rows.findIndex((row) => {
    const cells = row.map(normalizeText);

    return requiredHeaders.every((header) =>
      cells.includes(header),
    );
  });
}

function findColumn(
  row: SpreadsheetCell[],
  searchTerms: string[],
): number {
  return row.findIndex((cell) => {
    const normalized = normalizeText(cell);

    return searchTerms.some((term) =>
      normalized.includes(term),
    );
  });
}

function findRouteTable(
  rows: SpreadsheetCell[][],
): RouteTable | null {
  const headerIndex = findHeaderIndex(rows, ["UF", "DESTINO"]);

  if (headerIndex < 0) {
    return null;
  }

  const headerRow = rows[headerIndex];
  const ufColumn = findColumn(headerRow, ["UF"]);
  const destinationColumn = findColumn(headerRow, ["DESTINO"]);

  if (ufColumn < 0 || destinationColumn < 0) {
    return null;
  }

  return {
    rows,
    headerIndex,
    ufColumn,
    destinationColumn,
    dataStartIndex: headerIndex + 2,
  };
}

function findRoute(
  table: RouteTable,
  uf: string,
  destination: string,
): RouteMatch | null {
  let currentUf = "";
  const targetUf = uf.trim().toUpperCase();
  const targetDestination = normalizeText(destination);

  for (
    let rowIndex = table.dataStartIndex;
    rowIndex < table.rows.length;
    rowIndex += 1
  ) {
    const row = table.rows[rowIndex] ?? [];
    const currentText = normalizeText(row.join(" "));

    if (currentText.includes("GENERALIDADES")) {
      break;
    }

    const rowUf = cellText(row, table.ufColumn).toUpperCase();

    if (rowUf && rowUf.length <= 3) {
      currentUf = rowUf;
    }

    const rowDestination = normalizeText(
      row[table.destinationColumn],
    );

    if (
      currentUf === targetUf &&
      rowDestination === targetDestination
    ) {
      return { rowIndex, row };
    }
  }

  return null;
}

function findWeightBand(
  bandRow: SpreadsheetCell[],
  chargedWeight: number,
): WeightBand | null {
  for (
    let columnIndex = 0;
    columnIndex < bandRow.length;
    columnIndex += 1
  ) {
    const label = String(bandRow[columnIndex] ?? "");
    const normalizedLabel = normalizeText(label);

    if (!normalizedLabel.includes("KG")) {
      continue;
    }

    const numbers = label.match(/\d+(?:[.,]\d+)?/g) ?? [];

    const values = numbers
      .map((number) => parseNumber(number))
      .filter((number): number is number => number !== null);

    if (values.length === 0) {
      continue;
    }

    if (normalizedLabel.includes("ACIMA")) {
      const limit = values[0];

      if (limit !== undefined && chargedWeight > limit) {
        return {
          columnIndex,
          isPerKgRate: true,
        };
      }

      continue;
    }

    if (normalizedLabel.includes("ATE")) {
      const upperLimit = values[values.length - 1];

      if (
        upperLimit !== undefined &&
        chargedWeight <= upperLimit
      ) {
        return {
          columnIndex,
          isPerKgRate: false,
        };
      }

      continue;
    }

    if (values.length >= 2) {
      const lowerLimit = values[0];
      const upperLimit = values[1];

      if (
        lowerLimit !== undefined &&
        upperLimit !== undefined &&
        chargedWeight >= lowerLimit &&
        chargedWeight <= upperLimit
      ) {
        return {
          columnIndex,
          isPerKgRate: false,
        };
      }
    } else {
      const upperLimit = values[0];

      if (
        upperLimit !== undefined &&
        chargedWeight <= upperLimit
      ) {
        return {
          columnIndex,
          isPerKgRate: false,
        };
      }
    }
  }

  return null;
}

// Usado apenas para explicar por que não existe faixa aplicável.
// Não altera o peso nem aplica automaticamente a primeira tarifa.
function findLowestWeightBandLimit(
  bandRow: SpreadsheetCell[],
): number | null {
  let lowestLimit: number | null = null;

  for (const cell of bandRow) {
    const label = String(cell ?? "");
    const normalizedLabel = normalizeText(label);

    if (!normalizedLabel.includes("KG")) {
      continue;
    }

    if (normalizedLabel.includes("ACIMA")) {
      continue;
    }

    const numbers = label.match(/\d+(?:[.,]\d+)?/g) ?? [];

    const values = numbers
      .map((number) => parseNumber(number))
      .filter((number): number is number => number !== null);

    if (values.length === 0) {
      continue;
    }

    const lowerLimit =
      normalizedLabel.includes("ATE") || values.length === 1
        ? 0
        : values[0];

    if (
      lowerLimit !== undefined &&
      (lowestLimit === null || lowerLimit < lowestLimit)
    ) {
      lowestLimit = lowerLimit;
    }
  }

  return lowestLimit;
}

function getParameterFromGeneralities(
  rows: SpreadsheetCell[][],
  label: string,
  fallback: number,
  isPercent: boolean,
): number {
  const target = normalizeText(label);

  for (const row of rows) {
    const labelCell = normalizeText(row[1]);

    if (!labelCell.includes(target)) {
      continue;
    }

    const value = row[4];

    if (isPercent) {
      return parsePercent(value, fallback);
    }

    return parseNumber(value) ?? fallback;
  }

  return fallback;
}

function findFeeColumn(
  bandRow: SpreadsheetCell[],
  terms: string[],
): number {
  return findColumn(bandRow, terms.map(normalizeText));
}

function readFeeValue(
  row: SpreadsheetCell[],
  bandRow: SpreadsheetCell[],
  terms: string[],
): {
  found: boolean;
  included: boolean;
  value: number;
} {
  const columnIndex = findFeeColumn(bandRow, terms);

  if (columnIndex < 0) {
    return {
      found: false,
      included: false,
      value: 0,
    };
  }

  const rawValue = row[columnIndex];
  const normalized = normalizeText(rawValue);

  if (normalized.includes("INCLUSO")) {
    return {
      found: true,
      included: true,
      value: 0,
    };
  }

  return {
    found: true,
    included: false,
    value: parseNumber(rawValue) ?? 0,
  };
}

function getDestinationByOfficialCapital(
  city: string,
  uf: string,
): string {
  const capitals: Record<string, string> = {
    AC: "RIO BRANCO",
    AL: "MACEIO",
    AP: "MACAPA",
    AM: "MANAUS",
    BA: "SALVADOR",
    CE: "FORTALEZA",
    DF: "BRASILIA",
    ES: "VITORIA",
    GO: "GOIANIA",
    MA: "SAO LUIS",
    MT: "CUIABA",
    MS: "CAMPO GRANDE",
    MG: "BELO HORIZONTE",
    PA: "BELEM",
    PB: "JOAO PESSOA",
    PR: "CURITIBA",
    PE: "RECIFE",
    PI: "TERESINA",
    RJ: "RIO DE JANEIRO",
    RN: "NATAL",
    RS: "PORTO ALEGRE",
    RO: "PORTO VELHO",
    RR: "BOA VISTA",
    SC: "FLORIANOPOLIS",
    SP: "SAO PAULO",
    SE: "ARACAJU",
    TO: "PALMAS",
  };

  return normalizeText(city) === normalizeText(capitals[uf] ?? "")
    ? "Capital"
    : "Interior";
}

function findCityDestination(
  rows: SpreadsheetCell[][],
  city: string,
  uf: string,
  cityColumnTerms: string[],
  ufColumnTerms: string[],
  destinationColumnTerms: string[],
): string | null {
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeText);

    return (
      cityColumnTerms.some((term) =>
        normalized.some((cell) =>
          cell.includes(normalizeText(term)),
        ),
      ) &&
      ufColumnTerms.some((term) =>
        normalized.some((cell) =>
          cell.includes(normalizeText(term)),
        ),
      )
    );
  });

  if (headerIndex < 0) {
    return null;
  }

  const header = rows[headerIndex];

  const cityColumn = findColumn(
    header,
    cityColumnTerms.map(normalizeText),
  );

  const ufColumn = findColumn(
    header,
    ufColumnTerms.map(normalizeText),
  );

  const destinationColumn = findColumn(
    header,
    destinationColumnTerms.map(normalizeText),
  );

  if (
    cityColumn < 0 ||
    ufColumn < 0 ||
    destinationColumn < 0
  ) {
    return null;
  }

  const targetCity = normalizeText(city);
  const targetUf = uf.trim().toUpperCase();

  for (
    let index = headerIndex + 1;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index] ?? [];

    if (
      normalizeText(row[cityColumn]) === targetCity &&
      String(row[ufColumn] ?? "").trim().toUpperCase() === targetUf
    ) {
      const value = String(row[destinationColumn] ?? "");

      if (normalizeText(value).includes("CAPITAL")) {
        return "Capital";
      }

      if (normalizeText(value).includes("INTERIOR")) {
        return "Interior";
      }
    }
  }

  return null;
}

function getVenkonDestination(
  datasets: DatasetMap,
  city: string,
  uf: string,
): string {
  const rows = datasets.get("TABELA_VENKON_ABR") ?? [];

  const destination = findCityDestination(
    rows,
    city,
    uf,
    ["CIDADE"],
    ["UF"],
    ["LOCALIDADE SIMPLES"],
  );

  return destination ?? getDestinationByOfficialCapital(city, uf);
}

function getRteDestination(
  datasets: DatasetMap,
  city: string,
  uf: string,
): string | null {
  const rows = datasets.get("TABELA_RTE_PRAZOS") ?? [];

  return findCityDestination(
    rows,
    city,
    uf,
    ["MUNICIPIO DESTINO"],
    ["UF DESTINO"],
    ["POLO"],
  );
}

function getAnegDestination(
  datasets: DatasetMap,
  city: string,
  uf: string,
): string {
  const rows = datasets.get("TABELA_ANEG_CIDADES") ?? [];

  const destination = findCityDestination(
    rows,
    city,
    uf,
    ["DESCRICAO MUNICIPIO"],
    ["UF"],
    ["DESCRICAO REGIAO"],
  );

  return destination ?? getDestinationByOfficialCapital(city, uf);
}

function buildMaterialMap(
  rows: SpreadsheetCell[][],
): Map<string, MaterialInfo> {
  const map = new Map<string, MaterialInfo>();

  const headerIndex = rows.findIndex((row) => {
    const cells = row.map(normalizeText);

    return (
      cells.includes("MATERIAL") &&
      cells.includes("PESOUNITARIOKG") &&
      cells.some((cell) => cell.startsWith("CUBAGEMUNITARIA"))
    );
  });

  if (headerIndex < 0) {
    return map;
  }

  const header = rows[headerIndex];
  const materialColumn = findColumn(header, ["MATERIAL"]);
  const weightColumn = findColumn(header, ["PESOUNITARIOKG"]);
  const cubageColumn = findColumn(header, ["CUBAGEMUNITARIA"]);

  if (
    materialColumn < 0 ||
    weightColumn < 0 ||
    cubageColumn < 0
  ) {
    return map;
  }

  for (
    let index = headerIndex + 1;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index] ?? [];
    const material = normalizeMaterial(row[materialColumn]);

    if (!material) {
      continue;
    }

    map.set(material, {
      weightKg: parseNumber(row[weightColumn]),
      cubicVolumeM3: parseNumber(row[cubageColumn]),
    });
  }

  return map;
}

function getShipmentType(
  shipment: NormalizedShipment,
): ShipmentType {
  const types = new Set<string>();

  for (const item of shipment.items) {
    const deposit = String(
      item.original.values["Depósito"] ?? "",
    )
      .trim()
      .toUpperCase();

    if (deposit === "B114" || deposit === "B413") {
      types.add("PRODUTO");
    } else if (deposit === "B130" || deposit === "B412") {
      types.add("PECAS");
    } else {
      types.add("NÃO IDENTIFICADO");
    }
  }

  if (types.size !== 1) {
    return "MISTO";
  }

  const [onlyType] = Array.from(types);

  if (onlyType === "PRODUTO" || onlyType === "PECAS") {
    return onlyType;
  }

  return "NÃO IDENTIFICADO";
}

function getCommercialCategory(
  shipmentType: ShipmentType,
  description: string,
): string {
  if (shipmentType === "PECAS") {
    return "PECAS";
  }

  const text = normalizeText(description);

  if (text.includes("CHILLER")) return "CHILLER";
  if (text.includes("FANCOIL")) return "FANCOIL";
  if (text.includes("PACKAGE")) return "PACKAGE";
  if (text.includes("PORTATIL")) return "PORTATEIS";

  if (
    text.includes("REFRIGERADOR") ||
    text.includes("LAVAESECA")
  ) {
    return "REFRIGERADORES";
  }

  if (text.includes("FRIGOBAR") || text.includes("SMALLRR")) {
    return "SMALL RR";
  }

  if (
    text.includes("AQUECEDOR") ||
    text.includes("HEATWATER")
  ) {
    return "HW";
  }

  return "GERAL";
}

function getCarrierFromNameOrCode(
  name: string,
  code: string,
): FreightCarrier | "NÃO IDENTIFICADA" {
  const normalizedCode = code.trim();

  const codeMap: Record<string, FreightCarrier> = {
    "81307": "Rodonaves",
    "81607": "Venkon",
    "81604": "Favorita",
    "81605": "Rodobrás",
    "81602": "Brasil Web",
    "80947": "Modular",
    "80404": "ANEG",
  };

  if (codeMap[normalizedCode]) {
    return codeMap[normalizedCode];
  }

  const normalizedName = normalizeText(name);

  if (
    normalizedName.includes("RODONAVES") ||
    normalizedName.includes("RTE")
  ) {
    return "Rodonaves";
  }

  if (
    normalizedName.includes("VENKON") ||
    normalizedName.includes("TMA")
  ) {
    return "Venkon";
  }

  if (normalizedName.includes("FAVORITA")) return "Favorita";
  if (normalizedName.includes("RODOBRAS")) return "Rodobrás";
  if (normalizedName.includes("BRASILWEB")) return "Brasil Web";
  if (normalizedName.includes("MODULAR")) return "Modular";
  if (normalizedName.includes("ANEG")) return "ANEG";

  return "NÃO IDENTIFICADA";
}

function isHeavyPartsShipment(
  realWeightKg: number,
  cubicVolumeM3: number,
): boolean {
  return (
    realWeightKg > 30 ||
    cubicVolumeM3 * CUBAGE_FACTOR_DEFAULT > 30
  );
}

function staticEligibilityFallback(
  carrier: FreightCarrier,
  shipmentType: ShipmentType,
  uf: string,
  destination: string,
  realWeightKg: number,
  cubicVolumeM3: number,
): boolean {
  if (shipmentType === "PRODUTO") {
    switch (carrier) {
      case "Venkon":
        return [
          "AL", "BA", "CE", "MA", "PB", "PE",
          "PI", "RJ", "RN", "SE", "SP",
        ].includes(uf);

      case "Rodonaves":
        return (
          uf === "MG" ||
          (uf === "SP" && destination === "Interior")
        );

      case "Brasil Web":
        return (
          ["ES", "MG"].includes(uf) ||
          (uf === "SP" && destination === "Interior")
        );

      case "Rodobrás":
        return ["PR", "RS", "SC"].includes(uf);

      case "ANEG":
        return ["PR", "RJ", "RS", "SP"].includes(uf);

      case "Favorita":
        return [
          "AC", "AM", "AP", "DF", "GO", "MS",
          "MT", "PA", "RO", "RR", "TO",
        ].includes(uf);

      case "Modular":
        return false;
    }
  }

  if (shipmentType === "PECAS") {
    const heavy = isHeavyPartsShipment(
      realWeightKg,
      cubicVolumeM3,
    );

    if (!heavy) {
      return false;
    }

    if (carrier === "Rodonaves") {
      return [
        "AC", "AM", "AP", "DF", "ES", "GO",
        "MG", "MS", "MT", "PA", "PR", "RJ",
        "RO", "RR", "RS", "SC", "SP", "TO",
      ].includes(uf);
    }

    if (carrier === "Modular") {
      return [
        "AL", "BA", "CE", "MA", "PB",
        "PE", "PI", "RN", "SE",
      ].includes(uf);
    }
  }

  return false;
}

function isEligibleByMatrix(
  datasets: DatasetMap,
  carrier: FreightCarrier,
  shipmentType: ShipmentType,
  uf: string,
  destination: string,
  realWeightKg: number,
  cubicVolumeM3: number,
): boolean {
  if (
    shipmentType !== "PRODUTO" &&
    shipmentType !== "PECAS"
  ) {
    return false;
  }

  if (
    shipmentType === "PECAS" &&
    (carrier === "Rodonaves" || carrier === "Modular") &&
    !isHeavyPartsShipment(realWeightKg, cubicVolumeM3)
  ) {
    return false;
  }

  if (
    shipmentType === "PECAS" &&
    !["Rodonaves", "Modular"].includes(carrier)
  ) {
    return false;
  }

  const matrixKey: FreightSheetKey =
    shipmentType === "PRODUTO"
      ? "MATRIZ_UF_PRODUTO_ACABADO"
      : "MATRIZ_UF_PECAS";

  const rows = datasets.get(matrixKey);

  if (!rows?.length) {
    return staticEligibilityFallback(
      carrier,
      shipmentType,
      uf,
      destination,
      realWeightKg,
      cubicVolumeM3,
    );
  }

  const headerIndex = rows.findIndex((row) => {
    const cells = row.map(normalizeText);

    return (
      cells.includes("UF") &&
      cells.includes("ZONADETARIFA")
    );
  });

  if (headerIndex < 0) {
    return staticEligibilityFallback(
      carrier,
      shipmentType,
      uf,
      destination,
      realWeightKg,
      cubicVolumeM3,
    );
  }

  const header = rows[headerIndex];
  const ufColumn = findColumn(header, ["UF"]);
  const destinationColumn = findColumn(header, ["ZONADETARIFA"]);
  const carrierColumn = findColumn(header, [
    normalizeText(carrier),
  ]);

  if (
    ufColumn < 0 ||
    destinationColumn < 0 ||
    carrierColumn < 0
  ) {
    return staticEligibilityFallback(
      carrier,
      shipmentType,
      uf,
      destination,
      realWeightKg,
      cubicVolumeM3,
    );
  }

  const targetUf = uf.trim().toUpperCase();
  const targetDestination = normalizeText(destination);

  for (
    let index = headerIndex + 1;
    index < rows.length;
    index += 1
  ) {
    const row = rows[index] ?? [];

    if (
      String(row[ufColumn] ?? "").trim().toUpperCase() ===
        targetUf &&
      normalizeText(row[destinationColumn]) ===
        targetDestination
    ) {
      return normalizeText(row[carrierColumn]) === "X";
    }
  }

  return false;
}

function findPercentColumn(
  subHeader: SpreadsheetCell[],
  shipmentType: ShipmentType,
): number {
  if (shipmentType === "PECAS") {
    return findColumn(subHeader, ["PECAS"]);
  }

  return findColumn(subHeader, ["FRACIONADOGERAL"]);
}

function quoteRte(
  datasets: DatasetMap,
  uf: string,
  destination: string,
  shipmentType: ShipmentType,
  realWeightKg: number,
  invoiceValue: number,
): QuoteResult {
  if (realWeightKg > 5000) {
    return {
      cost: null,
      reason: "Fracionado Rodonaves limitado a 5.000 kg.",
    };
  }

  const rows = datasets.get("TABELA_RODONAVES") ?? [];
  const table = findRouteTable(rows);

  if (!table) {
    return {
      cost: null,
      reason: "Tabela Rodonaves não carregada ou sem cabeçalho.",
    };
  }

  const route = findRoute(table, uf, destination);

  if (!route) {
    return {
      cost: null,
      reason: "Sem tarifa Rodonaves para a rota.",
    };
  }

  const subHeader = rows[table.headerIndex + 1] ?? [];

  const percentColumn = findPercentColumn(
    subHeader,
    shipmentType,
  );

  // "Frete mínimo" normalizado resulta em FRETEMINIMO.
  const minimumColumn = findColumn(
    rows[table.headerIndex] ?? [],
    ["FRETEMINIMO"],
  );

  if (percentColumn < 0) {
    return {
      cost: null,
      reason:
        "Coluna percentual Rodonaves não localizada para o tipo da remessa.",
    };
  }

  if (minimumColumn < 0) {
    return {
      cost: null,
      reason: "Coluna de frete mínimo Rodonaves não localizada.",
    };
  }

  const percent = parsePercent(route.row[percentColumn], 0);
  const minimum = parseNumber(route.row[minimumColumn]) ?? 0;

  if (percent <= 0 && minimum <= 0) {
    return {
      cost: null,
      reason: "Tarifa Rodonaves sem valor aplicável.",
    };
  }

  const base = Math.max(invoiceValue * percent, minimum);

  const gris = getParameterFromGeneralities(
    rows,
    "GRIS",
    0.0026,
    true,
  );

  const adValorem = getParameterFromGeneralities(
    rows,
    "SEGURO (ADV)",
    0.0015,
    true,
  );

  const toll = getParameterFromGeneralities(
    rows,
    "PEDAGIO FRACIONADO",
    9.03,
    false,
  );

  const tollCost = ceilHundreds(realWeightKg) * toll;

  const cost =
    base +
    invoiceValue * gris +
    invoiceValue * adValorem +
    tollCost +
    RTE_ISSUANCE_FEE;

  return {
    cost: roundMoney(cost),
    reason:
      "Base percentual ou frete mínimo, GRIS, ADV, pedágio por peso real e emissão de R$ 26,50.",
  };
}

function quoteWeightTable(
  datasets: DatasetMap,
  datasetKey: FreightSheetKey,
  carrier: "Favorita" | "Rodobrás" | "Brasil Web",
  uf: string,
  destination: string,
  realWeightKg: number,
  cubicVolumeM3: number,
  invoiceValue: number,
): QuoteResult {
  const rows = datasets.get(datasetKey) ?? [];
  const table = findRouteTable(rows);

  if (!table) {
    return {
      cost: null,
      reason: `Tabela ${carrier} não carregada ou sem cabeçalho.`,
    };
  }

  const route = findRoute(table, uf, destination);

  if (!route) {
    return {
      cost: null,
      reason: `Sem tarifa ${carrier} para a rota.`,
    };
  }

  const bandRow = rows[table.headerIndex + 1] ?? [];
  const factorDefault = carrier === "Brasil Web" ? 250 : 300;

  let factor = getParameterFromGeneralities(
    rows,
    "FATOR DE CUBAGEM",
    factorDefault,
    false,
  );

  if (factor < 10) {
    factor = CUBAGE_FACTOR_DEFAULT;
  }

  const chargedWeight = Math.max(
    realWeightKg,
    cubicVolumeM3 * factor,
  );

  const band = findWeightBand(bandRow, chargedWeight);

  if (!band) {
    if (carrier === "Brasil Web") {
      const lowestLimit = findLowestWeightBandLimit(bandRow);

      const formattedWeight = chargedWeight.toLocaleString(
        "pt-BR",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      );

      if (
        lowestLimit !== null &&
        chargedWeight < lowestLimit
      ) {
        const formattedLimit =
          lowestLimit.toLocaleString("pt-BR");

        return {
          cost: null,
          reason:
            `Peso tarifário de ${formattedWeight} kg abaixo da ` +
            `primeira faixa da tabela (${formattedLimit} kg). ` +
            "Tarifa não definida no arquivo para esse peso.",
        };
      }

      return {
        cost: null,
        reason:
          `A tabela Brasil Web não contém uma faixa que inclua ` +
          `${formattedWeight} kg tarifários. Confira os limites ` +
          "das faixas no arquivo.",
      };
    }

    return {
      cost: null,
      reason:
        `Sem faixa ${carrier} para ` +
        `${chargedWeight.toFixed(2)} kg tarifários.`,
    };
  }

  let base = parseNumber(route.row[band.columnIndex]) ?? 0;

  if (base <= 0) {
    return {
      cost: null,
      reason: `Faixa ${carrier} sem tarifa para a rota.`,
    };
  }

  if (band.isPerKgRate) {
    base *= chargedWeight;
  }

  const adValoremFee = readFeeValue(
    route.row,
    bandRow,
    ["ADVALOREM", "AD VALOREM"],
  );

  const grisFee = readFeeValue(
    route.row,
    bandRow,
    ["GRIS"],
  );

  const tollFee = readFeeValue(
    route.row,
    bandRow,
    ["PEDAGIO"],
  );

  let adValorem = adValoremFee.value;
  let gris = grisFee.value;

  if (adValorem <= 0) {
    const fallback =
      carrier === "Favorita"
        ? 0.004
        : carrier === "Rodobrás"
          ? 0.002
          : 0.0025;

    adValorem = getParameterFromGeneralities(
      rows,
      "ADV",
      fallback,
      true,
    );
  }

  if (gris <= 0) {
    const fallback =
      carrier === "Brasil Web" ? 0.0025 : 0.001;

    gris = getParameterFromGeneralities(
      rows,
      "GRIS",
      fallback,
      true,
    );
  }

  let toll = tollFee.value;

  if (toll <= 0 && !tollFee.included) {
    if (carrier === "Rodobrás") {
      toll = getParameterFromGeneralities(
        rows,
        "PEDAGIO",
        4.9,
        false,
      );
    } else if (carrier === "Brasil Web") {
      toll = getParameterFromGeneralities(
        rows,
        "PEDAGIO",
        4,
        false,
      );
    }
  }

  const tollCost =
    toll > 0 && !tollFee.included
      ? ceilHundreds(realWeightKg) * toll
      : 0;

  return {
    cost: roundMoney(
      base +
        invoiceValue * adValorem +
        invoiceValue * gris +
        tollCost,
    ),
    reason:
      `Faixa de peso com fator de cubagem ${factor} kg/m³.`,
  };
}

function quoteVenkon(
  datasets: DatasetMap,
  city: string,
  uf: string,
  realWeightKg: number,
  cubicVolumeM3: number,
  invoiceValue: number,
): QuoteResult {
  const rows = datasets.get("TABELA_VENKON") ?? [];
  const table = findRouteTable(rows);

  if (!table) {
    return {
      cost: null,
      reason: "Tabela Venkon não carregada ou sem cabeçalho.",
    };
  }

  const destination = getVenkonDestination(datasets, city, uf);
  const route = findRoute(table, uf, destination);

  if (!route) {
    return {
      cost: null,
      reason: `Venkon sem tarifa para ${uf} / ${destination}.`,
    };
  }

  const bandRow = rows[table.headerIndex + 1] ?? [];

  const chargedWeight = Math.max(
    realWeightKg,
    cubicVolumeM3 * CUBAGE_FACTOR_DEFAULT,
  );

  const band = findWeightBand(bandRow, chargedWeight);

  if (!band) {
    return {
      cost: null,
      reason:
        `Venkon sem faixa para ` +
        `${chargedWeight.toFixed(2)} kg tarifários.`,
    };
  }

  let base = parseNumber(route.row[band.columnIndex]) ?? 0;

  if (base <= 0) {
    return {
      cost: null,
      reason: "Tarifa Venkon zerada para a rota.",
    };
  }

  if (band.isPerKgRate) {
    base *= chargedWeight;
  }

  const adValoremColumn = findFeeColumn(
    bandRow,
    ["ADVALOREM"],
  );

  const grisColumn = findFeeColumn(bandRow, ["GRIS"]);
  const tollColumn = findFeeColumn(bandRow, ["PEDAGIO"]);

  const adValorem =
    adValoremColumn >= 0
      ? parsePercent(route.row[adValoremColumn], 0)
      : 0;

  const gris =
    grisColumn >= 0
      ? parsePercent(route.row[grisColumn], 0)
      : 0;

  const toll =
    tollColumn >= 0
      ? parseNumber(route.row[tollColumn]) ?? 0
      : 0;

  const tollCost =
    toll > 0 ? ceilHundreds(chargedWeight) * toll : 0;

  return {
    cost: roundMoney(
      base +
        invoiceValue * adValorem +
        invoiceValue * gris +
        tollCost,
    ),
    reason: `Peso cobrado ${chargedWeight.toFixed(2)} kg.`,
  };
}

function quoteModular(
  datasets: DatasetMap,
  uf: string,
  destination: string,
  shipment: NormalizedShipment,
  shipmentType: ShipmentType,
  realWeightKg: number,
): QuoteResult {
  const rows = datasets.get("TABELA_MODULAR") ?? [];
  const table = findRouteTable(rows);

  if (!table) {
    return {
      cost: null,
      reason: "Tabela Modular não carregada ou sem cabeçalho.",
    };
  }

  const route = findRoute(table, uf, destination);

  if (!route) {
    return {
      cost: null,
      reason:
        `Sem tarifa Modular para ${uf} / ${destination}.`,
    };
  }

  const subHeader = rows[table.headerIndex + 1] ?? [];
  const header = rows[table.headerIndex] ?? [];

  // Mesma correção de grafia utilizada na Rodonaves.
  const minimumColumn = findColumn(header, ["FRETEMINIMO"]);

  const minimum =
    minimumColumn >= 0
      ? parseNumber(route.row[minimumColumn]) ?? 0
      : 0;

  const categoryValues = new Map<string, number>();

  for (const item of shipment.items) {
    const deposit = String(
      item.original.values["Depósito"] ?? "",
    )
      .trim()
      .toUpperCase();

    const itemType =
      deposit === "B130" || deposit === "B412"
        ? "PECAS"
        : shipmentType;

    const description =
      item.original.values["Denominação de item"] ?? "";

    const category = getCommercialCategory(
      itemType,
      description,
    );

    categoryValues.set(
      category,
      (categoryValues.get(category) ?? 0) +
        item.invoiceValue,
    );
  }

  const categoryColumns: Record<string, string[]> = {
    PECAS: ["PECAS"],
    PORTATEIS: ["PORTATEIS"],
    REFRIGERADORES: ["REFRIGERADORES", "LAVAESECA"],
    "SMALL RR": ["SMALLRR", "FRIGOBAR"],
    CHILLER: ["CHILLER"],
    FANCOIL: ["FANCOIL"],
    PACKAGE: ["PACKAGE"],
    HW: ["HW"],
  };

  let base = 0;

  for (const [category, categoryInvoiceValue] of categoryValues) {
    const aliases = categoryColumns[category];

    if (!aliases) {
      return {
        cost: null,
        reason:
          "A Modular não tem tarifa específica para a " +
          `categoria ${category}.`,
      };
    }

    const columnIndex = findColumn(subHeader, aliases);

    if (columnIndex < 0) {
      return {
        cost: null,
        reason:
          `Coluna Modular não localizada para ${category}.`,
      };
    }

    const percent = parsePercent(route.row[columnIndex], 0);

    if (percent <= 0) {
      return {
        cost: null,
        reason: `Rota sem tarifa Modular para ${category}.`,
      };
    }

    base += categoryInvoiceValue * percent;
  }

  if (base <= 0) {
    return {
      cost: null,
      reason: "Tarifa Modular sem valor aplicável.",
    };
  }

  if (base < minimum) {
    base = minimum;
  }

  const gris = getParameterFromGeneralities(
    rows,
    "GRIS",
    0.0037,
    true,
  );

  const adValorem = getParameterFromGeneralities(
    rows,
    "SEGURO (ADV)",
    0.0015,
    true,
  );

  const toll = getParameterFromGeneralities(
    rows,
    "PEDAGIO FRACIONADO",
    7.44,
    false,
  );

  const total =
    base +
    shipment.invoiceValue * gris +
    shipment.invoiceValue * adValorem +
    ceilHundreds(realWeightKg) * toll;

  return {
    cost: roundMoney(total),
    reason:
      "Tarifa percentual por categoria, mínimo, GRIS, ADV e pedágio.",
  };
}

function quoteAneg(
  datasets: DatasetMap,
  city: string,
  uf: string,
  realWeightKg: number,
  cubicVolumeM3: number,
  invoiceValue: number,
): QuoteResult {
  const rows = datasets.get("TABELA_ANEG") ?? [];
  const table = findRouteTable(rows);

  if (!table) {
    return {
      cost: null,
      reason: "Tabela ANEG não carregada ou sem cabeçalho.",
    };
  }

  const destination = getAnegDestination(datasets, city, uf);
  const route = findRoute(table, uf, destination);

  if (!route) {
    return {
      cost: null,
      reason: `Sem tarifa ANEG para ${uf} / ${destination}.`,
    };
  }

  const subHeader = rows[table.headerIndex + 1] ?? [];

  const truckColumn = findColumn(subHeader, ["TRUCK"]);
  const truckTollColumn = findColumn(
    subHeader,
    ["PEDAGIOTRUCK"],
  );

  const trailerColumn = findColumn(subHeader, ["CARRETA"]);
  const trailerTollColumn = findColumn(
    subHeader,
    ["PEDAGIOCARRETA"],
  );

  const truckRateColumn =
    truckColumn >= 0 ? truckColumn : 4;

  const truckTollRateColumn =
    truckTollColumn >= 0 ? truckTollColumn : 5;

  const trailerRateColumn =
    trailerColumn >= 0 ? trailerColumn : 6;

  const trailerTollRateColumn =
    trailerTollColumn >= 0 ? trailerTollColumn : 7;

  const truckRate =
    parseNumber(route.row[truckRateColumn]) ?? 0;

  const truckToll =
    parseNumber(route.row[truckTollRateColumn]) ?? 0;

  const trailerRate =
    parseNumber(route.row[trailerRateColumn]) ?? 0;

  const trailerToll =
    parseNumber(route.row[trailerTollRateColumn]) ?? 0;

  const gris = getParameterFromGeneralities(
    rows,
    "GRIS",
    ANEG_GRIS_DEFAULT,
    true,
  );

  const adValorem = getParameterFromGeneralities(
    rows,
    "SEGURO - AD VALOREM",
    ANEG_ADV_DEFAULT,
    true,
  );

  const additionalInvoiceCost =
    invoiceValue * gris + invoiceValue * adValorem;

  let truckCost = 0;
  let trailerCost = 0;

  if (truckRate > 0) {
    const truckCount = Math.max(
      Math.ceil(cubicVolumeM3 / 50),
      Math.ceil(realWeightKg / 10000),
      1,
    );

    truckCost =
      (truckRate + truckToll + 450) * truckCount +
      additionalInvoiceCost;
  }

  if (trailerRate > 0) {
    const trailerCount = Math.max(
      Math.ceil(cubicVolumeM3 / 100),
      Math.ceil(realWeightKg / 27000),
      1,
    );

    trailerCost =
      (trailerRate + trailerToll + 580) * trailerCount +
      additionalInvoiceCost;
  }

  if (truckCost <= 0 && trailerCost <= 0) {
    return {
      cost: null,
      reason: "Tarifa de lotação ANEG sem valor para a rota.",
    };
  }

  const cost =
    truckCost > 0 &&
    (trailerCost <= 0 || truckCost <= trailerCost)
      ? truckCost
      : trailerCost;

  return {
    cost: roundMoney(cost),
    reason:
      "Compara truck e carreta por capacidade; inclui " +
      "pedágio, carregamento, GRIS e ADV.",
  };
}

function getCurrentCarrier(
  shipment: NormalizedShipment,
): FreightCarrier | "MÚLTIPLAS" | "NÃO IDENTIFICADA" {
  const carriers = shipment.items.map((item) =>
    getCarrierFromNameOrCode(
      item.original.values.Transportadora,
      item.original.values.Código,
    ),
  );

  const unique = Array.from(new Set(carriers));

  if (unique.length > 1) {
    return "MÚLTIPLAS";
  }

  return unique[0] ?? "NÃO IDENTIFICADA";
}

function getShipmentMetrics(
  shipment: NormalizedShipment,
  materialMap: Map<string, MaterialInfo>,
) {
  let realWeightKg = 0;
  let cubicVolumeM3 = 0;
  let missingWeightItems = 0;
  let missingCubageItems = 0;

  for (const item of shipment.items) {
    const material = normalizeMaterial(item.material);
    let info = materialMap.get(material);

    if (!info) {
      info = materialMap.get(
        normalizeMaterialWithoutLeadingZeros(item.material),
      );
    }

    const quantity = item.quantity;

    if (!info || info.weightKg === null) {
      missingWeightItems += 1;
    } else {
      realWeightKg += quantity * info.weightKg;
    }

    if (!info || info.cubicVolumeM3 === null) {
      missingCubageItems += 1;
    } else {
      cubicVolumeM3 += quantity * info.cubicVolumeM3;
    }
  }

  return {
    realWeightKg,
    cubicVolumeM3,
    missingWeightItems,
    missingCubageItems,
  };
}

function getCarrierQuote(
  carrier: FreightCarrier,
  datasets: DatasetMap,
  shipment: NormalizedShipment,
  shipmentType: ShipmentType,
  uf: string,
  city: string,
  defaultDestination: string,
  realWeightKg: number,
  cubicVolumeM3: number,
  missingWeightItems: number,
  missingCubageItems: number,
): QuoteResult {
  const matrixEligible = isEligibleByMatrix(
    datasets,
    carrier,
    shipmentType,
    uf,
    defaultDestination,
    realWeightKg,
    cubicVolumeM3,
  );

  if (!matrixEligible) {
    return {
      cost: null,
      reason:
        `Não elegível na matriz para ${shipmentType}, ` +
        `${uf} / ${defaultDestination}.`,
    };
  }

  const hasMissingWeight = missingWeightItems > 0;
  const hasMissingCubage = missingCubageItems > 0;

  switch (carrier) {
    case "Venkon":
      if (hasMissingWeight || hasMissingCubage) {
        return {
          cost: null,
          reason:
            "Há item sem peso ou cubagem na base de materiais.",
        };
      }

      return quoteVenkon(
        datasets,
        city,
        uf,
        realWeightKg,
        cubicVolumeM3,
        shipment.invoiceValue,
      );

    case "Rodonaves": {
      if (hasMissingWeight) {
        return {
          cost: null,
          reason: "Há item sem peso na base de materiais.",
        };
      }

      const destination = getRteDestination(
        datasets,
        city,
        uf,
      );

      if (!destination) {
        return {
          cost: null,
          reason: "Cidade não localizada nos prazos Rodonaves.",
        };
      }

      return quoteRte(
        datasets,
        uf,
        destination,
        shipmentType,
        realWeightKg,
        shipment.invoiceValue,
      );
    }

    case "Favorita":
      if (hasMissingWeight || hasMissingCubage) {
        return {
          cost: null,
          reason:
            "Há item sem peso ou cubagem na base de materiais.",
        };
      }

      return quoteWeightTable(
        datasets,
        "TABELA_FAVORITA",
        "Favorita",
        uf,
        defaultDestination,
        realWeightKg,
        cubicVolumeM3,
        shipment.invoiceValue,
      );

    case "Rodobrás":
      if (hasMissingWeight || hasMissingCubage) {
        return {
          cost: null,
          reason:
            "Há item sem peso ou cubagem na base de materiais.",
        };
      }

      return quoteWeightTable(
        datasets,
        "TABELA_RODOBRAS",
        "Rodobrás",
        uf,
        defaultDestination,
        realWeightKg,
        cubicVolumeM3,
        shipment.invoiceValue,
      );

    case "Brasil Web":
      if (hasMissingWeight || hasMissingCubage) {
        return {
          cost: null,
          reason:
            "Há item sem peso ou cubagem na base de materiais.",
        };
      }

      return quoteWeightTable(
        datasets,
        "TABELA_BRASIL_WEB",
        "Brasil Web",
        uf,
        defaultDestination,
        realWeightKg,
        cubicVolumeM3,
        shipment.invoiceValue,
      );

    case "Modular":
      if (hasMissingWeight) {
        return {
          cost: null,
          reason: "Há item sem peso na base de materiais.",
        };
      }

      return quoteModular(
        datasets,
        uf,
        defaultDestination,
        shipment,
        shipmentType,
        realWeightKg,
      );

    case "ANEG":
      if (hasMissingWeight || hasMissingCubage) {
        return {
          cost: null,
          reason:
            "Há item sem peso ou cubagem na base de materiais.",
        };
      }

      return quoteAneg(
        datasets,
        city,
        uf,
        realWeightKg,
        cubicVolumeM3,
        shipment.invoiceValue,
      );
  }
}

export function calculateFreight(
  shipments: NormalizedShipment[],
  activeDatasets: FreightDatasetVersion[],
): FreightCalculationResult {
  if (shipments.length === 0) {
    return {
      success: false,
      errors: ["Não há remessas para calcular."],
    };
  }

  const datasets = buildDatasetMap(activeDatasets);
  const baseRows = datasets.get("BASE_MATERIAIS") ?? [];
  const materialMap = buildMaterialMap(baseRows);

  if (materialMap.size === 0) {
    return {
      success: false,
      errors: [
        "A base de materiais ativa não foi encontrada ou não " +
          "contém as colunas Material, Peso Unitário KG e " +
          "Cubagem Unitária (m³).",
      ],
    };
  }

  const warnings: string[] = [];
  const results: CalculatedFreightShipment[] = [];

  for (const shipment of shipments) {
    const firstItem = shipment.items[0];

    if (!firstItem) {
      continue;
    }

    const uf = String(
      firstItem.original.values.Região ?? "",
    )
      .trim()
      .toUpperCase();

    const city = String(
      firstItem.original.values.Cidade ?? "",
    ).trim();

    const shipmentType = getShipmentType(shipment);

    const defaultDestination =
      getDestinationByOfficialCapital(city, uf);

    const metrics = getShipmentMetrics(
      shipment,
      materialMap,
    );

    const currentCarrier = getCurrentCarrier(shipment);

    if (metrics.missingWeightItems > 0) {
      warnings.push(
        `Remessa ${shipment.shipment}: ` +
          `${metrics.missingWeightItems} item(ns) sem peso ` +
          "cadastrado na base de materiais.",
      );
    }

    if (metrics.missingCubageItems > 0) {
      warnings.push(
        `Remessa ${shipment.shipment}: ` +
          `${metrics.missingCubageItems} item(ns) sem cubagem ` +
          "cadastrada na base de materiais.",
      );
    }

    const quotes: FreightCarrierQuote[] =
      FREIGHT_CARRIERS.map((carrier) => {
        const quote = getCarrierQuote(
          carrier,
          datasets,
          shipment,
          shipmentType,
          uf,
          city,
          defaultDestination,
          metrics.realWeightKg,
          metrics.cubicVolumeM3,
          metrics.missingWeightItems,
          metrics.missingCubageItems,
        );

        return {
          carrier,
          cost: quote.cost,
          reason: quote.reason,
        };
      });

    const availableQuotes = quotes.filter(
      (
        quote,
      ): quote is FreightCarrierQuote & { cost: number } =>
        quote.cost !== null && quote.cost > 0,
    );

    let bestCarrier: FreightCarrier | null = null;
    let bestCost: number | null = null;

    for (const quote of availableQuotes) {
      if (bestCost === null || quote.cost < bestCost) {
        bestCarrier = quote.carrier;
        bestCost = quote.cost;
      }
    }

    const currentQuote =
      currentCarrier !== "MÚLTIPLAS" &&
      currentCarrier !== "NÃO IDENTIFICADA"
        ? quotes.find(
            (quote) => quote.carrier === currentCarrier,
          )
        : undefined;

    const currentCost =
      currentQuote?.cost !== null &&
      currentQuote?.cost !== undefined &&
      currentQuote.cost > 0
        ? currentQuote.cost
        : null;

    let potentialSavings = 0;
    let potentialSavingsPercent = 0;

    if (currentCost !== null && bestCost !== null) {
      potentialSavings = roundMoney(currentCost - bestCost);

      if (potentialSavings < 0.01) {
        potentialSavings = 0;
      }

      if (potentialSavings > 0) {
        potentialSavingsPercent =
          potentialSavings / currentCost;
      }
    }

    let status: string;

    if (bestCost === null) {
      status = "SEM OPÇÃO DE COTAÇÃO";
    } else if (currentCost === null) {
      status = "OPORTUNIDADE PENDENTE DE VALIDAÇÃO";
    } else if (
      potentialSavings > 0 &&
      bestCarrier !== currentCarrier
    ) {
      status = `SEGUIR COM ${bestCarrier}`;
    } else {
      status = `MANTER ${currentCarrier}`;
    }

    results.push({
      shipment: shipment.shipment,
      creationDate: firstItem.creationDate,
      uf,
      city,
      shipmentType,
      quantity: shipment.quantity,
      invoiceValue: roundMoney(shipment.invoiceValue),
      realWeightKg: metrics.realWeightKg,
      cubicVolumeM3: metrics.cubicVolumeM3,
      missingWeightItems: metrics.missingWeightItems,
      missingCubageItems: metrics.missingCubageItems,
      currentCarrier,
      currentCost,
      bestCarrier,
      bestCost,
      potentialSavings,
      potentialSavingsPercent,
      status,
      quotes,
    });
  }

  return {
    success: true,
    shipments: results,
    warnings: Array.from(new Set(warnings)),
  };
}