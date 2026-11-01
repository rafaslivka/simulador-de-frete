import { supabase } from "./supabase";
import type {
  FreightSheetKey,
  SpreadsheetCell,
} from "../utils/readFreightWorkbook";

const TABLE_NAME = "freight_dataset_versions";

export type FreightDatasetVersion = {
  id: string;
  dataset_key: FreightSheetKey;
  version_no: number;
  source_file_name: string;
  data: SpreadsheetCell[][];
  is_active: boolean;
  created_at: string;
};

export type FreightDatasetBatchEntry = {
  datasetKey: FreightSheetKey;
  data: SpreadsheetCell[][];
};

export async function getActiveFreightDatasets(): Promise<
  FreightDatasetVersion[]
> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      "id, dataset_key, version_no, source_file_name, data, is_active, created_at",
    )
    .eq("is_active", true)
    .order("dataset_key", { ascending: true });

  if (error) {
    throw new Error(
      `Não foi possível carregar as tabelas de frete: ${error.message}`,
    );
  }

  return (data ?? []) as FreightDatasetVersion[];
}

export async function getFreightDatasetHistory(): Promise<
  FreightDatasetVersion[]
> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      "id, dataset_key, version_no, source_file_name, data, is_active, created_at",
    )
    .order("dataset_key", { ascending: true })
    .order("version_no", { ascending: false });

  if (error) {
    throw new Error(
      `Não foi possível carregar o histórico das tabelas: ${error.message}`,
    );
  }

  return (data ?? []) as FreightDatasetVersion[];
}

/**
 * Salva várias abas numa única operação do Supabase.
 * A função SQL trata a importação inteira como uma transação.
 */
export async function saveFreightDatasetBatch(
  sourceFileName: string,
  datasets: FreightDatasetBatchEntry[],
): Promise<FreightDatasetVersion[]> {
  const trimmedFileName = sourceFileName.trim();

  if (!trimmedFileName) {
    throw new Error("Informe o nome do arquivo de origem.");
  }

  if (!Array.isArray(datasets) || datasets.length === 0) {
    throw new Error("Não há abas reconhecidas para salvar.");
  }

  const datasetKeys = datasets.map((dataset) => dataset.datasetKey);
  const uniqueDatasetKeys = new Set(datasetKeys);

  if (uniqueDatasetKeys.size !== datasetKeys.length) {
    throw new Error(
      "O arquivo contém mais de uma aba destinada à mesma tabela.",
    );
  }

  for (const dataset of datasets) {
    if (!Array.isArray(dataset.data) || dataset.data.length === 0) {
      throw new Error(
        `A tabela ${dataset.datasetKey} não contém linhas para salvar.`,
      );
    }
  }

  const payload = datasets.map((dataset) => ({
    dataset_key: dataset.datasetKey,
    data: dataset.data,
  }));

  const { data, error } = await supabase.rpc(
    "save_freight_dataset_batch",
    {
      p_source_file_name: trimmedFileName,
      p_datasets: payload,
    },
  );

  if (error) {
    throw new Error(
      `Não foi possível salvar todas as abas do arquivo: ${error.message}`,
    );
  }

  return (data ?? []) as FreightDatasetVersion[];
}

/**
 * Mantida para telas antigas que ainda salvam uma única tabela.
 * A nova tela de importação usará saveFreightDatasetBatch.
 */
export async function saveFreightDatasetVersion(
  datasetKey: FreightSheetKey,
  sourceFileName: string,
  rows: SpreadsheetCell[][],
): Promise<FreightDatasetVersion> {
  if (!sourceFileName.trim()) {
    throw new Error("Informe o nome do arquivo de origem.");
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`A aba ${datasetKey} não contém linhas para salvar.`);
  }

  const { data: latestVersion, error: versionError } = await supabase
    .from(TABLE_NAME)
    .select("version_no")
    .eq("dataset_key", datasetKey)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (versionError) {
    throw new Error(
      `Não foi possível consultar a versão atual de ${datasetKey}: ${versionError.message}`,
    );
  }

  const nextVersion = (latestVersion?.version_no ?? 0) + 1;

  const { data: insertedVersion, error: insertError } = await supabase
    .from(TABLE_NAME)
    .insert({
      dataset_key: datasetKey,
      version_no: nextVersion,
      source_file_name: sourceFileName.trim(),
      data: rows,
    })
    .select(
      "id, dataset_key, version_no, source_file_name, data, is_active, created_at",
    )
    .single();

  if (insertError || !insertedVersion) {
    throw new Error(
      `Não foi possível salvar a versão ${nextVersion} de ${datasetKey}: ${
        insertError?.message ?? "o Supabase não retornou a versão criada."
      }`,
    );
  }

  const { error: activationError } = await supabase.rpc(
    "activate_freight_dataset_version",
    {
      p_version_id: insertedVersion.id,
    },
  );

  if (activationError) {
    throw new Error(
      `A versão ${nextVersion} de ${datasetKey} foi salva, mas não foi ativada: ${activationError.message}`,
    );
  }

  return {
    ...(insertedVersion as FreightDatasetVersion),
    is_active: true,
  };
}