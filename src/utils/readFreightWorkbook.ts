import * as XLSX from "xlsx";

export const FREIGHT_SHEET_KEYS = [
  "BASE_MATERIAIS",
  "TABELA_VENKON",
  "TABELA_VENKON_TDE",
  "TABELA_VENKON_GENERALIDADES",
  "TABELA_VENKON_ABR",
  "TABELA_RODONAVES",
  "TABELA_RTE_PRAZOS",
  "TABELA_FAVORITA",
  "TABELA_RODOBRAS",
  "TABELA_BRASIL_WEB",
  "TABELA_MODULAR",
  "TABELA_ANEG",
  "TABELA_ANEG_CIDADES",
  "MATRIZ_UF_PRODUTO_ACABADO",
  "MATRIZ_UF_PECAS",
] as const;

export type FreightSheetKey = (typeof FREIGHT_SHEET_KEYS)[number];

export const CARRIER_SHEET_KEYS = [
  "TABELA_VENKON",
  "TABELA_RODONAVES",
  "TABELA_FAVORITA",
  "TABELA_RODOBRAS",
  "TABELA_BRASIL_WEB",
  "TABELA_MODULAR",
  "TABELA_ANEG",
] as const;

export type CarrierSheetKey = (typeof CARRIER_SHEET_KEYS)[number];

export type SpreadsheetCell = string | number | boolean;

export type FreightWorkbookSheets = Partial<
  Record<FreightSheetKey, SpreadsheetCell[][]>
>;

export type FreightWorkbookTab = {
  name: string;
  rows: SpreadsheetCell[][];
  datasetKey: FreightSheetKey | null;
};

export type FreightWorkbookReadResult =
  | {
      success: true;
      fileName: string;
      sheets: FreightWorkbookSheets;
      allSheets: FreightWorkbookTab[];
      foundSheetNames: string[];
      warnings: string[];
    }
  | {
      success: false;
      errors: string[];
    };

function normalizeName(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function toSpreadsheetCell(value: unknown): SpreadsheetCell {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function isSupportedFile(file: File): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase();

  return (
    extension === "xlsx" ||
    extension === "xlsm" ||
    extension === "xls"
  );
}

function hasBaseMaterialHeaders(rows: SpreadsheetCell[][]): boolean {
  return rows.some((row) => {
    const headers = row.map((cell) =>
      normalizeName(String(cell ?? "")),
    );

    const hasMaterial = headers.includes("MATERIAL");
    const hasUnitWeight = headers.includes("PESOUNITARIOKG");
    const hasUnitCubage = headers.some((header) =>
      header.startsWith("CUBAGEMUNITARIA"),
    );

    return hasMaterial && hasUnitWeight && hasUnitCubage;
  });
}

function identifyDatasetKey(
  fileName: string,
  sheetName: string,
  sheetCount: number,
  rows: SpreadsheetCell[][],
): FreightSheetKey | null {
  const file = normalizeName(fileName);
  const sheet = normalizeName(sheetName);

  if (
    sheet === "BASEMATERIAIS" ||
    sheet === "BASEDEMATERIAIS" ||
    hasBaseMaterialHeaders(rows)
  ) {
    return "BASE_MATERIAIS";
  }

  if (file.includes("DIVISAO")) {
    if (
      sheet.includes("PRODUTOACABADO") ||
      sheet.includes("PRODUTOSACABADOS")
    ) {
      return "MATRIZ_UF_PRODUTO_ACABADO";
    }

    if (sheet.includes("PECAS")) {
      return "MATRIZ_UF_PECAS";
    }
  }

  if (file.includes("VENKON")) {
    if (
      sheet === "TDE" ||
      sheet.includes("TAXADEENTREGA")
    ) {
      return "TABELA_VENKON_TDE";
    }

    // Reconhece as grafias "Generalidades" e "Generadidades".
    if (sheet.startsWith("GENERA")) {
      return "TABELA_VENKON_GENERALIDADES";
    }

    if (
      sheet.includes("ABRANGENCIA") &&
      (sheet.includes("VIGENTE") || sheet.includes("VIDENTE"))
    ) {
      return "TABELA_VENKON_ABR";
    }

    if (sheet.includes("PADRAOPESOCUBADO")) {
      return "TABELA_VENKON";
    }
  }

  if (file.includes("RODOBRAS")) {
    if (sheet.includes("PADRAOPESOCUBADO")) {
      return "TABELA_RODOBRAS";
    }
  }

  if (file.includes("BRASILWEB")) {
    if (sheet.includes("PADRAOPESOCUBADO")) {
      return "TABELA_BRASIL_WEB";
    }
  }

  if (file.includes("MODULAR")) {
    if (
      sheet.includes("FRETEPERCENTUAL") ||
      sheet.includes("TABELADEFRETE")
    ) {
      return "TABELA_MODULAR";
    }
  }

  if (file.includes("ANEG")) {
    if (sheet.includes("CIDADESCAPITALINTERIOR")) {
      return "TABELA_ANEG_CIDADES";
    }

    if (sheet.includes("ORIGEMEXTREMA")) {
      return "TABELA_ANEG";
    }
  }

  if (file.includes("RTE") || file.includes("RODONAVES")) {
    if (sheet === "PRAZOS") {
      return "TABELA_RTE_PRAZOS";
    }

    if (
      sheet.includes("SPRINGER") ||
      sheet.includes("TAC") ||
      sheet.includes("TABELADEFRETE")
    ) {
      return "TABELA_RODONAVES";
    }
  }

  if (file.includes("FAVORITA") && sheetCount === 1) {
    return "TABELA_FAVORITA";
  }

  return null;
}

export async function readFreightWorkbook(
  file: File,
): Promise<FreightWorkbookReadResult> {
  if (!file || file.size === 0) {
    return {
      success: false,
      errors: ["Selecione um arquivo Excel válido."],
    };
  }

  if (!isSupportedFile(file)) {
    return {
      success: false,
      errors: [
        "Formato não suportado. Selecione um arquivo .xlsx, .xlsm ou .xls.",
      ],
    };
  }

  try {
    const fileBuffer = await file.arrayBuffer();

    const workbook = XLSX.read(fileBuffer, {
      type: "array",
      raw: true,
      cellDates: false,
    });

    if (workbook.SheetNames.length === 0) {
      return {
        success: false,
        errors: ["O arquivo Excel não contém abas."],
      };
    }

    const sheets: FreightWorkbookSheets = {};
    const allSheets: FreightWorkbookTab[] = [];
    const warnings: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        warnings.push(
          `A aba "${sheetName}" foi identificada, mas não pôde ser lida.`,
        );
        continue;
      }

      const rawRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: true,
        defval: "",
        blankrows: true,
      }) as unknown[][];

      const rows = rawRows.map((row) =>
        row.map(toSpreadsheetCell),
      );

      const datasetKey = identifyDatasetKey(
        file.name,
        sheetName,
        workbook.SheetNames.length,
        rows,
      );

      // Guarda cada aba lida, inclusive as auxiliares.
      allSheets.push({
        name: sheetName,
        rows,
        datasetKey,
      });

      if (!datasetKey) {
        continue;
      }

      if (sheets[datasetKey]) {
        warnings.push(
          `Mais de uma aba corresponde a ${datasetKey}. A aba "${sheetName}" não substituiu a primeira.`,
        );
        continue;
      }

      sheets[datasetKey] = rows;
    }

    if (allSheets.length === 0) {
      return {
        success: false,
        errors: ["Não foi possível ler nenhuma aba do arquivo."],
      };
    }

    if (Object.keys(sheets).length === 0) {
      return {
        success: false,
        errors: [
          "As abas foram lidas, mas o arquivo não foi identificado como uma das tabelas do simulador.",
          `Abas encontradas: ${workbook.SheetNames.join(", ")}.`,
        ],
      };
    }

    return {
      success: true,
      fileName: file.name,
      sheets,
      allSheets,
      foundSheetNames: workbook.SheetNames,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        error instanceof Error
          ? `Não foi possível ler o arquivo: ${error.message}`
          : "Não foi possível ler o arquivo Excel.",
      ],
    };
  }
}