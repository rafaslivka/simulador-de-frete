export const CARRIERS = [
  "RODONAVES",
  "VENKON",
  "FAVORITA",
  "RODOBRAS",
  "BRASIL WEB",
  "MODULAR",
  "ANEG",
  "CCA EXPRESS",
] as const;

export type CarrierId = (typeof CARRIERS)[number];

export type CargoType = "PRODUTO" | "PECAS" | "NAO IDENTIFICADO";

export type CommercialCategory =
  | "PECAS"
  | "CHILLER"
  | "FANCOIL"
  | "PACKAGE"
  | "PORTATEIS"
  | "REFRIGERADORES"
  | "SMALL RR"
  | "HW"
  | "GERAL";

export type DestinationType = "Capital" | "Interior";

export type FreightRuleInput = {
  deposit: string;
  uf: string;
  city: string;
  weightKg: number;
  volumeM3: number;
};

export type CarrierEligibility = {
  carrier: CarrierId;
  eligible: boolean;
  reason: string;
};

const CCA_WEIGHT_LIMIT_KG = 30;
const DEFAULT_CUBIC_FACTOR = 300;

const PRODUCT_UFS: Record<CarrierId, string[]> = {
  RODONAVES: [],
  VENKON: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RJ", "RN", "SE", "SP"],
  FAVORITA: ["AC", "AM", "AP", "DF", "GO", "MS", "MT", "PA", "RO", "RR", "TO"],
  RODOBRAS: ["PR", "RS", "SC"],
  "BRASIL WEB": ["ES", "MG"],
  MODULAR: [],
  ANEG: ["PR", "RJ", "RS", "SP"],
  "CCA EXPRESS": [],
};

const PARTS_RODONAVES_UFS = [
  "AC",
  "AM",
  "AP",
  "DF",
  "ES",
  "GO",
  "MG",
  "MS",
  "MT",
  "PA",
  "PR",
  "RJ",
  "RO",
  "RR",
  "RS",
  "SC",
  "SP",
  "TO",
];

const PARTS_MODULAR_UFS = [
  "AL",
  "BA",
  "CE",
  "MA",
  "PB",
  "PE",
  "PI",
  "RN",
  "SE",
];

const CAPITALS_BY_UF: Record<string, string> = {
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

export function normalizeFreightText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function cargoTypeFromDeposit(deposit: string): CargoType {
  const normalizedDeposit = normalizeFreightText(deposit);

  switch (normalizedDeposit) {
    case "B114":
    case "B413":
      return "PRODUTO";

    case "B130":
    case "B412":
      return "PECAS";

    default:
      return "NAO IDENTIFICADO";
  }
}

export function commercialCategory(
  cargoType: CargoType,
  itemDescription: string,
): CommercialCategory {
  if (cargoType === "PECAS") {
    return "PECAS";
  }

  const description = normalizeFreightText(itemDescription);

  if (description.includes("CHILLER")) {
    return "CHILLER";
  }

  if (
    description.includes("FANCOIL") ||
    description.includes("FAN COIL")
  ) {
    return "FANCOIL";
  }

  if (description.includes("PACKAGE")) {
    return "PACKAGE";
  }

  if (description.includes("PORTATIL")) {
    return "PORTATEIS";
  }

  if (
    description.includes("REFRIGERADOR") ||
    description.includes("LAVA E SECA")
  ) {
    return "REFRIGERADORES";
  }

  if (
    description.includes("FRIGOBAR") ||
    description.includes("SMALL RR")
  ) {
    return "SMALL RR";
  }

  if (
    description.includes("AQUECEDOR") ||
    description.includes("HEAT WATER")
  ) {
    return "HW";
  }

  return "GERAL";
}

export function destinationCapitalInterior(
  city: string,
  uf: string,
): DestinationType {
  const normalizedUf = uf.trim().toUpperCase();
  const normalizedCity = normalizeFreightText(city);
  const capital = CAPITALS_BY_UF[normalizedUf];

  return capital && normalizedCity === capital ? "Capital" : "Interior";
}

export function isHeavyPartsShipment(
  weightKg: number,
  volumeM3: number,
): boolean {
  const cubicWeight = volumeM3 * DEFAULT_CUBIC_FACTOR;

  return (
    weightKg > CCA_WEIGHT_LIMIT_KG ||
    cubicWeight > CCA_WEIGHT_LIMIT_KG
  );
}

function ufIsListed(uf: string, list: string[]): boolean {
  return list.includes(uf.trim().toUpperCase());
}

export function getCarrierEligibility(
  carrier: CarrierId,
  input: FreightRuleInput,
): CarrierEligibility {
  const cargoType = cargoTypeFromDeposit(input.deposit);
  const uf = input.uf.trim().toUpperCase();
  const destination = destinationCapitalInterior(input.city, uf);

  if (cargoType === "NAO IDENTIFICADO") {
    return {
      carrier,
      eligible: false,
      reason: `Depósito ${input.deposit || "(vazio)"} não classificado pelo simulador.`,
    };
  }

  if (cargoType === "PRODUTO") {
    switch (carrier) {
      case "VENKON": {
        const eligible = ufIsListed(uf, PRODUCT_UFS.VENKON);

        return {
          carrier,
          eligible,
          reason: eligible
            ? "Atende produto nesta UF."
            : "Venkon não atende produto nesta UF.",
        };
      }

      case "RODONAVES": {
        const eligible = uf === "MG" || (uf === "SP" && destination === "Interior");

        return {
          carrier,
          eligible,
          reason: eligible
            ? "Atende produto nesta UF e região."
            : "Rodonaves atende produto em MG e no interior de SP.",
        };
      }

      case "BRASIL WEB": {
        const eligible =
          ufIsListed(uf, PRODUCT_UFS["BRASIL WEB"]) ||
          (uf === "SP" && destination === "Interior");

        return {
          carrier,
          eligible,
          reason: eligible
            ? "Atende produto nesta UF e região."
            : "Brasil Web atende produto em ES, MG e no interior de SP.",
        };
      }

      case "RODOBRAS": {
        const eligible = ufIsListed(uf, PRODUCT_UFS.RODOBRAS);

        return {
          carrier,
          eligible,
          reason: eligible
            ? "Atende produto nesta UF."
            : "Rodobras atende produto em PR, RS e SC.",
        };
      }

      case "ANEG": {
        const eligible = ufIsListed(uf, PRODUCT_UFS.ANEG);

        return {
          carrier,
          eligible,
          reason: eligible
            ? "Atende produto nesta UF."
            : "ANEG atende produto em PR, RJ, RS e SP.",
        };
      }

      case "FAVORITA": {
        const eligible = ufIsListed(uf, PRODUCT_UFS.FAVORITA);

        return {
          carrier,
          eligible,
          reason: eligible
            ? "Atende produto nesta UF."
            : "Favorita não atende produto nesta UF.",
        };
      }

      case "MODULAR":
        return {
          carrier,
          eligible: false,
          reason: "Modular não atende produto nesta matriz.",
        };

      case "CCA EXPRESS":
        return {
          carrier,
          eligible: false,
          reason: "CCA Express não atende produto nesta matriz.",
        };
    }
  }

  const heavyShipment = isHeavyPartsShipment(
    input.weightKg,
    input.volumeM3,
  );

  switch (carrier) {
    case "CCA EXPRESS": {
      const eligible = !heavyShipment;

      return {
        carrier,
        eligible,
        reason: eligible
          ? "Carga de peças dentro do limite da CCA."
          : "CCA limitada a 30 kg de peso real e peso cubado.",
      };
    }

    case "RODONAVES": {
      const eligible =
        heavyShipment && ufIsListed(uf, PARTS_RODONAVES_UFS);

      return {
        carrier,
        eligible,
        reason: eligible
          ? "Atende peças acima do limite da CCA nesta UF."
          : heavyShipment
            ? "Rodonaves não atende peças pesadas nesta UF."
            : "Peças dentro do limite da CCA; Rodonaves não é elegível pela matriz.",
      };
    }

    case "MODULAR": {
      const eligible =
        heavyShipment && ufIsListed(uf, PARTS_MODULAR_UFS);

      return {
        carrier,
        eligible,
        reason: eligible
          ? "Atende peças acima do limite da CCA nesta UF."
          : heavyShipment
            ? "Modular não atende peças pesadas nesta UF."
            : "Peças dentro do limite da CCA; Modular não é elegível pela matriz.",
      };
    }

    default:
      return {
        carrier,
        eligible: false,
        reason: `${carrier} não atende peças nesta matriz.`,
      };
  }
}

export function getAllCarrierEligibilities(
  input: FreightRuleInput,
): CarrierEligibility[] {
  return CARRIERS.map((carrier) =>
    getCarrierEligibility(carrier, input),
  );
}