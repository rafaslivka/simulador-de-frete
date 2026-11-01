export const REQUIRED_HEADERS = [
  "Remessa",
  "Data de criação",
  "Preço Crédito",
  "Nome",
  "Material",
  "Qtd.remessa",
  "Incoterms",
  "Região",
  "Cidade",
  "Centro",
  "Depósito",
  "Denominação de item",
  "Tipo doc.vendas",
  "Transportadora",
  "Código",
] as const;

export type ShipmentHeader = (typeof REQUIRED_HEADERS)[number];

export type ShipmentItem = {
  sourceRow: number;
  values: Record<ShipmentHeader, string>;
};

export type ShipmentGroup = {
  shipment: string;
  items: ShipmentItem[];
};

export type ShipmentReadResult =
  | {
      success: true;
      items: ShipmentItem[];
      shipments: ShipmentGroup[];
    }
  | {
      success: false;
      errors: string[];
    };

type HeaderMapping = {
  indexes: Map<ShipmentHeader, number>;
  columnCount: number;
};

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const NORMALIZED_HEADERS = new Set(
  REQUIRED_HEADERS.map(normalizeHeader),
);

/**
 * Reconhece cabeçalhos entre os blocos de transportadoras.
 * A primeira linha não vazia sempre é tratada como cabeçalho.
 */
function isHeaderRow(cells: string[]): boolean {
  const normalizedCells = cells.map(normalizeHeader);

  const recognizedHeaders = new Set(
    normalizedCells.filter((value) => NORMALIZED_HEADERS.has(value)),
  );

  return (
    recognizedHeaders.size >= 3 ||
    (
      recognizedHeaders.has("remessa") &&
      recognizedHeaders.has("material")
    )
  );
}

/**
 * Valida os cabeçalhos e registra a posição das colunas
 * para o bloco de dados seguinte.
 */
function readHeader(
  cells: string[],
  sourceRow: number,
): {
  mapping: HeaderMapping | null;
  errors: string[];
} {
  const normalizedCells = cells.map(normalizeHeader);
  const indexes = new Map<ShipmentHeader, number>();
  const errors: string[] = [];

  for (const header of REQUIRED_HEADERS) {
    const expectedHeader = normalizeHeader(header);

    const matches = normalizedCells
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value === expectedHeader);

    if (matches.length === 0) {
      errors.push(
        `Cabeçalho da linha ${sourceRow}: coluna obrigatória não encontrada: ${header}.`,
      );
      continue;
    }

    if (matches.length > 1) {
      errors.push(
        `Cabeçalho da linha ${sourceRow}: a coluna "${header}" está repetida no mesmo cabeçalho.`,
      );
      continue;
    }

    indexes.set(header, matches[0].index);
  }

  if (errors.length > 0) {
    return {
      mapping: null,
      errors,
    };
  }

  return {
    mapping: {
      indexes,
      columnCount: cells.length,
    },
    errors: [],
  };
}

/**
 * Lê células separadas por tabulação, como na cópia do Excel.
 * Preserva tabulações e quebras de linha dentro de células entre aspas.
 */
function parseClipboard(text: string): string[][] {
  const normalizedText = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;
  let closedQuotes = false;

  function finishCell() {
    row.push(cell.trim());
    cell = "";
    closedQuotes = false;
  }

  function finishRow() {
    finishCell();
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];

    if (insideQuotes) {
      if (character !== '"') {
        cell += character;
        continue;
      }

      if (normalizedText[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        insideQuotes = false;
        closedQuotes = true;
      }

      continue;
    }

    if (character === "\t") {
      finishCell();
      continue;
    }

    if (character === "\n") {
      finishRow();
      continue;
    }

    if (closedQuotes) {
      if (character === " ") continue;

      throw new Error(
        "Há conteúdo inesperado após uma célula entre aspas. Copie novamente os dados diretamente do Excel.",
      );
    }

    if (character === '"' && cell.length === 0) {
      insideQuotes = true;
      continue;
    }

    cell += character;
  }

  if (insideQuotes) {
    throw new Error(
      "Existe uma célula com aspas não fechadas. Copie novamente a seleção completa do Excel.",
    );
  }

  finishRow();

  return rows;
}

export function readShipments(text: string): ShipmentReadResult {
  if (!text.trim()) {
    return {
      success: false,
      errors: ["Cole os dados das remessas, incluindo os cabeçalhos."],
    };
  }

  let parsedRows: string[][];

  try {
    parsedRows = parseClipboard(text);
  } catch (error) {
    return {
      success: false,
      errors: [
        error instanceof Error
          ? error.message
          : "Não foi possível interpretar os dados colados.",
      ],
    };
  }

  const nonEmptyRows = parsedRows
    .map((cells, index) => ({
      cells,
      sourceRow: index + 1,
    }))
    .filter((row) => row.cells.some((cell) => cell !== ""));

  if (nonEmptyRows.length === 0) {
    return {
      success: false,
      errors: ["Nenhum conteúdo foi encontrado na área de colagem."],
    };
  }

  const errors: string[] = [];
  const items: ShipmentItem[] = [];

  let currentMapping: HeaderMapping | null = null;
  let foundDataRow = false;

  for (const [index, row] of nonEmptyRows.entries()) {
    const isHeader = index === 0 || isHeaderRow(row.cells);

    if (isHeader) {
      const headerResult = readHeader(row.cells, row.sourceRow);

      currentMapping = headerResult.mapping;
      errors.push(...headerResult.errors);

      // Cabeçalhos delimitam blocos, mas não contam como itens.
      continue;
    }

    foundDataRow = true;

    // Mantém uma referência constante para uso dentro do map.
    const mapping = currentMapping;

    // Blocos com cabeçalho inválido não usam o mapa anterior.
    if (mapping === null) {
      continue;
    }

    const hasUnexpectedColumns = row.cells
      .slice(mapping.columnCount)
      .some((cell) => cell !== "");

    if (hasUnexpectedColumns) {
      errors.push(
        `Linha ${row.sourceRow}: há dados além das colunas do cabeçalho deste bloco.`,
      );
      continue;
    }

    const values = Object.fromEntries(
      REQUIRED_HEADERS.map((header) => {
        const columnIndex = mapping.indexes.get(header);

        const value =
          columnIndex === undefined
            ? ""
            : (row.cells[columnIndex] ?? "");

        return [header, value];
      }),
    ) as Record<ShipmentHeader, string>;

    const requiredItemFields: ShipmentHeader[] = [
      "Remessa",
      "Material",
      "Qtd.remessa",
    ];

    const emptyFields = requiredItemFields.filter(
      (header) => values[header] === "",
    );

    if (emptyFields.length > 0) {
      errors.push(
        `Linha ${row.sourceRow}: preencha ${emptyFields.join(", ")}.`,
      );
      continue;
    }

    items.push({
      sourceRow: row.sourceRow,
      values,
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  if (!foundDataRow || items.length === 0) {
    return {
      success: false,
      errors: [
        "Os cabeçalhos foram encontrados, mas não há linhas de dados.",
      ],
    };
  }

  const groupedItems = new Map<string, ShipmentItem[]>();

  for (const item of items) {
    const shipment = item.values.Remessa;
    const existingItems = groupedItems.get(shipment);

    if (existingItems) {
      existingItems.push(item);
    } else {
      groupedItems.set(shipment, [item]);
    }
  }

  const shipments = Array.from(
    groupedItems,
    ([shipment, shipmentItems]) => ({
      shipment,
      items: shipmentItems,
    }),
  );

  return {
    success: true,
    items,
    shipments,
  };
}