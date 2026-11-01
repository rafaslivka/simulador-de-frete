import type { ShipmentItem } from "./readShipments";

export type NormalizedItem = {
  sourceRow: number;
  original: ShipmentItem;
  shipment: string;
  material: string;
  creationDate: string;
  invoiceValue: number;
  originalQuantity: number;
  quantity: number;
};

export type NormalizedShipment = {
  shipment: string;
  items: NormalizedItem[];
  invoiceValue: number;
  quantity: number;
};

export type NormalizationResult =
  | {
      success: true;
      items: NormalizedItem[];
      shipments: NormalizedShipment[];
      warnings: string[];
    }
  | {
      success: false;
      errors: string[];
    };

/**
 * Interpreta números no formato brasileiro.
 *
 * Exemplos:
 * "1.234,56" -> 1234.56
 * "1234,56"  -> 1234.56
 * "1.000"    -> 1000
 * "3"        -> 3
 *
 * Valores monetários podem conter o prefixo R$ ou R$:.
 * Conteúdos inválidos não são convertidos silenciosamente em zero.
 */
export function parseBrazilianNumber(
  rawValue: string,
  allowCurrency = false,
): number | null {
  let value = rawValue.trim();

  if (allowCurrency) {
    value = value.replace(/^R\$\s*:?\s*/i, "").trim();
  }

  const brazilianPattern =
    /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/;

  if (!brazilianPattern.test(value)) {
    return null;
  }

  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(normalized);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (Math.abs(number) > Number.MAX_SAFE_INTEGER) {
    return null;
  }

  return number;
}

/**
 * Aceita DD/MM/AAAA ou AAAA-MM-DD.
 * Retorna AAAA-MM-DD, sem conversão de fuso horário.
 * Rejeita datas inexistentes, como 31/02/2026.
 */
export function parseCreationDate(rawValue: string): string | null {
  const value = rawValue.trim();

  const brazilianDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  let year: number;
  let month: number;
  let day: number;

  if (brazilianDate) {
    day = Number(brazilianDate[1]);
    month = Number(brazilianDate[2]);
    year = Number(brazilianDate[3]);
  } else if (isoDate) {
    year = Number(isoDate[1]);
    month = Number(isoDate[2]);
    day = Number(isoDate[3]);
  } else {
    return null;
  }

  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return null;
  }

  const leapYear =
    year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);

  const daysPerMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (day > daysPerMonth[month - 1]) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function normalizeShipments(
  sourceItems: ShipmentItem[],
): NormalizationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const items: NormalizedItem[] = [];

  if (sourceItems.length === 0) {
    return {
      success: false,
      errors: ["Não há itens para conferir."],
    };
  }

  for (const item of sourceItems) {
    const values = item.values;

    const invoiceValue = parseBrazilianNumber(
      values["Preço Crédito"],
      true,
    );

    const originalQuantity = parseBrazilianNumber(
      values["Qtd.remessa"],
    );

    const creationDate = parseCreationDate(
      values["Data de criação"],
    );

    if (invoiceValue === null) {
      errors.push(
        `Linha ${item.sourceRow}: Preço Crédito inválido. Use o formato brasileiro, como R$ 1.234,56.`,
      );
    }

    if (originalQuantity === null) {
      errors.push(
        `Linha ${item.sourceRow}: Qtd.remessa inválida. Use um número, como 3 ou 1,5.`,
      );
    }

    if (creationDate === null) {
      errors.push(
        `Linha ${item.sourceRow}: Data de criação inválida. Use DD/MM/AAAA, como 29/10/2026.`,
      );
    }

    if (
      invoiceValue === null ||
      originalQuantity === null ||
      creationDate === null
    ) {
      continue;
    }

    // Preserva a regra encontrada no VBA original.
    const quantity = originalQuantity <= 0 ? 1 : originalQuantity;

    if (originalQuantity <= 0) {
      warnings.push(
        `Linha ${item.sourceRow}, remessa ${values.Remessa}: quantidade ${values["Qtd.remessa"]} considerada como 1, conforme a regra do simulador original.`,
      );
    }

    items.push({
      sourceRow: item.sourceRow,
      original: item,
      shipment: values.Remessa,
      material: values.Material,
      creationDate,
      invoiceValue,
      originalQuantity,
      quantity,
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  const groups = new Map<string, NormalizedShipment>();

  for (const item of items) {
    let group = groups.get(item.shipment);

    if (!group) {
      group = {
        shipment: item.shipment,
        items: [],
        invoiceValue: 0,
        quantity: 0,
      };

      groups.set(item.shipment, group);
    }

    group.items.push(item);

    // Preço Crédito já representa o valor da linha.
    // Não multiplicar novamente pela quantidade.
    group.invoiceValue += item.invoiceValue;
    group.quantity += item.quantity;
  }

  for (const group of groups.values()) {
    if (
      !Number.isFinite(group.invoiceValue) ||
      !Number.isFinite(group.quantity) ||
      Math.abs(group.invoiceValue) > Number.MAX_SAFE_INTEGER ||
      Math.abs(group.quantity) > Number.MAX_SAFE_INTEGER
    ) {
      errors.push(
        `Remessa ${group.shipment}: os totais ultrapassam o limite numérico suportado.`,
      );
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    items,
    shipments: Array.from(groups.values()),
    warnings,
  };
}